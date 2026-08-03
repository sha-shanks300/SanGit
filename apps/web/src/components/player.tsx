"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
 * Desktop (`sm:`+) is a three-zone bar in the streaming-player idiom: artwork +
 * track meta pinned far left, transport + scrubber centred, utilities right.
 * Below `sm:` it's a mini-bar that expands into a full-screen now-playing sheet.
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

  // Owners work at the version level, so their bar names the version (with
  // project · branch beneath). Listeners get a clean "song" identity: the
  // project as the title, the producer as the artist — the internal version
  // name is never revealed to them.
  const songName = meta.isOwner
    ? version.display_name || version.file_name
    : meta.projectTitle;
  const artist = meta.isOwner
    ? meta.branchName
      ? `${meta.projectTitle} · ${meta.branchName}`
      : meta.projectTitle
    : meta.artistName ?? "";
  // Listeners can click through to the artist's profile without stopping the
  // audio (the player lives above the router, so the nav is a client swap).
  const artistHref =
    !meta.isOwner && meta.artistUsername ? `/u/${meta.artistUsername}` : null;

  return (
    <>
      {/* The sheet must NOT live inside this bar: backdrop-blur makes the bar
          a containing block for fixed descendants, which would trap the
          "inset-0" overlay inside the strip. */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-player-slide-up border-t border-hairline bg-surface-1/95 backdrop-blur">
        {/* ── Desktop: [meta] · [transport+scrubber] · [utilities] ──
            content-center (not just items-center): the row block is shorter
            than the bar, so without it align-content:start pins it to the top. */}
        <div className="hidden h-[104px] grid-cols-[1fr_auto_1fr] content-center items-center gap-6 px-5 sm:grid">
          {/* left: artwork + title/subtitle + listener like */}
          <div className="flex min-w-0 items-center gap-3">
            <ProjectArtwork
              projectId={artwork.projectId}
              artworkUrl={artwork.artworkUrl}
              title={artwork.title}
              className="h-14 w-14 shrink-0 border border-hairline"
              initialClassName="text-body-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-body-sm text-ink">{songName}</p>
                {statusBadge}
              </div>
              {artist && <ArtistLine artist={artist} href={artistHref} />}
            </div>
          </div>

          {/* centre: transport row + scrubber */}
          <div className="flex w-[40vw] min-w-[300px] max-w-[560px] flex-col items-center gap-2.5">
            <div className="flex items-center gap-5">
              {/* Invisible mirror of the repeat button so the play disc lands on
                  the exact centre (row is symmetric: spacer·prev·PLAY·next·repeat),
                  aligning it with the scrubber's midpoint below. */}
              <span aria-hidden className="invisible p-1.5">
                <RepeatIcon />
              </span>
              <IconButton
                label="Previous"
                onClick={player.prev}
                disabled={!player.hasPrev}
              >
                <PrevIcon />
              </IconButton>
              <PlayToggle
                playing={playing}
                buffering={buffering}
                playable={playable}
                onClick={player.toggle}
                size="md"
              />
              <IconButton
                label="Next"
                onClick={player.next}
                disabled={!player.hasNext}
              >
                <NextIcon />
              </IconButton>
              <IconButton
                label={player.loop ? "Repeat on" : "Repeat off"}
                onClick={player.toggleLoop}
                pressed={player.loop}
                active={player.loop}
              >
                <RepeatIcon />
              </IconButton>
            </div>
            <div className="flex w-full items-center gap-2.5">
              <span className="w-10 shrink-0 text-right font-mono text-mono tabular-nums text-ink-tertiary">
                {formatDuration(time)}
              </span>
              <SeekSlider value={seekValue} onChange={seek} disabled={!playable} />
              <span className="w-10 shrink-0 font-mono text-mono tabular-nums text-ink-tertiary">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* right: management (owner) or like (listener) + volume */}
          <div className="flex items-center justify-end gap-3">
            {meta.isOwner
              ? meta.onSetMain &&
                version.id !== meta.mainVersionId && (
                  <Button variant="secondary" onClick={() => meta.onSetMain!(version)}>
                    Set as Main
                  </Button>
                )
              : (
                <LikeHeart versionId={version.id} api={api} showCount={false} />
              )}
            <VolumeControl
              volume={player.volume}
              muted={player.muted}
              onVolume={player.setVolume}
              onToggleMute={player.toggleMute}
            />
          </div>
        </div>

        {/* ── Mobile mini-bar — tap to expand ── */}
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
            <p className="truncate text-body-sm text-ink">{songName}</p>
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

      {/* ── Full-screen now-playing sheet (mobile only) ── */}
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
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-card-title text-ink">{songName}</p>
                  {artist && <ArtistLine artist={artist} href={artistHref} />}
                </div>
                <div className="flex shrink-0 items-center">
                  {statusBadge && <span className="mr-1 shrink-0">{statusBadge}</span>}
                  <LikeHeart versionId={version.id} api={api} showCount={false} />
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

              <div className="mt-6 flex items-center gap-2.5">
                <span className="w-10 text-right font-mono text-mono tabular-nums text-ink-tertiary">
                  {formatDuration(time)}
                </span>
                <SeekSlider value={seekValue} onChange={seek} disabled={!playable} />
                <span className="w-10 font-mono text-mono tabular-nums text-ink-tertiary">
                  {formatDuration(duration)}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-center gap-8">
                <IconButton label="Previous" onClick={player.prev} disabled={!player.hasPrev} size="lg">
                  <PrevIcon />
                </IconButton>
                <PlayToggle
                  playing={playing}
                  buffering={buffering}
                  playable={playable}
                  onClick={player.toggle}
                  size="lg"
                />
                <IconButton label="Next" onClick={player.next} disabled={!player.hasNext} size="lg">
                  <NextIcon />
                </IconButton>
              </div>

              <div className="mt-6 flex items-center justify-center">
                <IconButton
                  label={player.loop ? "Repeat on" : "Repeat off"}
                  onClick={player.toggleLoop}
                  pressed={player.loop}
                  active={player.loop}
                >
                  <RepeatIcon />
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The "artist" subtitle. A listener track with a reachable profile links to
 *  /u/[username] (client nav — audio keeps playing); otherwise plain text. */
function ArtistLine({ artist, href }: { artist: string; href: string | null }) {
  const base = "truncate font-mono text-caption text-ink-tertiary";
  return href ? (
    <Link
      href={href}
      className={cn(base, "block w-fit max-w-full underline-offset-2 hover:text-ink hover:underline")}
    >
      {artist}
    </Link>
  ) : (
    <p className={base}>{artist}</p>
  );
}

/* ─────────────────────────── controls ─────────────────────────── */

/** Ghost icon button — greys at rest, brightens on hover, Rosso when active. */
function IconButton({
  label,
  onClick,
  disabled,
  pressed,
  active,
  size = "md",
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  pressed?: boolean;
  active?: boolean;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "flex items-center justify-center rounded-md transition-colors disabled:opacity-30",
        size === "lg" ? "p-2.5" : "p-1.5",
        active ? "text-primary" : "text-ink-subtle hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/** White play/pause disc (streaming idiom) with a buffering spinner. */
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
  const box = size === "lg" ? "h-14 w-14" : size === "md" ? "h-11 w-11" : "h-10 w-10";
  const icon = size === "lg" ? 22 : 18;
  return (
    <button
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-transform",
        box,
        playable
          ? "bg-ink text-canvas hover:scale-105"
          : "bg-surface-3 text-ink-tertiary"
      )}
      onClick={onClick}
      disabled={!playable}
      aria-label={playing ? "Pause" : "Play"}
    >
      {buffering ? (
        <svg className="animate-spin" width={icon} height={icon} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : playing ? (
        <PauseIcon size={icon} />
      ) : (
        <PlayIcon size={icon} />
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
  const pct = value / 10; // value is 0–1000
  return (
    <input
      type="range"
      min={0}
      max={1000}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{ background: fillTrack(pct) }}
      className="h-1 flex-1 cursor-pointer appearance-none rounded-full accent-(--primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e500]"
      aria-label="Seek"
    />
  );
}

/** Two-tone range track: Rosso up to `pct`, surface grey after — the played
 *  portion reads as filled (native range lower-fill isn't stylable in Chrome). */
function fillTrack(pct: number) {
  const p = Math.min(100, Math.max(0, pct));
  return `linear-gradient(to right, var(--primary) ${p}%, var(--surface-3) ${p}%)`;
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
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
        className="flex items-center justify-center rounded-md p-1.5 text-ink-subtle transition-colors hover:text-ink"
      >
        <VolumeIcon level={level} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(level * 100)}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        style={{ background: fillTrack(level * 100) }}
        className="h-1 w-24 cursor-pointer appearance-none rounded-full accent-(--primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e500]"
        aria-label="Volume"
      />
    </div>
  );
}

/* ──────────────────────────── icons ───────────────────────────── */
// Feather/Lucide geometry (24-grid) for legible, consistent controls.

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}
function PauseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="4.5" width="3.5" height="15" rx="0.5" />
      <rect x="14" y="4.5" width="3.5" height="15" rx="0.5" />
    </svg>
  );
}
function PrevIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="2.4" height="14" rx="0.6" />
      <path d="M20 6v12a1 1 0 0 1-1.54.84l-9-6a1 1 0 0 1 0-1.68l9-6A1 1 0 0 1 20 6z" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="15.6" y="5" width="2.4" height="14" rx="0.6" />
      <path d="M4 6v12a1 1 0 0 0 1.54.84l9-6a1 1 0 0 0 0-1.68l-9-6A1 1 0 0 0 4 6z" />
    </svg>
  );
}
function RepeatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function VolumeIcon({ level }: { level: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      {level === 0 ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : level < 0.5 ? (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

/* ───────────────────────── social / main ──────────────────────── */

/**
 * Heart-like — same snapshot/toggle plumbing as the Interactions panel
 * (sign-in required; disabled for anonymous viewers).
 */
function LikeHeart({
  versionId,
  api,
  showCount = true,
}: {
  versionId: string;
  api: InteractionsApi;
  /** Listeners see a bare heart toggle — the count is producer-only. */
  showCount?: boolean;
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
        mine ? "text-primary" : "text-ink-subtle hover:text-ink"
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
      {showCount && likes}
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
