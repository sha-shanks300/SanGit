"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Version } from "@/lib/database.types";
import { Button, StatusBadge } from "@/components/ui";
import { cn, formatDuration } from "@/lib/utils";

/**
 * Persistent bottom player bar. Streams short-lived signed URLs (refetched
 * on playback error when they expire). prev/next walk the chronological
 * order of the current branch lane, falling back across the whole project.
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
}: {
  version: Version | null;
  versions: Version[];
  isOwner: boolean;
  mainVersionId: string | null;
  onSelect: (v: Version) => void;
  onSetMain?: (v: Version) => void;
  audioUrlFor?: (id: string) => string;
  extraControls?: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const retriedRef = useRef(false);

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

  return (
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
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-4 px-6">
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
    </div>
  );
}
