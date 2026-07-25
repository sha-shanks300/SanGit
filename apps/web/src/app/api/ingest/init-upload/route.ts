import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice, isUuid } from "@/lib/ingest-auth";
import { slugify } from "@/lib/utils";

/**
 * Step 1 of a commit from the local service. Upserts the project (by the
 * client-generated UUID from .sangit.json) and the branch (by .flp filename),
 * dedupe-checks the hash against the branch tip, and returns a presigned
 * storage upload URL. The .flp goes directly to Supabase Storage — it never
 * passes through this server.
 */
export async function POST(request: Request) {
  const auth = await authenticateDevice(request);
  if ("error" in auth) return auth.error;
  const { device } = auth;

  let body: {
    project_id?: string;
    project_title?: string;
    file_name?: string;
    sha256?: string;
    size?: number;
    branch_id?: string; // active branch to commit onto (or base for a fork)
    new_branch_name?: string; // present => "Branch & commit": fork a new branch
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { project_id, project_title, file_name, sha256, branch_id, new_branch_name } = body;
  if (!isUuid(project_id)) {
    return NextResponse.json({ error: "project_id must be a UUID" }, { status: 400 });
  }
  if (!file_name || !/\.flp$/i.test(file_name)) {
    return NextResponse.json({ error: "file_name must be a .flp" }, { status: 400 });
  }
  if (!sha256 || !/^[0-9a-f]{64}$/i.test(sha256)) {
    return NextResponse.json({ error: "sha256 is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Upsert project. If the UUID exists it must belong to this device's user.
  const { data: existingProject } = await admin
    .from("projects")
    .select("id, user_id")
    .eq("id", project_id)
    .maybeSingle();

  if (existingProject && existingProject.user_id !== device.user_id) {
    return NextResponse.json({ error: "project belongs to another user" }, { status: 403 });
  }

  if (!existingProject) {
    const title = (project_title ?? "Untitled Project").slice(0, 120);
    let slug = slugify(title);
    const { data: slugTaken } = await admin
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (slugTaken) slug = `${slug}-${project_id.slice(0, 6)}`;

    const { error } = await admin.from("projects").insert({
      id: project_id,
      user_id: device.user_id,
      title,
      slug,
    });
    if (error) {
      return NextResponse.json({ error: "failed to create project" }, { status: 500 });
    }
  }

  const filenameBranch = file_name.replace(/\.flp$/i, "");

  // A branch_id from the service must belong to this project + user.
  async function validateBranch(id: string): Promise<string | null> {
    const { data } = await admin
      .from("branches")
      .select("id, project_id, user_id")
      .eq("id", id)
      .maybeSingle();
    return data && data.project_id === project_id && data.user_id === device.user_id
      ? data.id
      : null;
  }

  let branchId: string | undefined;

  if (new_branch_name) {
    // "Branch & commit": fork a NEW branch that is a sibling of the base
    // branch's current tip — i.e. it forks from the version BEFORE the tip.
    const wanted = new_branch_name.trim().slice(0, 120);
    if (!wanted) {
      return NextResponse.json({ error: "new_branch_name is empty" }, { status: 400 });
    }

    // Resolve the base branch (the file's active branch): the sent branch_id,
    // else the filename-derived branch if it already exists, else none.
    let baseBranchId = branch_id ? await validateBranch(branch_id) : null;
    if (!baseBranchId) {
      const { data: fb } = await admin
        .from("branches")
        .select("id")
        .eq("project_id", project_id)
        .eq("name", filenameBranch)
        .maybeSingle();
      baseBranchId = fb?.id ?? null;
    }

    // Fork point = the version before the base tip (sibling of the tip). With
    // only one version, fork from it; with none, leave it null (graph falls back).
    let forkVersionId: string | null = null;
    if (baseBranchId) {
      const { data: recent } = await admin
        .from("versions")
        .select("id")
        .eq("branch_id", baseBranchId)
        .order("uploaded_at", { ascending: false })
        .limit(2);
      forkVersionId = recent?.[1]?.id ?? recent?.[0]?.id ?? null;
    }

    // Ensure the branch name is unique within the project.
    let name = wanted;
    for (let i = 2; i < 200; i++) {
      const { data: taken } = await admin
        .from("branches")
        .select("id")
        .eq("project_id", project_id)
        .eq("name", name)
        .maybeSingle();
      if (!taken) break;
      name = `${wanted}-${i}`;
    }

    const { data: branch, error } = await admin
      .from("branches")
      .insert({
        project_id,
        user_id: device.user_id,
        name,
        parent_branch_id: baseBranchId,
        fork_version_id: forkVersionId,
      })
      .select("id")
      .single();
    if (error || !branch) {
      return NextResponse.json({ error: "failed to create branch" }, { status: 500 });
    }
    branchId = branch.id;
  } else if (branch_id) {
    // Normal commit onto the file's tracked active branch.
    const valid = await validateBranch(branch_id);
    if (!valid) {
      return NextResponse.json({ error: "unknown branch_id" }, { status: 400 });
    }
    branchId = valid;
  } else {
    // First commit of this file (no tracked branch): upsert by filename.
    const { data: existingBranch } = await admin
      .from("branches")
      .select("id")
      .eq("project_id", project_id)
      .eq("name", filenameBranch)
      .maybeSingle();

    branchId = existingBranch?.id;
    if (!branchId) {
      // Best-effort fork point: the branch of the most recent version in the project.
      const { data: latest } = await admin
        .from("versions")
        .select("branch_id")
        .eq("project_id", project_id)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: branch, error } = await admin
        .from("branches")
        .insert({
          project_id,
          user_id: device.user_id,
          name: filenameBranch,
          parent_branch_id: latest?.branch_id ?? null,
        })
        .select("id")
        .single();
      if (error || !branch) {
        return NextResponse.json({ error: "failed to create branch" }, { status: 500 });
      }
      branchId = branch.id;
    }
  }

  // Dedupe: identical hash at the branch tip means nothing changed.
  const { data: tip } = await admin
    .from("versions")
    .select("id, flp_sha256")
    .eq("branch_id", branchId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tip && tip.flp_sha256 === sha256.toLowerCase()) {
    return NextResponse.json({ duplicate: true, version_id: tip.id });
  }

  const versionId = randomUUID();
  const storagePath = `${device.user_id}/${project_id}/${versionId}.flp`;
  const { data: signed, error: signError } = await admin.storage
    .from("flp-files")
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    return NextResponse.json({ error: "failed to presign upload" }, { status: 500 });
  }

  return NextResponse.json({
    duplicate: false,
    version_id: versionId,
    branch_id: branchId,
    storage_path: storagePath,
    upload_url: signed.signedUrl,
    upload_token: signed.token,
  });
}
