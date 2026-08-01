"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, StatusBadge } from "@/components/ui";
import { ProjectArtwork } from "@/components/project-artwork";
import { FavoriteButton } from "@/components/favorite-button";
import {
  defaultInteractionsApi,
  type InteractionsApi,
} from "@/components/interactions";
import {
  usePlayer,
  usePlayerProgress,
  type PlayerTrack,
} from "@/components/player-context";
import { cn, formatDuration } from "@/lib/utils";

/**
 * Persistent bottom player — pure presentation over the {@link usePlayer}
 * context (all audio/transport/queue state lives in <PlayerProvider>). Renders
 * nothing until a track is loaded.
 *
 * Desktop (`sm:`+) is the full bar (transport, artwork, seek, loop, volume,
 * audience actions); below that a Spotify-style mini-bar that expands into a
 * full-screen now-playing sheet (chevron or swipe-down to close).
 */
export function PlayerBar() {
  const player = usePlayer();
  const { time, duration } = usePlayerProgress();
  const [expanded, setExpanded] = useState(false);
  // Swipe-down dismissal: the sheet tracks the drag offset and either closes
  // past the threshold or springs back. `dragging` (state, not the ref —
  // render reads it) suppresses the spring-back transition mid-drag.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<number | null>(null);

  const track = player.current;
  // The sheet has nothing to show without a track.
  if (!track && expanded) setExpanded(false);
  if (!track) return null;

  const { version, meta } = track;
  const playable = version.render_status === "ready";
  const { playing, buffering } = player;
  const api = meta.interactionsApi ?? defaultInteractionsApi;
  const artwork = {
    projectId: meta.projectId,
    title: meta.projectTitle,
    artworkUrl: meta.artworkUrl,
  };

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    player.seekTo(Number(e.target.value) / 1000);
  }
  const seekValue = duration ? Math.round((time / duration) * 1000) : 0;

  // Swipe-down on the sheet's non-interactive surface. Interactive children
  // (seek slider, buttons) keep their own touch behavior.
  function onSheetTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest("input,button,a")) return;
    dragStartRef.current = e.touches[0].clientY;
    setDragging(true);
  }
  function onSheetTouchMove(e: React.TouchEvent) {
    if (dragStartRef.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStartRef.current));
  }
  function onSheetTouchEnd() {
    if (dragStartRef.current == null) return;
    dragStartRef.current = null;
    setDragging(false);
    if (dragY > 120) setExpanded(false);
    setDragY(0);
  }

  const statusBadge =
    version.render_status === "pending" || version.render_status === "rendering" ? (
      <StatusBadge tone="processing">processing</StatusBadge>
    ) : version.render_status === "failed" ? (
      <StatusBadge>render failed</StatusBadge>
    ) : null;

  return (
    <>
      {/* The sheet must NOT live inside this bar: backdrop-blur makes the bar
          a containing block for fixed descendants, which would trap the
          "inset-0" overlay inside the strip. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface-1/95 backdrop-blur">
        <div className="mx-auto hidden h-[72px] max-w-[1280px] items-center gap-4 px-6 sm:flex">
          {/* transport */}
          <div className="flex items-center gap-1">
            <button
              className="rounded-md p-2 text-ink-subtle hover:text-ink disabled:opacity-40"
              onClick={player.prev}
              disabled={!player.hasPrev}
              aria-label="Previous"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2h2v12H4zM13 2v12L6.5 8z" />
              </svg>
            </button>
            <PlayToggle
              playing={playing}
              buffering={buffering}
              playable={playable}
              onClick={player.toggle}
              size="md"
            />
            <button
              className="rounded-md p-2 text-ink-subtle hover:text-ink disabled:opacity-40"
              onClick={player.next}
              disabled={!player.hasNext}
              aria-label="Next"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10 2h2v12h-2zM3 2v12l6.5-6z" />
              </svg>
            </button>
          </div>

          {/* artwork */}
          <ProjectArtwork
            projectId={artwork.projectId}
            artworkUrl={artwork.artworkUrl}
            title={artwork.title}
            className="h-12 w-12 shrink-0 border border-hairline"
            initialClassName="text-body-sm"
          />

          {/* track info + seek */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-body-sm text-ink">
                {version.display_name || version.file_name}
              </p>
              {version.id === meta.mainVersionId && (
                <StatusBadge tone="accent">Main</StatusBadge>
              )}
              {statusBadge}
            </div>
            <p className="truncate font-mono text-caption text-ink-tertiary">
              {meta.projectTitle}
              {meta.branchName ? ` · ${meta.branchName}` : ""}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="w-10 text-right font-mono text-mono text-ink-tertiary">
                {formatDuration(time)}
              </span>
              <SeekSlider value={seekValue} onChange={seek} disabled={!playable} />
              <span className="w-10 font-mono text-mono text-ink-tertiary">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* enjoyment: loop + volume */}
          <LoopButton on={player.loop} onClick={player.toggleLoop} />
          <VolumeControl
            volume={player.volume}
            muted={player.muted}
            onVolume={player.setVolume}
            onToggleMute={player.toggleMute}
          />

          {/* audience actions: owner management vs. listener social */}
          <div className="flex items-center gap-1">
            {meta.isOwner
              ? meta.onSetMain &&
                version.id !== meta.mainVersionId && (
                  <Button variant="secondary" onClick={() => meta.onSetMain!(version)}>
                    Set as Main
                  </Button>
                )
              : (
                <>
                  <LikeHeart versionId={version.id} api={api} />
                  {meta.favoriteProjectId && (
                    <FavoriteButton projectId={meta.favoriteProjectId} bare />
                  )}
                </>
              )}
          </div>
        </div>

        {/* Mobile mini-bar — tap to expand into the now-playing sheet. */}
        <div
          className="relative flex h-14 items-center gap-3 px-4 sm:hidden"
          onClick={() => setExpanded(true)}
          role="button"
          aria-label="Open now playing"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-surface-3">
            <div
              className="h-full bg-primary"
              style={{ width: duration ? `${(time / duration) * 100}%` : 0 }}
            />
          </div>
          <ProjectArtwork
            projectId={artwork.projectId}
            artworkUrl={artwork.artworkUrl}
            title={artwork.title}
            className="h-10 w-10 shrink-0 border border-hairline"
            initialClassName="text-body-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm text-ink">
              {version.display_name || version.file_name}
            </p>
            <p className="font-mono text-caption text-ink-tertiary">
              {formatDuration(time)} / {formatDuration(duration)}
            </p>
          </div>
          <PlayToggle
            playing={playing}
            buffering={buffering}
            playable={playable}
            onClick={(e) => {
              e.stopPropagation();
              player.toggle();
            }}
            size="sm"
          />
        </div>
      </div>

      {/* Full-screen now-playing sheet (mobile only) — sibling of the bar,
          see the containing-block note above. */}
      {expanded && (
        <div
          className={cn(
            "fixed inset-0 z-[60] flex flex-col bg-canvas px-6 pb-10 sm:hidden",
            !dragging && "transition-transform duration-200"
          )}
          style={{ transform: `translateY(${dragY}px)` }}
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
          onTouchEnd={onSheetTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
        >
          <button
            className="self-center p-4 text-ink-subtle"
            onClick={() => setExpanded(false)}
            aria-label="Close player"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7.5l6 5 6-5" />
            </svg>
          </button>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
            <ProjectArtwork
              projectId={artwork.projectId}
              artworkUrl={artwork.artworkUrl}
              title={artwork.title}
              className="aspect-square w-full max-w-[320px] border border-hairline"
              initialClassName="text-display-md"
            />

            <div className="w-full max-w-[400px]">
              {/* Anchored title row: track info left, borderless actions
                  (heart + role-dependent second icon) right. */}
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <p className="truncate text-card-title text-ink">
                    {version.display_name || version.file_name}
                  </p>
                  {version.id === meta.mainVersionId && (
                    <StatusBadge tone="accent" className="shrink-0">
                      Main
                    </StatusBadge>
                  )}
                  {statusBadge && <span className="shrink-0">{statusBadge}</span>}
                </div>
                <div className="flex shrink-0 items-center">
                  <LikeHeart versionId={version.id} api={api} />
                  {meta.isOwner && meta.onSetMain ? (
                    <MainToggle
                      version={version}
                      mainVersionId={meta.mainVersionId}
                      onSetMain={meta.onSetMain}
                    />
                  ) : meta.favoriteProjectId ? (
                    <FavoriteButton projectId={meta.favoriteProjectId} bare />
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <span className="w-10 text-right font-mono text-mono text-ink-tertiary">
                  {formatDuration(time)}
                </span>
                <SeekSlider value={seekValue} onChange={seek} disabled={!playable} />
                <span className="w-10 font-mono text-mono text-ink-tertiary">
                  {formatDuration(duration)}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-center gap-6">
                <button
                  className="p-3 text-ink-subtle disabled:opacity-40"
                  onClick={player.prev}
                  disabled={!player.hasPrev}
                  aria-label="Previous"
                >
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 2h2v12H4zM13 2v12L6.5 8z" />
                  </svg>
                </button>
                <PlayToggle
                  playing={playing}
                  buffering={buffering}
                  playable={playable}
                  onClick={player.toggle}
                  size="lg"
                />
                <button
                  className="p-3 text-ink-subtle disabled:opacity-40"
                  onClick={player.next}
                  disabled={!player.hasNext}
                  aria-label="Next"
                >
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M10 2h2v12h-2zM3 2v12l6.5-6z" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center">
                <LoopButton on={player.loop} onClick={player.toggleLoop} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Play/pause circle with a buffering spinner. Rosso when playable. */
function PlayToggle({
  playing,
  buffering,
  playable,
  onClick,
  size,
}: {
  playing: boolean;
  buffering: boolean;
  playable: boolean;
  onClick: (e: React.MouseEvent) => void;
  size: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "h-14 w-14" : size === "md" ? "h-10 w-10" : "h-10 w-10";
  const icon = size === "lg" ? 18 : 14;
  return (
    <button
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        box,
        playable ? "bg-primary text-white hover:bg-primary-hover" : "bg-surface-3 text-ink-tertiary"
      )}
      onClick={onClick}
      disabled={!playable}
      aria-label={playing ? "Pause" : "Play"}
    >
      {buffering ? (
        <svg className="animate-spin" width={icon} height={icon} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : playing ? (
        <svg width={icon} height={icon} viewBox="0 0 14 14" fill="currentColor">
          <path d="M2 1h4v12H2zM8 1h4v12H8z" />
        </svg>
      ) : (
        <svg width={icon} height={icon} viewBox="0 0 14 14" fill="currentColor">
          <path d="M3 1l10 6-10 6z" />
        </svg>
      )}
    </button>
  );
}

/** Shared seek range — sharp track, Rosso fill, yellow focus ring. */
function SeekSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="range"
      min={0}
      max={1000}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-(--primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e500]"
      aria-label="Seek"
    />
  );
}

/** Repeat-one toggle — tinted Rosso when on. */
function LoopButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Repeat on" : "Repeat off"}
      title="Repeat one"
      className={cn(
        "rounded-md p-2 transition-colors",
        on ? "text-primary" : "text-ink-subtle hover:text-ink"
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 3h6a3 3 0 0 1 3 3v1M12 13H6a3 3 0 0 1-3-3V9" strokeLinecap="round" />
        <path d="M11 1.5 13 3l-2 1.5M5 14.5 3 13l2-1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Mute button + level slider (desktop only). */
function VolumeControl({
  volume,
  muted,
  onVolume,
  onToggleMute,
}: {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}) {
  const level = muted ? 0 : volume;
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
        className="rounded-md p-2 text-ink-subtle transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 6h2.5L9 3v10L5.5 10H3z" />
          {level === 0 ? (
            <path d="M11 6l3 3M14 6l-3 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          ) : (
            <path
              d={level < 0.5 ? "M11 6a3 3 0 0 1 0 4" : "M11 5a4.5 4.5 0 0 1 0 6M11 6a3 3 0 0 1 0 4"}
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(level * 100)}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-surface-3 accent-(--primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e500]"
        aria-label="Volume"
      />
    </div>
  );
}

/**
 * Heart-like — same snapshot/toggle plumbing as the Interactions panel
 * (sign-in required; disabled for anonymous viewers).
 */
function LikeHeart({
  versionId,
  api,
}: {
  versionId: string;
  api: InteractionsApi;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [mine, setMine] = useState(false);

  const refetch = useCallback(async () => {
    const snap = await api.fetch(versionId);
    setViewerId(snap.viewerId);
    setLikes(snap.likes);
    setMine(snap.mine);
  }, [api, versionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function toggle() {
    if (!viewerId) return;
    await api.toggleLike(versionId, !mine);
    refetch();
  }

  return (
    <button
      onClick={toggle}
      disabled={!viewerId}
      aria-pressed={mine}
      aria-label={mine ? "Unlike" : "Like"}
      className={cn(
        "flex items-center gap-1.5 p-2 text-body-sm transition-colors disabled:opacity-50",
        mine ? "text-ink" : "text-ink-subtle"
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill={mine ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M8 13.6S2.4 9.9 2.4 6.2c0-1.9 1.5-3.4 3.2-3.4 1 0 1.9.5 2.4 1.3.5-.8 1.4-1.3 2.4-1.3 1.7 0 3.2 1.5 3.2 3.4 0 3.7-5.6 7.4-5.6 7.4z" />
      </svg>
      {likes}
    </button>
  );
}

/**
 * Owner-only Main toggle for the sheet's action row: ring/target icon echoing
 * the tree's Main halo. Selected (filled, Rosso) when the playing version is
 * already Main — tapping then is a no-op.
 */
function MainToggle({
  version,
  mainVersionId,
  onSetMain,
}: {
  version: PlayerTrack["version"];
  mainVersionId: string | null;
  onSetMain: (v: PlayerTrack["version"]) => void;
}) {
  const isMain = version.id === mainVersionId;
  return (
    <button
      onClick={() => !isMain && onSetMain(version)}
      aria-pressed={isMain}
      aria-label={isMain ? "Current Main version" : "Set as Main"}
      className={cn("p-2 transition-colors", isMain ? "text-primary" : "text-ink-subtle")}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="6.5" />
        <circle cx="9" cy="9" r="2.5" fill={isMain ? "currentColor" : "none"} />
      </svg>
    </button>
  );
}
