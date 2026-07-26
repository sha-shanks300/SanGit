import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { resolveShareLink } from "@/lib/share-token";
import type { Branch, Version } from "@/lib/database.types";

/**
 * Token-gated payload for private share links. Bypasses RLS deliberately:
 * the token IS the credential. Validates expiry/revocation/max-views, logs
 * the view, and returns either:
 *
 * - version-scoped link → `scope: "version"` + a short-lived signed mp3 URL
 *   (the original single-track behavior), or
 * - project-scoped link → `scope: "project"`. Honors the project's Main/All
 *   setting: All versions returns branches + every version; Main-only returns
 *   just the Main (or latest ready) version and no branches, so recipients
 *   never learn other versions exist. Storage paths stripped; audio is fetched
 *   per-version via /api/listen/[token]/audio/[versionId].
 *
 * `?noview=1` refreshes the payload without counting another view (used by
 * the player when a URL expires mid-session); revocation and expiry are
 * still enforced.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = await resolveShareLink(token);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link, admin } = resolved;

  const skipView = new URL(request.url).searchParams.get("noview") === "1";
  if (!skipView && link.max_views != null && link.view_count >= link.max_views) {
    return NextResponse.json({ error: "view limit reached" }, { status: 410 });
  }

  async function countView() {
    if (skipView) return;
    await admin
      .from("share_links")
      .update({ view_count: link.view_count + 1 })
      .eq("id", link.id);
    await admin.from("link_views").insert({
      share_link_id: link.id,
      ip_hash: createHash("sha256")
        .update(request.headers.get("x-forwarded-for") ?? "unknown")
        .digest("hex")
        .slice(0, 32),
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    });
  }

  // ------------------------------------------------------------------
  // Project-scoped link: the whole read-only project view.
  // ------------------------------------------------------------------
  if (!link.version_id) {
    const { data: project } = await admin
      .from("projects")
      .select("id, user_id, title, artwork_url, main_version_id, show_history")
      .eq("id", link.project_id!)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "project not found" }, { status: 404 });
    }

    const { data: owner } = await admin
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", project.user_id)
      .maybeSingle();

    // Storage paths are owner-only knowledge — never hand them to viewers.
    const strip = (v: Version): Version => ({
      ...v,
      flp_storage_path: null,
      mp3_storage_path: null,
    });
    const projectMeta = {
      id: project.id,
      title: project.title,
      artwork_url: project.artwork_url,
      main_version_id: project.main_version_id,
      owner: owner ?? null,
    };

    // Main-only: hand over just the Main version (or the latest ready one).
    // The recipient never learns other versions or branches exist.
    if (!project.show_history) {
      let main: Version | null = null;
      if (project.main_version_id) {
        const { data } = await admin
          .from("versions")
          .select("*")
          .eq("id", project.main_version_id)
          .maybeSingle();
        if (data?.render_status === "ready") main = data;
      }
      if (!main) {
        const { data } = await admin
          .from("versions")
          .select("*")
          .eq("project_id", project.id)
          .eq("render_status", "ready")
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        main = data ?? null;
      }
      await countView();
      return NextResponse.json({
        scope: "project",
        show_history: false,
        project: projectMeta,
        branches: [],
        versions: main ? [strip(main)] : [],
      });
    }

    const [{ data: branches }, { data: versions }] = await Promise.all([
      admin.from("branches").select("*").eq("project_id", project.id).returns<Branch[]>(),
      admin
        .from("versions")
        .select("*")
        .eq("project_id", project.id)
        .order("uploaded_at", { ascending: true })
        .returns<Version[]>(),
    ]);

    await countView();

    return NextResponse.json({
      scope: "project",
      show_history: true,
      project: projectMeta,
      branches: branches ?? [],
      versions: (versions ?? []).map(strip),
    });
  }

  // ------------------------------------------------------------------
  // Version-scoped link: single-track payload (original behavior).
  // ------------------------------------------------------------------
  const { data: version } = await admin
    .from("versions")
    .select("id, display_name, file_name, duration_secs, render_status, mp3_storage_path, uploaded_at, project_id")
    .eq("id", link.version_id)
    .single();

  if (!version || version.render_status !== "ready" || !version.mp3_storage_path) {
    return NextResponse.json({ error: "audio not available" }, { status: 409 });
  }

  const { data: project } = await admin
    .from("projects")
    .select("title")
    .eq("id", version.project_id)
    .single();

  await countView();

  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(version.mp3_storage_path, 3600);

  if (error || !signed) {
    return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
  }

  return NextResponse.json({
    scope: "version",
    url: signed.signedUrl,
    version: {
      id: version.id,
      name: version.display_name || version.file_name,
      duration_secs: version.duration_secs,
      uploaded_at: version.uploaded_at,
      project_title: project?.title ?? "",
    },
  });
}
