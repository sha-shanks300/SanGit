"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/lib/use-project";
import { uploadPublicImage } from "@/lib/image-upload";
import type { Version } from "@/lib/database.types";
import { ProjectArtwork } from "@/components/project-artwork";
import { TimelineTree } from "@/components/timeline-tree";
import { VersionGraph } from "@/components/version-graph";
import { cn } from "@/lib/utils";
import { PlayerBar } from "@/components/player";
import { VersionPanel } from "@/components/version-panel";
import { VersionContextMenu } from "@/components/version-context-menu";
import { DeleteVersionDialog } from "@/components/delete-version-dialog";
import { Interactions } from "@/components/interactions";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareManager } from "@/components/share-manager";
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
  const [selected, setSelected] = useState<Version | null>(null);
  const [view, setView] = useState<"tree" | "graph">("tree");
  const [menu, setMenu] = useState<{ version: Version; x: number; y: number } | null>(
    null
  );
  const [deleting, setDeleting] = useState<Version | null>(null);

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

  async function setMain(v: Version) {
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ main_version_id: v.id })
      .eq("id", projectId);
    refetch();
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
          </div>
        </div>
        <div className="flex items-center gap-2">{headerActions}</div>
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
            onSelect={setSelected}
            onNodeContextMenu={
              isOwner ? (v, x, y) => setMenu({ version: v, x, y }) : undefined
            }
          />
        ) : (
          <TimelineTree
            branches={branches}
            versions={versions}
            mainVersionId={project.main_version_id}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onNodeContextMenu={
              isOwner ? (v, x, y) => setMenu({ version: v, x, y }) : undefined
            }
          />
        )}
      </Panel>

      {menu && (
        <VersionContextMenu
          x={menu.x}
          y={menu.y}
          isMain={menu.version.id === project.main_version_id}
          onSetMain={() => setMain(menu.version)}
          onDelete={() => setDeleting(menu.version)}
          onClose={() => setMenu(null)}
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

      {selected && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VersionPanel
            version={selected}
            isOwner={isOwner}
            mainVersionId={project.main_version_id}
            onChanged={refetch}
            onRequestDelete={isOwner ? () => setDeleting(selected) : undefined}
          >
            {isOwner && (
              <>
                <ShareManager versionId={selected.id} projectId={project.id} />
                <FlpAccess projectId={project.id} />
              </>
            )}
          </VersionPanel>
          <Interactions versionId={selected.id} />
        </div>
      )}

      <PlayerBar
        version={selected}
        versions={versions}
        isOwner={isOwner}
        mainVersionId={project.main_version_id}
        onSelect={setSelected}
        onSetMain={isOwner ? setMain : undefined}
        favoriteProjectId={isOwner ? undefined : project.id}
        artwork={{
          projectId: project.id,
          title: project.title,
          artworkUrl: project.artwork_url,
        }}
      />
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
