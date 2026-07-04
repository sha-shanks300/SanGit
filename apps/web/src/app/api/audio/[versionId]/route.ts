import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/ingest-auth";

const SIGNED_URL_TTL_SECS = 60 * 60;

/**
 * Mints a short-lived signed URL for a version's mp3. Allowed for the owner
 * and for anyone when the parent project is public. Private share links use
 * /api/listen/[token] instead.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version id" }, { status: 400 });
  }

  // RLS does the access check: owner or public project.
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("versions")
    .select("id, mp3_storage_path, render_status")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (version.render_status !== "ready" || !version.mp3_storage_path) {
    return NextResponse.json({ error: "audio not ready" }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(version.mp3_storage_path, SIGNED_URL_TTL_SECS);

  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
