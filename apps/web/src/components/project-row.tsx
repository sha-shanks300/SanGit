import Link from "next/link";
import type { Project, Version } from "@/lib/database.types";
import { StatusBadge } from "@/components/ui";
import { FavoriteButton } from "@/components/favorite-button";
import { ProjectArtwork } from "@/components/project-artwork";
import { ArtworkPlayButton } from "@/components/artwork-play-button";
import type { PlayerTrack } from "@/components/player-context";
import { formatDate } from "@/lib/utils";

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
 */
export function ProjectRow({
  project,
  href,
  showVisibility = true,
  playQueue,
  playIndex = -1,
}: {
  project: ProjectRowData;
  href: string;
  showVisibility?: boolean;
  /** Cross-project queue of ready Main tracks — enables the hover-play overlay
   *  (dashboard only; omitted on profile pages that have no player). */
  playQueue?: PlayerTrack[];
  /** This project's index in `playQueue`, or -1 if its Main isn't playable. */
  playIndex?: number;
}) {
  const branches = project.branches?.[0]?.count;
  const versions = project.versions?.[0]?.count;
  const artworkClass = "h-24 w-24 shrink-0 border-r border-hairline";
  return (
    <Link
      href={href}
      className="flex items-stretch rounded-lg border border-hairline bg-surface-1 transition-colors hover:border-hairline-strong hover:bg-surface-2"
    >
      {playQueue && playIndex >= 0 ? (
        <ArtworkPlayButton
          projectId={project.id}
          artworkUrl={project.artwork_url}
          title={project.title}
          queue={playQueue}
          queueIndex={playIndex}
          className={artworkClass}
        />
      ) : (
        <ProjectArtwork
          projectId={project.id}
          artworkUrl={project.artwork_url}
          title={project.title}
          className={artworkClass}
        />
      )}
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
    </Link>
  );
}
