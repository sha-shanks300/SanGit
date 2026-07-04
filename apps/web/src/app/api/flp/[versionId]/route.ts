import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/ingest-auth";

/** Owner-only signed download URL for a version's .flp. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: version } = await supabase
    .from("versions")
    .select("id, user_id, flp_storage_path, file_name")
    .eq("id", versionId)
    .maybeSingle();

  if (!version || version.user_id !== user.id || !version.flp_storage_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("flp-files")
    .createSignedUrl(version.flp_storage_path, 600, {
      download: version.file_name,
    });

  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
