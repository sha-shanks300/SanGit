import { NextResponse } from "next/server";
import { resolveShareLink, versionInScope } from "@/lib/share-token";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Per-version signed audio URL for a share link. No view accounting — the
 * payload fetch counted the view — but revocation/expiry are re-checked so a
 * revoked link dies mid-session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; versionId: string }> }
) {
  const { token, versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version" }, { status: 400 });
  }

  const resolved = await resolveShareLink(token);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link, admin } = resolved;

  if (!(await versionInScope(admin, link, versionId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: version } = await admin
    .from("versions")
    .select("id, render_status, mp3_storage_path")
    .eq("id", versionId)
    .maybeSingle();

  if (!version || version.render_status !== "ready" || !version.mp3_storage_path) {
    return NextResponse.json({ error: "audio not available" }, { status: 409 });
  }

  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(version.mp3_storage_path, 3600);

  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
