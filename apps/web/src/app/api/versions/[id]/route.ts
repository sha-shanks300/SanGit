import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Permanently delete a single version. Mirrors the project delete: storage
 * first via the admin client (the flp/audio buckets only grant owners read),
 * best-effort so orphaned files never block the row delete; the row delete
 * runs on the session client so RLS stays the authority. Cascades take
 * comments, reactions, and version-scoped share links; projects.main_version_id
 * nulls itself via its FK. If this was the branch's last version the branch
 * row goes too — the service simply re-creates it on a future save.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Versions of public projects are readable by anyone signed in, so the
  // explicit owner check matters.
  const { data: version } = await supabase
    .from("versions")
    .select("id, user_id, branch_id, flp_storage_path, mp3_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!version || version.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const targets: [bucket: "flp-files" | "audio", path: string | null][] = [
    ["flp-files", version.flp_storage_path],
    ["audio", version.mp3_storage_path],
  ];
  for (const [bucket, path] of targets) {
    if (!path || !path.startsWith(`${user.id}/`)) continue;
    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error) {
      console.error(`[delete-version] ${bucket} cleanup failed for ${id}:`, error);
    }
  }

  const { error: deleteError } = await supabase.from("versions").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "failed to delete version" }, { status: 500 });
  }

  // Remove the branch if this was its last version (lane disappears).
  let branchDeleted = false;
  const { count } = await supabase
    .from("versions")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", version.branch_id);
  if (count === 0) {
    const { error } = await supabase
      .from("branches")
      .delete()
      .eq("id", version.branch_id);
    branchDeleted = !error;
    if (error) {
      console.error(`[delete-version] empty-branch cleanup failed for ${id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, branch_deleted: branchDeleted });
}
