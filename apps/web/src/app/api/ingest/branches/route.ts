import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice, isUuid } from "@/lib/ingest-auth";

/**
 * List a project's branches for the local service's "Commit to branch"
 * dropdown. Device-authed; scoped to the device owner. Returns
 * [{id, name, parent_branch_id}] — parent_branch_id null marks the trunk, which
 * the popup labels "main".
 */
export async function GET(request: Request) {
  const auth = await authenticateDevice(request);
  if ("error" in auth) return auth.error;
  const { device } = auth;

  const projectId = new URL(request.url).searchParams.get("project_id");
  if (!projectId || !isUuid(projectId)) {
    return NextResponse.json({ error: "project_id must be a UUID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select("id, name, parent_branch_id")
    .eq("project_id", projectId)
    .eq("user_id", device.user_id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "failed to load branches" }, { status: 500 });
  }

  return NextResponse.json({ branches: data ?? [] });
}
