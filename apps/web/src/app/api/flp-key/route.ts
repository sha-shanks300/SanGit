import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashToken, isUuid } from "@/lib/ingest-auth";

/**
 * Owner-only mint/revoke for the per-project .flp passkey. The plaintext is
 * returned exactly once; only its SHA-256 lands in project_flp_keys (RLS
 * owner-scoped, so the session client can write it directly). Regenerating
 * upserts over the old hash, which invalidates the old key instantly.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.project_id;
  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "invalid project id" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const key = `sgk_${randomBytes(36).toString("base64url")}`;
  const created_at = new Date().toISOString();
  const { error } = await supabase.from("project_flp_keys").upsert(
    {
      project_id: projectId,
      user_id: user.id,
      key_hash: hashToken(key),
      created_at,
    },
    { onConflict: "project_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ key, created_at });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.project_id;
  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "invalid project id" }, { status: 400 });
  }

  // RLS scopes the delete to the owner's own rows.
  const { error } = await supabase
    .from("project_flp_keys")
    .delete()
    .eq("project_id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
