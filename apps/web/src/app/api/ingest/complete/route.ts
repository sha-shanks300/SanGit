import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice, isUuid } from "@/lib/ingest-auth";

/**
 * Step 2 of a commit: the .flp is in storage — create the version row
 * (render_status=pending). Realtime pushes the new node to the dashboard.
 */
export async function POST(request: Request) {
  const auth = await authenticateDevice(request);
  if ("error" in auth) return auth.error;
  const { device } = auth;

  let body: {
    version_id?: string;
    project_id?: string;
    branch_id?: string;
    file_name?: string;
    sha256?: string;
    display_name?: string;
    storage_path?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { version_id, project_id, branch_id, file_name, sha256, storage_path } = body;
  if (!isUuid(version_id) || !isUuid(project_id) || !isUuid(branch_id)) {
    return NextResponse.json({ error: "version_id, project_id, branch_id must be UUIDs" }, { status: 400 });
  }
  if (!file_name || !sha256 || !storage_path) {
    return NextResponse.json({ error: "file_name, sha256, storage_path are required" }, { status: 400 });
  }
  if (!storage_path.startsWith(`${device.user_id}/`)) {
    return NextResponse.json({ error: "storage_path outside user scope" }, { status: 403 });
  }

  const admin = createAdminClient();

  // The branch must belong to this user + project.
  const { data: branch } = await admin
    .from("branches")
    .select("id, project_id, user_id")
    .eq("id", branch_id)
    .single();
  if (!branch || branch.user_id !== device.user_id || branch.project_id !== project_id) {
    return NextResponse.json({ error: "unknown branch" }, { status: 404 });
  }

  const { data: version, error } = await admin
    .from("versions")
    .insert({
      id: version_id,
      branch_id,
      project_id,
      user_id: device.user_id,
      display_name: body.display_name?.slice(0, 120) || null,
      file_name,
      flp_storage_path: storage_path,
      flp_sha256: sha256.toLowerCase(),
      render_status: "pending",
    })
    .select()
    .single();

  if (error || !version) {
    return NextResponse.json({ error: "failed to create version" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, version_id: version.id });
}
