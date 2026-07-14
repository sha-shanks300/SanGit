import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS = ["flp-files", "audio", "public-images"] as const;

/**
 * Delete the signed-in user's account. Storage first (best-effort, logged —
 * orphaned files must never block the delete), then the auth user: profiles
 * cascades from auth.users and every table cascades from profiles, so one
 * deleteUser call takes all rows (projects, branches, versions, comments,
 * reactions, favorites, devices, share links, flp keys) and revokes every
 * session. Paired tray services start getting 401s and re-enter pairing per
 * their existing lifecycle.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  for (const bucket of BUCKETS) {
    try {
      const paths = await collectFiles(bucket, user.id);
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw error;
      }
    } catch (e) {
      console.error(`[delete-account] ${bucket} cleanup failed for ${user.id}:`, e);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "failed to delete account" }, { status: 500 });
  }

  // Clear this browser's session cookies; the auth user is already gone, so
  // a failure here only leaves a dead cookie behind.
  await supabase.auth.signOut().catch(() => {});

  return NextResponse.json({ ok: true });

  /** Depth-first walk of a bucket "folder" — storage list entries without an
   *  id are subfolders (flp-files/audio nest per project; public-images has
   *  an artwork/ subfolder). */
  async function collectFiles(
    bucket: (typeof BUCKETS)[number],
    root: string
  ): Promise<string[]> {
    const files: string[] = [];
    const dirs = [root];
    while (dirs.length) {
      const dir = dirs.pop()!;
      for (let offset = 0; ; offset += 1000) {
        const { data: entries, error } = await admin.storage
          .from(bucket)
          .list(dir, { limit: 1000, offset });
        if (error) throw error;
        if (!entries?.length) break;
        for (const entry of entries) {
          if (entry.id === null) dirs.push(`${dir}/${entry.name}`);
          else files.push(`${dir}/${entry.name}`);
        }
        if (entries.length < 1000) break;
      }
    }
    return files;
  }
}
