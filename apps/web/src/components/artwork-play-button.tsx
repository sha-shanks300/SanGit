"use client";

import { ProjectArtwork } from "@/components/project-artwork";
import { usePlayer, type PlayerTrack } from "@/components/player-context";
import { cn } from "@/lib/utils";

/**
 * Dashboard artwork with a Spotify-style hover-play overlay: hovering dims the
 * cover and fades in a play/pause disc (pause when this track is the one
 * playing); off-hover it's just the cover. Rendered only where a player queue
 * exists (the dashboard grid) — elsewhere ProjectRow shows the plain artwork,
 * so this hook never runs outside a <PlayerProvider>.
 *
 * Lives inside a <Link> row, so the click is swallowed (preventDefault +
 * stopPropagation) instead of navigating into the project.
 */
export function ArtworkPlayButton({
  projectId,
  artworkUrl,
  title,
  queue,
  queueIndex,
  className,
}: {
  projectId: string;
  artworkUrl: string | null;
  title: string;
  /** Cross-project queue of ready Main tracks (dashboard order). */
  queue: PlayerTrack[];
  /** This project's index within `queue`. */
  queueIndex: number;
  className?: string;
}) {
  const player = usePlayer();
  const trackId = queue[queueIndex]?.version.id ?? null;
  const isActive = trackId != null && player.currentId === trackId;
  const isPlaying = isActive && player.playing;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isActive) player.toggle();
    else player.play(queue, queueIndex);
  }

  return (
    <div className={cn("group relative", className)}>
      <ProjectArtwork
        projectId={projectId}
        artworkUrl={artworkUrl}
        title={title}
        className="h-full w-full"
      />
      <button
        onClick={onClick}
        aria-label={isPlaying ? "Pause" : "Play Main"}
        className="absolute inset-0 flex items-center justify-center bg-canvas/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-canvas transition-transform group-hover:scale-105">
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2 1h4v12H2zM8 1h4v12H8z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1l10 6-10 6z" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
