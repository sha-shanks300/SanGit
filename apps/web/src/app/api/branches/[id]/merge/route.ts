import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Merge a branch into its immediate parent: re-parent every version onto the
 * parent branch and re-stamp their `uploaded_at` so they land AFTER the
 * parent's current tip in their original order (the app orders by uploaded_at
 * everywhere, so this is what "append to the end" means), then delete the now-
 * empty branch. The Main version, if it was on this branch, survives on the
 * parent. Refuses the trunk (no parent) and any branch that has its own forks.
 * Not transactional (sequential updates); fine for a single owner.
 */
export async function POST(
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
  if (!branch.parent_branch_id) {
    return NextResponse.json(
      { error: "the main branch has nothing to merge into" },
      { status: 400 }
    );
  }
  const target = branch.parent_branch_id;

  const { count: childCount } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("parent_branch_id", id);
  if (childCount && childCount > 0) {
    return NextResponse.json(
      { error: "this branch has forks — merge or delete those first" },
      { status: 409 }
    );
  }

  // The parent's current tip time; merged versions start just after it.
  const { data: tip } = await supabase
    .from("versions")
    .select("uploaded_at")
    .eq("branch_id", target)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = tip ? new Date(tip.uploaded_at).getTime() : Date.now();

  const { data: versions } = await supabase
    .from("versions")
    .select("id")
    .eq("branch_id", id)
    .order("uploaded_at", { ascending: true });

  // Re-parent in order, each a second after the last so they sort after the tip.
  for (let i = 0; i < (versions?.length ?? 0); i++) {
    const stamp = new Date(base + (i + 1) * 1000).toISOString();
    const { error } = await supabase
      .from("versions")
      .update({ branch_id: target, uploaded_at: stamp })
      .eq("id", versions![i].id);
    if (error) {
      return NextResponse.json({ error: "failed to merge versions" }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabase
    .from("branches")
    .delete()
    .eq("id", id);
  if (deleteError) {
    // Versions already moved; the empty branch lingering is harmless and retryable.
    return NextResponse.json(
      { error: "versions merged but branch cleanup failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, merged: versions?.length ?? 0 });
}
