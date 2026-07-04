import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Token-gated playback for private share links. Bypasses RLS deliberately:
 * the token IS the credential. Validates expiry/revocation/max-views, logs
 * the view, and returns version metadata + a short-lived signed mp3 URL.
 *
 * `?noview=1` refreshes the signed URL without counting another view (used
 * by the player when a URL expires mid-session); revocation and expiry are
 * still enforced.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }

  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: link } = await admin
    .from("share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link || link.revoked_at) {
    return NextResponse.json({ error: "link revoked or unknown" }, { status: 404 });
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "link expired" }, { status: 410 });
  }

  const skipView = new URL(request.url).searchParams.get("noview") === "1";
  if (!skipView && link.max_views != null && link.view_count >= link.max_views) {
    return NextResponse.json({ error: "view limit reached" }, { status: 410 });
  }

  const { data: version } = await admin
    .from("versions")
    .select("id, display_name, file_name, duration_secs, render_status, mp3_storage_path, uploaded_at, project_id")
    .eq("id", link.version_id!)
    .single();

  if (!version || version.render_status !== "ready" || !version.mp3_storage_path) {
    return NextResponse.json({ error: "audio not available" }, { status: 409 });
  }

  const { data: project } = await admin
    .from("projects")
    .select("title")
    .eq("id", version.project_id)
    .single();

  if (!skipView) {
    await admin
      .from("share_links")
      .update({ view_count: link.view_count + 1 })
      .eq("id", link.id);
    await admin.from("link_views").insert({
      share_link_id: link.id,
      ip_hash: createHash("sha256")
        .update(request.headers.get("x-forwarded-for") ?? "unknown")
        .digest("hex")
        .slice(0, 32),
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    });
  }

  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(version.mp3_storage_path, 3600);

  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    version: {
      id: version.id,
      name: version.display_name || version.file_name,
      duration_secs: version.duration_secs,
      uploaded_at: version.uploaded_at,
      project_title: project?.title ?? "",
    },
  });
}
