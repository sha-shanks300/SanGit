import Link from "next/link";
import type { Project, Version } from "@/lib/database.types";
import { StatusBadge } from "@/components/ui";
import { FavoriteButton } from "@/components/favorite-button";
import { ProjectArtwork } from "@/components/project-artwork";
import { ArtworkPlayButton } from "@/components/artwork-play-button";
import { OpenInPlaceLink } from "@/components/open-in-place-link";
import type { PlayerTrack } from "@/components/player-context";
import { cn, formatDate } from "@/lib/utils";

export type ProjectRowData = Project & {
  versions?: { count: number }[];
  branches?: { count: number }[];
  /** Single most-recent version (aliased ordered+limited embed). */
  latest?: { uploaded_at: string }[];
  /** The Main version row (embed via projects_main_version_fk), for hover-play. */
  main?: Version | null;
};

/**
 * Full-width horizontal track row (SoundCloud-style): artwork left, title +
 * stats right, favourite star at the far edge. Artwork falls back to a
 * deterministic greyscale gradient + initial.
 *
 * `variant="listener"` (the public profile) swaps in a compact, Spotify-sized
 * row on mobile — smaller cover that fills the row height, title + release date,
 * star on the right, and no branch/version counts (a listener doesn't care how
 * many branches a track has). At `sm:`+ the listener falls back to the same
 * full row as the owner, so only the phone view changes.
 */
export function ProjectRow({
  project,
  href,
  showVisibility = true,
  playQueue,
  playIndex = -1,
  variant = "owner",
  openInPlace = false,
}: {
  project: ProjectRowData;
  href: string;
  showVisibility?: boolean;
  /** Cross-project queue of ready Main tracks — enables the hover-play overlay
   *  (dashboard only; omitted on profile pages that have no player). */
  playQueue?: PlayerTrack[];
  /** This project's index in `playQueue`, or -1 if its Main isn't playable. */
  playIndex?: number;
  /** "listener" gets the compact mobile row (public profile); default keeps the
   *  full stats row everywhere (owner dashboard). */
  variant?: "owner" | "listener";
  /** Main-only projects: a left-click expands the now-playing surface in place
   *  rather than loading /p/[slug], which would only re-render that same
   *  surface. `href` still backs new-tab and copy-link. Needs `playQueue`. */
  openInPlace?: boolean;
}) {
  const branches = project.branches?.[0]?.count;
  const versions = project.versions?.[0]?.count;
  const listener = variant === "listener";
  // Release = the current track's date (latest version), falling back to the
  // project's creation for projects with no versions embedded.
  const releaseDate = project.latest?.[0]?.uploaded_at ?? project.created_at;

  const artwork = (className: string, activeIndicator = false) =>
    playQueue && playIndex >= 0 ? (
      <ArtworkPlayButton
        projectId={project.id}
        artworkUrl={project.artwork_url}
        title={project.title}
        queue={playQueue}
        queueIndex={playIndex}
        className={className}
        activeIndicator={activeIndicator}
      />
    ) : (
      <ProjectArtwork
        projectId={project.id}
        artworkUrl={project.artwork_url}
        title={project.title}
        className={className}
      />
    );

  const rowClassName =
    "block rounded-lg border border-hairline bg-surface-1 transition-colors hover:border-hairline-strong hover:bg-surface-2";

  const body = (
    <>
      {/* Compact listener row — mobile only. Fixed height so the square cover
          fills it edge to edge (no leftover space beside the art). */}
      {listener && (
        <div className="flex h-[68px] items-stretch sm:hidden">
          {artwork("h-full aspect-square shrink-0 border-r border-hairline", true)}
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5">
            <div className="min-w-0">
              <h2 className="truncate text-body-sm font-medium text-ink">
                {project.title}
              </h2>
              <p className="mt-0.5 font-mono text-caption text-ink-tertiary">
                {formatDate(releaseDate)}
              </p>
            </div>
            <FavoriteButton projectId={project.id} compact />
          </div>
        </div>
      )}

      {/* Full stats row — owner at every size; listener at sm:+ only. */}
      <div
        className={cn("flex items-stretch", listener && "hidden sm:flex")}
      >
        {artwork("h-24 w-24 shrink-0 border-r border-hairline")}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-card-title font-medium text-ink">
                {project.title}
              </h2>
              {showVisibility &&
                (project.is_public ? (
                  <StatusBadge tone="success">public</StatusBadge>
                ) : (
                  <StatusBadge>private</StatusBadge>
                ))}
            </div>
            {branches != null && versions != null && (
              <p className="mt-1 text-body-sm text-ink-subtle">
                {branches} branch{branches === 1 ? "" : "es"} · {versions} version
                {versions === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <p className="hidden text-caption text-ink-tertiary sm:block">
              Updated {formatDate(project.updated_at)}
            </p>
            <FavoriteButton projectId={project.id} compact />
          </div>
        </div>
      </div>
    </>
  );

  // Main-only rows expand the now-playing surface in place; every other row
  // navigates. Both are real links, so the href still backs new-tab/copy-link.
  return openInPlace && playQueue ? (
    <OpenInPlaceLink
      href={href}
      queue={playQueue}
      queueIndex={playIndex}
      className={rowClassName}
    >
      {body}
    </OpenInPlaceLink>
  ) : (
    <Link href={href} className={rowClassName}>
      {body}
    </Link>
  );
}
