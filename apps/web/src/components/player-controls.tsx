"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { InteractionsApi } from "@/components/interactions";
import type { PlayerTrack } from "@/components/player-context";
import { cn } from "@/lib/utils";

/**
 * Shared, purely-presentational player controls — transport buttons, the play
 * disc, the seek/volume sliders, the like heart, the Main toggle, and the SVG
 * icon set. Extracted from the bottom bar so the full-screen now-playing
 * overlay ({@link ./now-playing}) renders the exact same controls.
 */

/** Owner vs. listener identity for a track: owners see the version name and its
 *  branch; listeners see the project as the "song" and the producer as artist —
 *  the internal version name is never surfaced to them. */
export function trackLabels(track: PlayerTrack) {
  const { version, meta } = track;
  const songName = meta.isOwner
    ? version.display_name || version.file_name
    : meta.projectTitle;
  const artist = meta.isOwner
    ? meta.branchName
      ? `${meta.projectTitle} · ${meta.branchName}`
      : meta.projectTitle
    : meta.artistName ?? "";
  return { songName, artist };
}

/** The "artist" subtitle. A listener track with a reachable profile links to
 *  /u/[username] (client nav — audio keeps playing); otherwise plain text. */
export function ArtistLine({
  artist,
  href,
  className,
}: {
  artist: string;
  href: string | null;
  className?: string;
}) {
  const base = cn("truncate font-mono text-caption text-ink-tertiary", className);
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
export function IconButton({
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
export function PlayToggle({
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
  size: "sm" | "md" | "lg" | "xl";
}) {
  const box =
    size === "xl"
      ? "h-16 w-16"
      : size === "lg"
        ? "h-14 w-14"
        : size === "md"
          ? "h-11 w-11"
          : "h-10 w-10";
  const icon = size === "xl" ? 26 : size === "lg" ? 22 : 18;
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
export function SeekSlider({
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
export function fillTrack(pct: number) {
  const p = Math.min(100, Math.max(0, pct));
  return `linear-gradient(to right, var(--primary) ${p}%, var(--surface-3) ${p}%)`;
}

/** Mute button + level slider (desktop only). */
export function VolumeControl({
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

export function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}
export function PauseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="4.5" width="3.5" height="15" rx="0.5" />
      <rect x="14" y="4.5" width="3.5" height="15" rx="0.5" />
    </svg>
  );
}
export function PrevIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="2.4" height="14" rx="0.6" />
      <path d="M20 6v12a1 1 0 0 1-1.54.84l-9-6a1 1 0 0 1 0-1.68l9-6A1 1 0 0 1 20 6z" />
    </svg>
  );
}
export function NextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="15.6" y="5" width="2.4" height="14" rx="0.6" />
      <path d="M4 6v12a1 1 0 0 0 1.54.84l9-6a1 1 0 0 0 0-1.68l-9-6A1 1 0 0 0 4 6z" />
    </svg>
  );
}
export function RepeatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
export function VolumeIcon({ level }: { level: number }) {
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
export function LikeHeart({
  versionId,
  api,
  showCount = true,
  size = 18,
}: {
  versionId: string;
  api: InteractionsApi;
  /** Listeners see a bare heart toggle — the count is producer-only. */
  showCount?: boolean;
  size?: number;
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
        width={size}
        height={size}
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
 * Owner-only Main toggle: ring/target icon echoing the tree's Main halo.
 * Selected (filled, Rosso) when the playing version is already Main — tapping
 * then is a no-op.
 */
export function MainToggle({
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

/** Queue/list glyph — toggles the Up-next / Comments panel. */
export function QueueIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="13" y2="17" />
    </svg>
  );
}

/** Chevron used by the bar's expand affordance and the overlay's collapse. */
export function ChevronIcon({
  dir = "down",
  size = 20,
}: {
  dir?: "up" | "down";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={dir === "up" ? "rotate-180" : undefined}
    >
      <path d="M4 7.5l6 5 6-5" />
    </svg>
  );
}
