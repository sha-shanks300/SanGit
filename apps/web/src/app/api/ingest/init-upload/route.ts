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
  // Did this request CREATE a new branch? The service moves the file's home
  // branch only when true — appending to an existing branch is a one-off.
  let branchCreated = false;

  if (new_branch_name) {
    // "Commit to branch": the named branch may be new (fork it) or already
    // exist (append onto it — covers the offline free-text case).
    const wanted = new_branch_name.trim().slice(0, 120);
    if (!wanted) {
      return NextResponse.json({ error: "new_branch_name is empty" }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("branches")
      .select("id")
      .eq("project_id", project_id)
      .eq("name", wanted)
      .maybeSingle();

    if (existing) {
      branchId = existing.id; // append onto the existing branch
    } else {
      // Create a NEW branch that forks from the base branch's current tip — the
      // new take is a child of your latest save, not a sibling that orphans it.
      // Base = the sent branch_id (the file's home), else the filename branch.
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

      // The new version isn't inserted until step 2, so the base branch's most
      // recent version here IS its current tip — fork from it.
      let forkVersionId: string | null = null;
      if (baseBranchId) {
        const { data: tip } = await admin
          .from("versions")
          .select("id")
          .eq("branch_id", baseBranchId)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        forkVersionId = tip?.id ?? null;
      }

      const { data: branch, error } = await admin
        .from("branches")
        .insert({
          project_id,
          user_id: device.user_id,
          name: wanted,
          parent_branch_id: baseBranchId,
          fork_version_id: forkVersionId,
        })
        .select("id")
        .single();
      if (error || !branch) {
        return NextResponse.json({ error: "failed to create branch" }, { status: 500 });
      }
      branchId = branch.id;
      branchCreated = true;
    }
  } else if (branch_id) {
    // Commit onto a specific existing branch (the file's home, or one picked
    // from the dropdown). Appending — never creates.
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
      branchCreated = true;
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
    branch_created: branchCreated,
    storage_path: storagePath,
    upload_url: signed.signedUrl,
    upload_token: signed.token,
  });
}
