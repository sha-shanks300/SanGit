"use client";

import { useEffect, useRef, useState } from "react";
import { Button, StatusBadge } from "@/components/ui";
import { ProjectArtwork } from "@/components/project-artwork";
import { FavoriteButton } from "@/components/favorite-button";
import { defaultInteractionsApi } from "@/components/interactions";
import { usePlayer, usePlayerProgress } from "@/components/player-context";
import {
  ArtistLine,
  ChevronIcon,
  IconButton,
  LikeHeart,
  MainToggle,
  NextIcon,
  PlayToggle,
  PrevIcon,
  RepeatIcon,
  SeekSlider,
  VolumeControl,
  trackLabels,
} from "@/components/player-controls";
import { NowPlayingDesktop, NowPlayingRail } from "@/components/now-playing";
import { cn, formatDuration } from "@/lib/utils";

/**
 * Persistent bottom player — pure presentation over the {@link usePlayer}
 * context (all audio/transport/queue state lives in <PlayerProvider>). Renders
 * nothing until a track is loaded.
 *
 * Desktop (`sm:`+) is a three-zone bar; clicking the artwork or the expand
 * chevron opens the full-screen {@link NowPlayingDesktop} overlay. Below `sm:`
 * it's a mini-bar you tap — or drag up — to reveal a full-screen now-playing
 * sheet (swipe back down to dismiss).
 */
export function PlayerBar() {
  const player = usePlayer();
  const { time, duration } = usePlayerProgress();
  const [expanded, setExpanded] = useState(false);

  // ── Mobile sheet gesture model ──
  // One px offset drives the sheet transform: 0 = fully open, viewport height =
  // fully closed (only the mini-bar showing). `dragging` (state — render reads
  // it) suppresses the spring transition mid-drag. Two gestures feed it: an
  // up-drag on the mini-bar (open) and a down-drag on the sheet header (close).
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragMode = useRef<"open" | "close" | null>(null);
  const dragStart = useRef(0);
  const viewportH = useRef(0);
  const moved = useRef(false);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const desktopCloseRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  const track = player.current;

  // Esc closes; body scroll locks; focus moves into the dialog and returns to
  // the trigger on close. Effects are safe to declare before the early return
  // because their bodies no-op while `expanded` is false.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    if (expanded) {
      prevFocus.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      const desktop = window.matchMedia("(min-width: 640px)").matches;
      (desktop ? desktopCloseRef : mobileCloseRef).current?.focus();
    } else {
      document.body.style.overflow = "";
      prevFocus.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [expanded]);

  // The sheet/overlay have nothing to show without a track.
  if (!track && expanded) setExpanded(false);
  if (!track) return null;

  const { version, meta } = track;
  const playable = version.render_status === "ready";
  const { playing, buffering } = player;
  const api = meta.interactionsApi ?? defaultInteractionsApi;
  const { songName, artist } = trackLabels(track);
  const artistHref =
    !meta.isOwner && meta.artistUsername ? `/u/${meta.artistUsername}` : null;
  const artwork = {
    projectId: meta.projectId,
    title: meta.projectTitle,
    artworkUrl: meta.artworkUrl,
  };

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    player.seekTo(Number(e.target.value) / 1000);
  }
  const seekValue = duration ? Math.round((time / duration) * 1000) : 0;

  // ── mini-bar: drag up to open ──
  function onBarTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    dragMode.current = "open";
    dragStart.current = e.touches[0].clientY;
    viewportH.current = window.innerHeight || 800;
    moved.current = false;
  }
  function onBarTouchMove(e: React.TouchEvent) {
    if (dragMode.current !== "open") return;
    const up = dragStart.current - e.touches[0].clientY;
    if (up > 6) {
      moved.current = true;
      if (!dragging) setDragging(true);
    }
    setDragY(Math.min(viewportH.current, Math.max(0, viewportH.current - Math.max(0, up))));
  }
  function onBarTouchEnd() {
    if (dragMode.current !== "open") return;
    dragMode.current = null;
    const opened = moved.current && dragY < viewportH.current * 0.7;
    setDragging(false);
    setDragY(0);
    if (opened) setExpanded(true);
  }
  function onBarClick() {
    // Suppress the click that trails a drag; a clean tap opens.
    if (moved.current) {
      moved.current = false;
      return;
    }
    setExpanded(true);
  }

  // ── sheet header: drag down to close ──
  function onSheetTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    dragMode.current = "close";
    dragStart.current = e.touches[0].clientY;
    setDragging(true);
  }
  function onSheetTouchMove(e: React.TouchEvent) {
    if (dragMode.current !== "close") return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  }
  function onSheetTouchEnd() {
    if (dragMode.current !== "close") return;
    dragMode.current = null;
    setDragging(false);
    if (dragY > 120) setExpanded(false);
    setDragY(0);
  }

  const sheetTransform = dragging
    ? `translateY(${dragY}px)`
    : expanded
      ? "translateY(0)"
      : "translateY(100%)";

  const statusBadge =
    version.render_status === "pending" || version.render_status === "rendering" ? (
      <StatusBadge tone="processing">processing</StatusBadge>
    ) : version.render_status === "failed" ? (
      <StatusBadge>render failed</StatusBadge>
    ) : null;

  return (
    <>
      {/* The overlays must NOT live inside this bar: backdrop-blur makes the bar
          a containing block for fixed descendants, which would trap the
          "inset-0" overlay inside the strip. */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-player-slide-up border-t border-hairline bg-surface-1/95 backdrop-blur">
        {/* ── Desktop: [meta] · [transport+scrubber] · [utilities] ── */}
        <div className="hidden h-[104px] grid-cols-[1fr_auto_1fr] content-center items-center gap-6 px-5 sm:grid">
          {/* left: artwork + title/subtitle + listener like */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setExpanded(true)}
              aria-label="Open now playing"
              title="Open now playing"
              className="shrink-0 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e500]"
            >
              <ProjectArtwork
                projectId={artwork.projectId}
                artworkUrl={artwork.artworkUrl}
                title={artwork.title}
                className="h-14 w-14 border border-hairline"
                initialClassName="text-body-sm"
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded(true)}
                  className="truncate text-left text-body-sm text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e500]"
                >
                  {songName}
                </button>
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

          {/* right: management (owner) or like (listener) + volume + expand */}
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
            <IconButton label="Open now playing" onClick={() => setExpanded(true)}>
              <ChevronIcon dir="up" size={18} />
            </IconButton>
          </div>
        </div>

        {/* ── Mobile mini-bar — tap or drag up to expand ── */}
        <div
          className="relative flex h-14 touch-none items-center gap-3 px-4 sm:hidden"
          onClick={onBarClick}
          onTouchStart={onBarTouchStart}
          onTouchMove={onBarTouchMove}
          onTouchEnd={onBarTouchEnd}
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

      {/* ── Full-screen now-playing sheet (mobile) — always mounted so the
          transform springs both ways; parked off-screen when closed. ── */}
      <div
        className={cn(
          "fixed inset-0 z-[60] flex flex-col bg-canvas sm:hidden",
          !dragging && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        )}
        style={{ transform: sheetTransform }}
        role="dialog"
        aria-modal="true"
        aria-label="Now playing"
        inert={!expanded}
      >
        {/* header — grabber centred; owner/listener action left, close right */}
        <div
          className="relative flex shrink-0 items-center justify-center pt-3 pb-2 touch-none"
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
          onTouchEnd={onSheetTouchEnd}
        >
          <span className="h-1 w-10 rounded-full bg-surface-4" aria-hidden />
          <div className="absolute left-2 top-1.5">
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
          <button
            ref={mobileCloseRef}
            onClick={() => setExpanded(false)}
            aria-label="Close player"
            className="absolute right-3 top-1.5 p-2 text-ink-subtle transition-colors hover:text-ink"
          >
            <ChevronIcon dir="down" size={20} />
          </button>
        </div>

        {/* artwork + credits + transport — a centred, symmetric column */}
        <div className="flex shrink-0 flex-col items-center gap-7 px-6 pt-3">
          <ProjectArtwork
            projectId={artwork.projectId}
            artworkUrl={artwork.artworkUrl}
            title={artwork.title}
            className="aspect-square w-[58vw] max-w-[260px] border border-hairline"
            initialClassName="text-display-lg"
          />

          <div className="w-full max-w-[360px]">
            {/* credits — centred */}
            <div className="text-center">
              <p className="truncate text-card-title text-ink">{songName}</p>
              {artist && (
                <div className="mt-1.5 flex justify-center">
                  <ArtistLine artist={artist} href={artistHref} />
                </div>
              )}
              {statusBadge && <div className="mt-2 flex justify-center">{statusBadge}</div>}
            </div>

            {/* scrubber */}
            <div className="mt-6 flex items-center gap-2.5">
              <span className="w-10 text-right font-mono text-mono tabular-nums text-ink-tertiary">
                {formatDuration(time)}
              </span>
              <SeekSlider value={seekValue} onChange={seek} disabled={!playable} />
              <span className="w-10 font-mono text-mono tabular-nums text-ink-tertiary">
                {formatDuration(duration)}
              </span>
            </div>

            {/* transport — symmetric: like · prev · PLAY · next · repeat */}
            <div className="mt-6 flex items-center justify-center gap-7">
              <LikeHeart versionId={version.id} api={api} showCount={false} />
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

        {/* up next / comments */}
        <div className="mt-5 flex min-h-0 flex-1 border-t border-hairline">
          <NowPlayingRail track={track} />
        </div>
      </div>

      {/* ── Full-screen now-playing overlay (desktop) ── */}
      {expanded && (
        <NowPlayingDesktop
          track={track}
          onClose={() => setExpanded(false)}
          closeRef={desktopCloseRef}
        />
      )}
    </>
  );
}
