"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/lib/use-project";
import { useProjectLikes } from "@/lib/use-project-likes";
import { uploadPublicImage } from "@/lib/image-upload";
import type { Branch, Version } from "@/lib/database.types";
import { ProjectArtwork } from "@/components/project-artwork";
import { TimelineTree } from "@/components/timeline-tree";
import { VersionGraph } from "@/components/version-graph";
import { cn } from "@/lib/utils";
import { usePlayer, type PlayerTrack } from "@/components/player-context";
import { VersionPanel } from "@/components/version-panel";
import { VersionContextMenu } from "@/components/version-context-menu";
import { ShareVersionDialog } from "@/components/share-version-dialog";
import { BranchActionsMenu } from "@/components/branch-actions-menu";
import { DeleteVersionDialog } from "@/components/delete-version-dialog";
import { DeleteBranchDialog } from "@/components/delete-branch-dialog";
import { Interactions } from "@/components/interactions";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { FlpAccess } from "@/components/flp-access";
import { Eyebrow, Panel, StatusBadge } from "@/components/ui";

/**
 * The project page body: timeline tree panel + detail panel + player bar.
 * Used by both the owner dashboard page and the public project page —
 * `isOwner` gates editing/sharing; RLS gates the data underneath either way.
 */
export function ProjectView({
  projectId,
  isOwner,
  headerActions,
}: {
  projectId: string;
  isOwner: boolean;
  headerActions?: React.ReactNode;
}) {
  const { project, branches, versions, loading, refetch } =
    useProject(projectId);
  const player = usePlayer();
  const [selected, setSelected] = useState<Version | null>(null);
  const [view, setView] = useState<"tree" | "graph">("tree");
  const [menu, setMenu] = useState<{ version: Version; x: number; y: number } | null>(
    null
  );
  const [deleting, setDeleting] = useState<Version | null>(null);
  const [sharingVersion, setSharingVersion] = useState<Version | null>(null);
  const [branchMenu, setBranchMenu] = useState<{
    branch: Branch;
    x: number;
    y: number;
  } | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (localStorage.getItem("sangit-timeline-view") === "graph")
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unavailable during SSR; restore preference post-mount
      setView("graph");
  }, []);

  function switchView(next: "tree" | "graph") {
    setView(next);
    localStorage.setItem("sangit-timeline-view", next);
  }

  // Keep the selected version fresh across realtime refetches (e.g. a
  // processing node flipping to ready), and default to the Main version.
  // Adjust-during-render: the guards make this settle in one extra pass.
  if (selected) {
    const updated = versions.find((v) => v.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  } else if (project?.main_version_id) {
    const main = versions.find((v) => v.id === project.main_version_id);
    if (main) setSelected(main);
  }

  const setMain = useCallback(
    async (v: Version) => {
      const supabase = createClient();
      await supabase
        .from("projects")
        .update({ main_version_id: v.id })
        .eq("id", projectId);
      refetch();
    },
    [projectId, refetch]
  );

  // The player queue for this project: every version in chronological order,
  // each carrying its branch name + the owner/listener meta. Fed to the shared
  // <PlayerProvider> so playback survives navigation to/from the dashboard.
  const mainVersionId = project?.main_version_id ?? null;
  const projectQueue = useMemo<PlayerTrack[]>(() => {
    if (!project) return [];
    return versions.map((v) => ({
      version: v,
      meta: {
        projectId: project.id,
        projectTitle: project.title,
        artworkUrl: project.artwork_url,
        isOwner,
        mainVersionId,
        branchName: branches.find((b) => b.id === v.branch_id)?.name ?? null,
        onSetMain: isOwner ? setMain : undefined,
        favoriteProjectId: isOwner ? undefined : project.id,
      },
    }));
  }, [project, versions, branches, isOwner, mainVersionId, setMain]);

  // Keep the live queue fresh (Set-as-Main, a render finishing) without
  // restarting audio; only re-homes prev/next if this project owns the
  // playing track. Separately, cue the Main version on a fresh visit — a
  // no-op if something is already playing (e.g. carried in from the dashboard).
  const { syncQueue, cue } = player;
  useEffect(() => {
    syncQueue(projectQueue);
  }, [projectQueue, syncQueue]);
  useEffect(() => {
    const mainIdx = projectQueue.findIndex((t) => t.version.id === mainVersionId);
    if (mainIdx >= 0) cue(projectQueue, mainIdx);
  }, [projectQueue, mainVersionId, cue]);

  /** Tree/graph node click: reflect it in the detail panels and start playing. */
  const selectAndPlay = useCallback(
    (v: Version) => {
      setSelected(v);
      const i = projectQueue.findIndex((t) => t.version.id === v.id);
      if (i >= 0) player.play(projectQueue, i);
    },
    [projectQueue, player]
  );

  // Producer-only like stats: per-version counts + project total, and the
  // most-liked version (max count; ties broken by most-recent upload; null
  // when nothing's been liked yet).
  const versionIds = useMemo(() => versions.map((v) => v.id), [versions]);
  const { likesByVersion, total: totalLikes } = useProjectLikes(
    projectId,
    versionIds,
    isOwner
  );
  const mostLikedId = useMemo(() => {
    let max = 0;
    for (const c of likesByVersion.values()) if (c > max) max = c;
    if (max === 0) return null;
    const tied = versions
      .filter((v) => (likesByVersion.get(v.id) ?? 0) === max)
      .sort((a, b) => +new Date(b.uploaded_at) - +new Date(a.uploaded_at));
    return tied[0]?.id ?? null;
  }, [likesByVersion, versions]);

  function promoteMostLiked() {
    const v = versions.find((x) => x.id === mostLikedId);
    if (v) setMain(v);
  }

  /** After a delete, move selection to the chronologically previous version
   *  (versions arrive sorted by uploaded_at), falling back forward, then none. */
  function onVersionDeleted(deleted: Version) {
    if (selected?.id === deleted.id) {
      const i = versions.findIndex((v) => v.id === deleted.id);
      const next = versions[i - 1] ?? versions[i + 1] ?? null;
      setSelected(next);
    }
    setDeleting(null);
    refetch();
  }

  const versionsOn = (branchId: string) =>
    versions.filter((v) => v.branch_id === branchId);
  // A branch's tip = its most recent version (versions arrive sorted asc by
  // uploaded_at), i.e. the version "Set as Main" on a branch stars.
  const branchTip = (branchId: string): Version | null => {
    const list = versionsOn(branchId);
    return list.length ? list[list.length - 1] : null;
  };
  function setBranchMain(branch: Branch) {
    const tip = branchTip(branch.id);
    if (tip) setMain(tip); // stars this take's latest version
  }

  function onBranchDeleted() {
    setSelected(null); // versions on that branch are gone; fall back to Main/none
    setDeletingBranch(null);
    refetch();
  }

  if (loading) {
    return <p className="py-16 text-center text-body-sm text-ink-subtle">Loading…</p>;
  }
  if (!project) {
    return (
      <p className="py-16 text-center text-body-sm text-ink-subtle">
        Project not found.
      </p>
    );
  }

  return (
    <div className="pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-5">
          {isOwner ? (
            <ArtworkUploader
              projectId={project.id}
              artworkUrl={project.artwork_url}
              title={project.title}
              onChanged={refetch}
            />
          ) : (
            <ProjectArtwork
              projectId={project.id}
              artworkUrl={project.artwork_url}
              title={project.title}
              className="h-32 w-32 shrink-0 border border-hairline"
            />
          )}
          <div className="min-w-0">
            <Eyebrow>Project</Eyebrow>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-headline text-ink">
                {project.title}
              </h1>
              {/* Owner-only: the visibility tag is a dashboard cue for the
                  producer. Visitors on /p/[slug] never see it (they only
                  reach public projects anyway, so it would always read
                  "public" — redundant). Matches the /u/[username] profile. */}
              {isOwner &&
                (project.is_public ? (
                  <StatusBadge tone="success">public</StatusBadge>
                ) : (
                  <StatusBadge>private</StatusBadge>
                ))}
              <FavoriteButton projectId={project.id} />
            </div>
            <p className="mt-1 text-body-sm text-ink-subtle">
              {branches.length} branch{branches.length === 1 ? "" : "es"} ·{" "}
              {versions.length} version{versions.length === 1 ? "" : "s"}
            </p>
            {isOwner && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span
                  className="flex items-center gap-1.5 text-body-sm text-ink-subtle"
                  title="Total likes across all versions"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="var(--primary)"
                    aria-hidden
                  >
                    <path d="M8 13.6S2.4 9.9 2.4 6.2c0-1.9 1.5-3.4 3.2-3.4 1 0 1.9.5 2.4 1.3.5-.8 1.4-1.3 2.4-1.3 1.7 0 3.2 1.5 3.2 3.4 0 3.7-5.6 7.4-5.6 7.4z" />
                  </svg>
                  {totalLikes} like{totalLikes === 1 ? "" : "s"}
                </span>
                {mostLikedId && mostLikedId !== project.main_version_id && (
                  <button
                    onClick={promoteMostLiked}
                    className="font-mono text-caption text-primary underline-offset-2 hover:underline"
                    title="Promote the most-liked version to Main"
                  >
                    Set most-liked as Main
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <ShareButton
              projectId={project.id}
              versionId={selected?.id ?? null}
              showHistory={project.show_history}
            />
          )}
          {headerActions}
        </div>
      </div>

      <Panel className="mt-8 overflow-hidden">
        <div className="mb-6 flex items-center justify-between">
          <Eyebrow>Timeline</Eyebrow>
          <div className="flex gap-1" role="tablist" aria-label="Timeline view">
            {(["tree", "graph"] as const).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={view === mode}
                onClick={() => switchView(mode)}
                className={cn(
                  "border px-3.5 py-1.5 text-button capitalize transition-colors",
                  view === mode
                    ? "border-hairline-strong bg-surface-2 text-ink"
                    : "border-transparent text-ink-subtle hover:text-ink"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {view === "graph" ? (
          <VersionGraph
            branches={branches}
            versions={versions}
            mainVersionId={project.main_version_id}
            selectedId={selected?.id ?? null}
            onSelect={selectAndPlay}
            onNodeContextMenu={
              isOwner ? (v, x, y) => setMenu({ version: v, x, y }) : undefined
            }
            likesByVersion={isOwner ? likesByVersion : undefined}
            mostLikedId={isOwner ? mostLikedId : null}
          />
        ) : (
          <TimelineTree
            branches={branches}
            versions={versions}
            mainVersionId={project.main_version_id}
            selectedId={selected?.id ?? null}
            onSelect={selectAndPlay}
            onNodeContextMenu={
              isOwner ? (v, x, y) => setMenu({ version: v, x, y }) : undefined
            }
            onBranchLabelClick={
              isOwner ? (b, x, y) => setBranchMenu({ branch: b, x, y }) : undefined
            }
            likesByVersion={isOwner ? likesByVersion : undefined}
            mostLikedId={isOwner ? mostLikedId : null}
          />
        )}
      </Panel>

      {menu && (
        <VersionContextMenu
          x={menu.x}
          y={menu.y}
          isMain={menu.version.id === project.main_version_id}
          onSetMain={() => setMain(menu.version)}
          onShare={() => setSharingVersion(menu.version)}
          onDelete={() => setDeleting(menu.version)}
          onClose={() => setMenu(null)}
        />
      )}

      {sharingVersion && (
        <ShareVersionDialog
          projectId={project.id}
          version={{
            id: sharingVersion.id,
            name: sharingVersion.display_name || sharingVersion.file_name,
          }}
          onClose={() => setSharingVersion(null)}
        />
      )}

      {deleting && (
        <DeleteVersionDialog
          version={deleting}
          isMain={deleting.id === project.main_version_id}
          isLastOnBranch={
            versions.filter((v) => v.branch_id === deleting.branch_id).length === 1
          }
          branchName={
            branches.find((b) => b.id === deleting.branch_id)?.name ?? "this branch"
          }
          onClose={() => setDeleting(null)}
          onDeleted={() => onVersionDeleted(deleting)}
        />
      )}

      {branchMenu && (
        <BranchActionsMenu
          x={branchMenu.x}
          y={branchMenu.y}
          isMain={branchTip(branchMenu.branch.id)?.id === project.main_version_id}
          canDelete={branchMenu.branch.parent_branch_id !== null}
          onSetMain={() => setBranchMain(branchMenu.branch)}
          onDelete={() => setDeletingBranch(branchMenu.branch)}
          onClose={() => setBranchMenu(null)}
        />
      )}

      {deletingBranch && (
        <DeleteBranchDialog
          branch={deletingBranch}
          versionCount={versionsOn(deletingBranch.id).length}
          hasMainVersion={versionsOn(deletingBranch.id).some(
            (v) => v.id === project.main_version_id
          )}
          onClose={() => setDeletingBranch(null)}
          onDeleted={onBranchDeleted}
        />
      )}

      {selected && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VersionPanel
            version={selected}
            isOwner={isOwner}
            mainVersionId={project.main_version_id}
            onChanged={refetch}
            onRequestDelete={isOwner ? () => setDeleting(selected) : undefined}
            accessTab={isOwner ? <FlpAccess projectId={project.id} /> : undefined}
            likeCount={isOwner ? likesByVersion.get(selected.id) ?? 0 : undefined}
            isMostLiked={isOwner && selected.id === mostLikedId}
            onSetMain={isOwner ? () => setMain(selected) : undefined}
          />
          <Interactions versionId={selected.id} />
        </div>
      )}

    </div>
  );
}

/**
 * Owner-only artwork block: hover (or keyboard focus) reveals an upload
 * affordance; picking a file reuses the public-images upload flow and writes
 * `projects.artwork_url` via RLS, then refetches so the new art shows up
 * everywhere at once.
 */
function ArtworkUploader({
  projectId,
  artworkUrl,
  title,
  onChanged,
}: {
  projectId: string;
  artworkUrl: string | null;
  title: string;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPublicImage("artwork", file, {
        projectId,
        previousUrl: artworkUrl,
      });
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("projects")
        .update({ artwork_url: url })
        .eq("id", projectId);
      if (dbError) throw new Error(dbError.message);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setUploading(false);
  }

  return (
    <div className="w-32 shrink-0">
      <label className="group relative block h-32 w-32 cursor-pointer">
        <ProjectArtwork
          projectId={projectId}
          artworkUrl={artworkUrl}
          title={title}
          className="h-full w-full border border-hairline"
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-canvas/70 text-button text-ink transition-opacity",
            uploading
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          {uploading ? "Uploading…" : artworkUrl ? "Change" : "Upload"}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {error && <p className="mt-1 text-caption text-primary">{error}</p>}
    </div>
  );
}
