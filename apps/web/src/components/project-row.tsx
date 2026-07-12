import Link from "next/link";
import type { Project } from "@/lib/database.types";
import { StatusBadge } from "@/components/ui";
import { FavoriteButton } from "@/components/favorite-button";
import { artworkFallback, formatDate } from "@/lib/utils";

export type ProjectRowData = Project & {
  versions?: { count: number }[];
  branches?: { count: number }[];
  /** Single most-recent version (aliased ordered+limited embed). */
  latest?: { uploaded_at: string }[];
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
}: {
  project: ProjectRowData;
  href: string;
  showVisibility?: boolean;
}) {
  const branches = project.branches?.[0]?.count;
  const versions = project.versions?.[0]?.count;
  return (
    <Link
      href={href}
      className="flex items-stretch rounded-lg border border-hairline bg-surface-1 transition-colors hover:border-hairline-strong hover:bg-surface-2"
    >
      <div
        className="h-24 w-24 shrink-0 overflow-hidden border-r border-hairline"
        style={
          project.artwork_url ? undefined : { background: artworkFallback(project.id) }
        }
      >
        {project.artwork_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
          <img
            src={project.artwork_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-headline text-ink-muted">
            {project.title.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
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
