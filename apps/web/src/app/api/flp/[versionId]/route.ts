import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isUuid } from "@/lib/ingest-auth";
import { resolveShareLink, versionInScope } from "@/lib/share-token";

/** Owner-only signed download URL for a version's .flp. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: version } = await supabase
    .from("versions")
    .select("id, user_id, flp_storage_path, file_name")
    .eq("id", versionId)
    .maybeSingle();

  if (!version || version.user_id !== user.id || !version.flp_storage_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("flp-files")
    .createSignedUrl(version.flp_storage_path, 600, {
      download: version.file_name,
    });

  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}

/**
 * Passkey download for non-owners. The key travels in the body (never the
 * URL), is verified against the project's stored hash in constant time, and
 * only works where the version is already reachable: a public project, or a
 * valid un-revoked share link covering this version. Distinct errors let the
 * UI say "not enabled" vs "wrong key".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const key = body?.key;
  const token = body?.token;
  if (typeof key !== "string" || key.length < 20 || key.length > 128) {
    return NextResponse.json({ error: "invalid passkey" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: version } = await admin
    .from("versions")
    .select("id, project_id, flp_storage_path, file_name")
    .eq("id", versionId)
    .maybeSingle();
  if (!version || !version.flp_storage_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Reachability: the passkey grants the download, not the page. Private
  // unshared projects stay invisible even to key holders.
  const { data: project } = await admin
    .from("projects")
    .select("id, is_public")
    .eq("id", version.project_id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!project.is_public) {
    if (typeof token !== "string") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const resolved = await resolveShareLink(token);
    if (
      !resolved.ok ||
      !(await versionInScope(resolved.admin, resolved.link, versionId))
    ) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  const { data: keyRow } = await admin
    .from("project_flp_keys")
    .select("key_hash")
    .eq("project_id", version.project_id)
    .maybeSingle();
  if (!keyRow) {
    return NextResponse.json(
      { error: ".flp downloads are not enabled for this project" },
      { status: 403 }
    );
  }

  const given = Buffer.from(hashToken(key));
  const stored = Buffer.from(keyRow.key_hash);
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return NextResponse.json({ error: "invalid passkey" }, { status: 403 });
  }

  const { data: signed, error } = await admin.storage
    .from("flp-files")
    .createSignedUrl(version.flp_storage_path, 600, {
      download: version.file_name,
    });
  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl });
}
