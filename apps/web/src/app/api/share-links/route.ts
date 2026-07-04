import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Create a share link for a version. The raw token is returned exactly once;
 * only its hash is stored, so links are revocable but never enumerable.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    version_id?: string;
    label?: string;
    expires_in_hours?: number | null;
    max_views?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isUuid(body.version_id)) {
    return NextResponse.json({ error: "version_id must be a UUID" }, { status: 400 });
  }

  // RLS: only rows the user owns are visible here.
  const { data: version } = await supabase
    .from("versions")
    .select("id, user_id, project_id")
    .eq("id", body.version_id)
    .maybeSingle();
  if (!version || version.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt =
    body.expires_in_hours && body.expires_in_hours > 0
      ? new Date(Date.now() + body.expires_in_hours * 3600_000).toISOString()
      : null;

  const { data: link, error } = await supabase
    .from("share_links")
    .insert({
      user_id: user.id,
      version_id: version.id,
      project_id: version.project_id,
      token_hash: createHash("sha256").update(token).digest("hex"),
      kind: "private",
      label: body.label?.slice(0, 80) || null,
      expires_at: expiresAt,
      max_views:
        body.max_views && body.max_views > 0 ? Math.floor(body.max_views) : null,
    })
    .select()
    .single();

  if (error || !link) {
    return NextResponse.json({ error: "failed to create link" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return NextResponse.json({
    id: link.id,
    url: `${origin}/s/${token}`,
    expires_at: link.expires_at,
    max_views: link.max_views,
  });
}
