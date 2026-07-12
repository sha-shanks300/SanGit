import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveShareLink, versionInScope } from "@/lib/share-token";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Toggle a like on a version reached through a share link. Requires a
 * signed-in session — the write is attributed to the real user — while the
 * token authorizes access to the (possibly private) project, which plain
 * RLS inserts would reject.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in to like" }, { status: 401 });
  }

  let body: { version_id?: string; like?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isUuid(body.version_id) || typeof body.like !== "boolean") {
    return NextResponse.json({ error: "version_id and like required" }, { status: 400 });
  }

  const resolved = await resolveShareLink(token);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link, admin } = resolved;

  if (!(await versionInScope(admin, link, body.version_id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (body.like) {
    const { error } = await admin
      .from("reactions")
      .upsert(
        { version_id: body.version_id, user_id: user.id, kind: "like" },
        { onConflict: "version_id,user_id" }
      );
    if (error) {
      return NextResponse.json({ error: "failed to like" }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("reactions")
      .delete()
      .eq("version_id", body.version_id)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: "failed to unlike" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
