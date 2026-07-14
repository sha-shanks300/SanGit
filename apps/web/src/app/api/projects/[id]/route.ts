import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Permanently delete a project. Storage first, row second: the flp/audio
 * buckets only grant owners read (uploads are presigned server-side), so the
 * admin client must remove the files — but a cleanup failure only orphans
 * files, so it logs and never blocks the row delete. The row delete runs on
 * the session client so RLS stays the authority, and DB cascades take
 * branches, versions, reactions, comments, favorites, share links, and flp
 * keys with it.
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

  // RLS hides other users' rows, but a public project row is readable by
  // anyone signed in — the explicit owner check matters.
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, artwork_url")
    .eq("id", id)
    .maybeSingle();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const prefix = `${user.id}/${id}`;

  for (const bucket of ["flp-files", "audio"] as const) {
    try {
      // Both buckets store versions flat under {user}/{project}/, so one
      // folder listing (paged) covers everything.
      const paths: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: objects, error } = await admin.storage
          .from(bucket)
          .list(prefix, { limit: 1000, offset });
        if (error) throw error;
        if (!objects?.length) break;
        paths.push(...objects.map((o) => `${prefix}/${o.name}`));
        if (objects.length < 1000) break;
      }
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw error;
      }
    } catch (e) {
      console.error(`[delete-project] ${bucket} cleanup failed for ${id}:`, e);
    }
  }

  if (project.artwork_url) {
    const marker = "/object/public/public-images/";
    const i = project.artwork_url.indexOf(marker);
    if (i !== -1) {
      const path = decodeURIComponent(project.artwork_url.slice(i + marker.length));
      if (path.startsWith(`${user.id}/`)) {
        const { error } = await admin.storage.from("public-images").remove([path]);
        if (error) {
          console.error(`[delete-project] artwork cleanup failed for ${id}:`, error);
        }
      }
    }
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "failed to delete project" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
