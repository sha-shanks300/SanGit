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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { project_id, project_title, file_name, sha256 } = body;
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

  // Upsert branch by filename (sans extension).
  const branchName = file_name.replace(/\.flp$/i, "");
  const { data: existingBranch } = await admin
    .from("branches")
    .select("id")
    .eq("project_id", project_id)
    .eq("name", branchName)
    .maybeSingle();

  let branchId = existingBranch?.id;
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
        name: branchName,
        parent_branch_id: latest?.branch_id ?? null,
      })
      .select("id")
      .single();
    if (error || !branch) {
      return NextResponse.json({ error: "failed to create branch" }, { status: 500 });
    }
    branchId = branch.id;
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
