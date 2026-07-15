"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Version } from "@/lib/database.types";
import { Button, StatusBadge } from "@/components/ui";
import { ProjectArtwork } from "@/components/project-artwork";
import { FavoriteButton } from "@/components/favorite-button";
import {
  defaultInteractionsApi,
  type InteractionsApi,
} from "@/components/interactions";
import { cn, formatDuration } from "@/lib/utils";

export type PlayerArtwork = {
  projectId: string;
  title: string;
  artworkUrl: string | null;
};

/**
 * Persistent bottom player. Streams short-lived signed URLs (refetched on
 * playback error when they expire). prev/next walk the chronological order
 * of the current branch lane, falling back across the whole project.
 *
 * Desktop (`sm:`+) renders the full-width bar; below that a Spotify-style
 * mini-bar that expands into a full-screen now-playing sheet (chevron or
 * swipe-down to close). The single <audio> element lives outside both, so
 * expanding/collapsing never interrupts playback.
 */
export function PlayerBar({
  version,
  versions,
  isOwner,
  mainVersionId,
  onSelect,
  onSetMain,
  audioUrlFor = (id: string) => `/api/audio/${id}`,
  extraControls,
  artwork,
  interactionsApi = defaultInteractionsApi,
  favoriteProjectId,
}: {
  version: Version | null;
  versions: Version[];
  isOwner: boolean;
  mainVersionId: string | null;
  onSelect: (v: Version) => void;
  onSetMain?: (v: Version) => void;
  audioUrlFor?: (id: string) => string;
  extraControls?: React.ReactNode;
  artwork?: PlayerArtwork;
  /** Like backend for the now-playing sheet (token routes on share pages). */
  interactionsApi?: InteractionsApi;
  /** Visitor star on the sheet favorites this project (RLS path — omit on
   *  token share pages, where favorites have no token route). */
  favoriteProjectId?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const retriedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  // Swipe-down dismissal: the sheet tracks the drag offset and either closes
  // past the threshold or springs back. `dragging` (state, not the ref —
  // render reads it) suppresses the spring-back transition mid-drag.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<number | null>(null);

  const playable = version?.render_status === "ready";

  const loadAndPlay = useCallback(
    async (autoplay: boolean) => {
      const audio = audioRef.current;
      if (!audio || !version || version.render_status !== "ready") return;
      try {
        const res = await fetch(audioUrlFor(version.id));
        if (!res.ok) return;
        const { url } = await res.json();
        audio.src = url;
        if (autoplay) await audio.play();
      } catch {
        /* leave the bar idle on failure */
      }
    },
    [version, audioUrlFor]
  );

  // Reset transport state when the track changes (adjust-during-render).
  const [prevVersionId, setPrevVersionId] = useState(version?.id ?? null);
  if (prevVersionId !== (version?.id ?? null)) {
    setPrevVersionId(version?.id ?? null);
    setTime(0);
    setDuration(version?.duration_secs ?? 0);
  }
  // The sheet has nothing to show without a track.
  if (!version && expanded) setExpanded(false);

  useEffect(() => {
    retriedRef.current = false;
    if (version) loadAndPlay(true);
    else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
    }
  }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Walk order: current branch lane first, whole project as fallback.
  const order = version
    ? versions.filter((v) => v.branch_id === version.branch_id)
    : versions;
  const idx = version ? order.findIndex((v) => v.id === version.id) : -1;
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else if (audio.src) audio.play().catch(() => loadAndPlay(true));
    else loadAndPlay(true);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const t = (Number(e.target.value) / 1000) * duration;
    audio.currentTime = t;
    setTime(t);
  }

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

  return (
    <>
    {/* The sheet must NOT live inside this bar: backdrop-blur makes the bar
        a containing block for fixed descendants, which would trap the
        "inset-0" overlay inside the 72px strip. */}
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface-1/95 backdrop-blur">
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => next && onSelect(next)}
        onError={() => {
          // Signed URL likely expired — refresh it once.
          if (!retriedRef.current && version) {
            retriedRef.current = true;
            loadAndPlay(playing);
          }
        }}
      />
      <div className="mx-auto hidden h-[72px] max-w-[1280px] items-center gap-4 px-6 sm:flex">
        {/* transport */}
        <div className="flex items-center gap-1">
          <button
            className="rounded-md p-2 text-ink-subtle hover:text-ink disabled:opacity-40"
            onClick={() => prev && onSelect(prev)}
            disabled={!prev}
            aria-label="Previous version"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2h2v12H4zM13 2v12L6.5 8z" />
            </svg>
          </button>
          <button
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              playable
                ? "bg-primary text-white hover:bg-primary-hover"
                : "bg-surface-3 text-ink-tertiary"
            )}
            onClick={togglePlay}
            disabled={!playable}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 1h4v12H2zM8 1h4v12H8z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1l10 6-10 6z" />
              </svg>
            )}
          </button>
          <button
            className="rounded-md p-2 text-ink-subtle hover:text-ink disabled:opacity-40"
            onClick={() => next && onSelect(next)}
            disabled={!next}
            aria-label="Next version"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 2h2v12h-2zM3 2v12l6.5-6z" />
            </svg>
          </button>
        </div>

        {/* track info + seek */}
        <div className="min-w-0 flex-1">
          {version ? (
            <>
              <div className="flex items-center gap-2">
                <p className="truncate text-body-sm text-ink">
                  {version.display_name || version.file_name}
                </p>
                {version.id === mainVersionId && (
                  <StatusBadge tone="accent">Main</StatusBadge>
                )}
                {version.render_status === "pending" ||
                version.render_status === "rendering" ? (
                  <StatusBadge tone="processing">processing</StatusBadge>
                ) : version.render_status === "failed" ? (
                  <StatusBadge>render failed</StatusBadge>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="w-10 text-right font-mono text-mono text-ink-tertiary">
                  {formatDuration(time)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={duration ? Math.round((time / duration) * 1000) : 0}
                  onChange={seek}
                  disabled={!playable}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-(--primary)"
                  aria-label="Seek"
                />
                <span className="w-10 font-mono text-mono text-ink-tertiary">
                  {formatDuration(duration)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-ink-tertiary">
              Select a version node to play it.
            </p>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2">
          {extraControls}
          {isOwner && version && onSetMain && version.id !== mainVersionId && (
            <Button variant="secondary" onClick={() => onSetMain(version)}>
              Set as Main
            </Button>
          )}
        </div>
      </div>

      {/* Mobile mini-bar — tap to expand into the now-playing sheet. */}
      <div
        className="relative flex h-14 items-center gap-3 px-4 sm:hidden"
        onClick={() => version && setExpanded(true)}
        role={version ? "button" : undefined}
        aria-label={version ? "Open now playing" : undefined}
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-surface-3">
          <div
            className="h-full bg-primary"
            style={{ width: duration ? `${(time / duration) * 100}%` : 0 }}
          />
        </div>
        {version ? (
          <>
            {artwork && (
              <ProjectArtwork
                projectId={artwork.projectId}
                artworkUrl={artwork.artworkUrl}
                title={artwork.title}
                className="h-10 w-10 shrink-0 border border-hairline"
                initialClassName="text-body-sm"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm text-ink">
                {version.display_name || version.file_name}
              </p>
              <p className="font-mono text-caption text-ink-tertiary">
                {formatDuration(time)} / {formatDuration(duration)}
              </p>
            </div>
            <button
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                playable
                  ? "bg-primary text-white"
                  : "bg-surface-3 text-ink-tertiary"
              )}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              disabled={!playable}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M2 1h4v12H2zM8 1h4v12H8z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3 1l10 6-10 6z" />
                </svg>
              )}
            </button>
          </>
        ) : (
          <p className="text-body-sm text-ink-tertiary">
            Select a version node to play it.
          </p>
        )}
      </div>
    </div>

      {/* Full-screen now-playing sheet (mobile only) — sibling of the bar,
          see the containing-block note above. */}
      {expanded && version && (
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
            {artwork && (
              <ProjectArtwork
                projectId={artwork.projectId}
                artworkUrl={artwork.artworkUrl}
                title={artwork.title}
                className="aspect-square w-full max-w-[320px] border border-hairline"
                initialClassName="text-display-md"
              />
            )}

            <div className="w-full max-w-[400px]">
              {/* Anchored title row: track info left, borderless actions
                  (heart + role-dependent second icon) right. */}
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <p className="truncate text-card-title text-ink">
                    {version.display_name || version.file_name}
                  </p>
                  {version.id === mainVersionId && (
                    <StatusBadge tone="accent" className="shrink-0">
                      Main
                    </StatusBadge>
                  )}
                  {version.render_status === "pending" ||
                  version.render_status === "rendering" ? (
                    <StatusBadge tone="processing" className="shrink-0">
                      processing
                    </StatusBadge>
                  ) : version.render_status === "failed" ? (
                    <StatusBadge className="shrink-0">render failed</StatusBadge>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <LikeHeart versionId={version.id} api={interactionsApi} />
                  {isOwner && onSetMain ? (
                    <MainToggle
                      version={version}
                      mainVersionId={mainVersionId}
                      onSetMain={onSetMain}
                    />
                  ) : favoriteProjectId ? (
                    <FavoriteButton projectId={favoriteProjectId} bare />
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <span className="w-10 text-right font-mono text-mono text-ink-tertiary">
                  {formatDuration(time)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={duration ? Math.round((time / duration) * 1000) : 0}
                  onChange={seek}
                  disabled={!playable}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-(--primary)"
                  aria-label="Seek"
                />
                <span className="w-10 font-mono text-mono text-ink-tertiary">
                  {formatDuration(duration)}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-center gap-6">
                <button
                  className="p-3 text-ink-subtle disabled:opacity-40"
                  onClick={() => prev && onSelect(prev)}
                  disabled={!prev}
                  aria-label="Previous version"
                >
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 2h2v12H4zM13 2v12L6.5 8z" />
                  </svg>
                </button>
                <button
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full",
                    playable
                      ? "bg-primary text-white"
                      : "bg-surface-3 text-ink-tertiary"
                  )}
                  onClick={togglePlay}
                  disabled={!playable}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M2 1h4v12H2zM8 1h4v12H8z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 1l10 6-10 6z" />
                    </svg>
                  )}
                </button>
                <button
                  className="p-3 text-ink-subtle disabled:opacity-40"
                  onClick={() => next && onSelect(next)}
                  disabled={!next}
                  aria-label="Next version"
                >
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M10 2h2v12h-2zM3 2v12l6.5-6z" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Heart-like for the now-playing sheet — same snapshot/toggle plumbing as
 * the Interactions panel (sign-in required; disabled for anonymous viewers).
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
 * the tree's Main halo. Always visible; selected (filled, Rosso red) when the
 * playing version is already Main — tapping then is a no-op, so the state
 * can't be un-set from here.
 */
function MainToggle({
  version,
  mainVersionId,
  onSetMain,
}: {
  version: Version;
  mainVersionId: string | null;
  onSetMain: (v: Version) => void;
}) {
  const isMain = version.id === mainVersionId;
  return (
    <button
      onClick={() => !isMain && onSetMain(version)}
      aria-pressed={isMain}
      aria-label={isMain ? "Current Main version" : "Set as Main"}
      className={cn(
        "p-2 transition-colors",
        isMain ? "text-primary" : "text-ink-subtle"
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="9" cy="9" r="6.5" />
        <circle cx="9" cy="9" r="2.5" fill={isMain ? "currentColor" : "none"} />
      </svg>
    </button>
  );
}
