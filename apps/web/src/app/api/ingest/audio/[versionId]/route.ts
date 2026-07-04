import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice, isUuid } from "@/lib/ingest-auth";

/**
 * Attach the rendered mp3 to a version. Three phases driven by the local
 * render queue:
 *   {phase:"init"}                          -> presigned upload URL
 *   {phase:"complete", duration_secs}      -> render_status=ready
 *   {phase:"failed", error}                -> render_status=failed
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const auth = await authenticateDevice(request);
  if ("error" in auth) return auth.error;
  const { device } = auth;

  const { versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version id" }, { status: 400 });
  }

  let body: { phase?: string; duration_secs?: number; error?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: version } = await admin
    .from("versions")
    .select("id, user_id, project_id")
    .eq("id", versionId)
    .single();

  if (!version || version.user_id !== device.user_id) {
    return NextResponse.json({ error: "unknown version" }, { status: 404 });
  }

  const mp3Path = `${version.user_id}/${version.project_id}/${version.id}.mp3`;

  switch (body.phase) {
    case "init": {
      const { data: signed, error } = await admin.storage
        .from("audio")
        .createSignedUploadUrl(mp3Path, { upsert: true });
      if (error || !signed) {
        return NextResponse.json({ error: "failed to presign upload" }, { status: 500 });
      }
      await admin
        .from("versions")
        .update({ render_status: "rendering" })
        .eq("id", versionId);
      return NextResponse.json({
        storage_path: mp3Path,
        upload_url: signed.signedUrl,
        upload_token: signed.token,
      });
    }

    case "complete": {
      const duration =
        typeof body.duration_secs === "number" && isFinite(body.duration_secs)
          ? body.duration_secs
          : null;
      const { error } = await admin
        .from("versions")
        .update({
          mp3_storage_path: mp3Path,
          duration_secs: duration,
          render_status: "ready",
          render_error: null,
        })
        .eq("id", versionId);
      if (error) {
        return NextResponse.json({ error: "failed to update version" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    case "failed": {
      await admin
        .from("versions")
        .update({
          render_status: "failed",
          render_error: (body.error ?? "render failed").slice(0, 500),
        })
        .eq("id", versionId);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { error: "phase must be init | complete | failed" },
        { status: 400 }
      );
  }
}
