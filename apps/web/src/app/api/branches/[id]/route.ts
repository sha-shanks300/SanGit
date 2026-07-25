import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Permanently delete a whole branch and every version on it. Mirrors the
 * single-version delete: storage first via the admin client (owners-only
 * buckets), best-effort so orphans never block the row delete; the branch row
 * delete runs on the session client so RLS stays the authority and cascades
 * take the versions (and their comments/reactions/version share links).
 * projects.main_version_id nulls itself via its FK if the Main version was
 * here. Refuses the trunk (no parent) and any branch that has its own forks.
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

  const { data: branch } = await supabase
    .from("branches")
    .select("id, user_id, parent_branch_id")
    .eq("id", id)
    .maybeSingle();
  if (!branch || branch.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (branch.parent_branch_id === null) {
    return NextResponse.json(
      { error: "the main branch can't be deleted" },
      { status: 400 }
    );
  }

  const { count: childCount } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("parent_branch_id", id);
  if (childCount && childCount > 0) {
    return NextResponse.json(
      { error: "this branch has forks — delete or merge those first" },
      { status: 409 }
    );
  }

  // Clean up storage for every version on the branch before the cascade wipes
  // the rows (best-effort; a failed remove just leaves an orphan file).
  const { data: versions } = await supabase
    .from("versions")
    .select("flp_storage_path, mp3_storage_path")
    .eq("branch_id", id);

  const admin = createAdminClient();
  for (const v of versions ?? []) {
    const targets: [bucket: "flp-files" | "audio", path: string | null][] = [
      ["flp-files", v.flp_storage_path],
      ["audio", v.mp3_storage_path],
    ];
    for (const [bucket, path] of targets) {
      if (!path || !path.startsWith(`${user.id}/`)) continue;
      const { error } = await admin.storage.from(bucket).remove([path]);
      if (error) {
        console.error(`[delete-branch] ${bucket} cleanup failed for ${id}:`, error);
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("branches")
    .delete()
    .eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "failed to delete branch" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
