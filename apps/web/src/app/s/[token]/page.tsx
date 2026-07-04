"use client";

import { use, useEffect, useRef, useState } from "react";
import { cn, formatDuration } from "@/lib/utils";

type ListenPayload = {
  url: string;
  version: {
    id: string;
    name: string;
    duration_secs: number | null;
    uploaded_at: string;
    project_title: string;
  };
};

/**
 * Private share-link player. Minimal chrome, no download, token-gated via
 * /api/listen/[token]. Signed URL refreshes (without recounting the view)
 * if it expires mid-session.
 */
export default function SharePlayerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<ListenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retriedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/listen/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "unavailable");
        setData(body);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !data) return;
    if (!audio.src) audio.src = data.url;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }

  async function refreshUrl() {
    if (retriedRef.current) return;
    retriedRef.current = true;
    const res = await fetch(`/api/listen/${token}?noview=1`);
    if (res.ok && audioRef.current) {
      const body: ListenPayload = await res.json();
      const t = audioRef.current.currentTime;
      audioRef.current.src = body.url;
      audioRef.current.currentTime = t;
      if (playing) audioRef.current.play().catch(() => {});
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="panel-edge w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-8">
        {error ? (
          <>
            <h1 className="text-card-title font-medium text-ink">
              This link isn&apos;t available
            </h1>
            <p className="mt-2 text-body-sm text-ink-subtle">
              It may have expired, hit its view limit, or been revoked by the
              artist.
            </p>
          </>
        ) : !data ? (
          <p className="text-body-sm text-ink-subtle">Loading…</p>
        ) : (
          <>
            <p className="text-eyebrow font-medium uppercase tracking-[0.4px] text-ink-subtle">
              Private preview
            </p>
            <h1 className="mt-1 truncate text-card-title font-medium text-ink">
              {data.version.name}
            </h1>
            <p className="mt-0.5 text-body-sm text-ink-tertiary">
              {data.version.project_title}
            </p>

            <audio
              ref={audioRef}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onDurationChange={(e) => setDuration(e.currentTarget.duration)}
              onError={refreshUrl}
            />

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={togglePlay}
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                  "bg-primary text-white hover:bg-primary-hover"
                )}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M2 1h4v12H2zM8 1h4v12H8z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M3 1l10 6-10 6z" />
                  </svg>
                )}
              </button>
              <span className="w-10 text-right font-mono text-mono text-ink-tertiary">
                {formatDuration(time)}
              </span>
              <input
                type="range"
                min={0}
                max={1000}
                value={duration ? Math.round((time / duration) * 1000) : 0}
                onChange={(e) => {
                  const audio = audioRef.current;
                  if (!audio || !duration) return;
                  audio.currentTime = (Number(e.target.value) / 1000) * duration;
                }}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-(--primary)"
                aria-label="Seek"
              />
              <span className="w-10 font-mono text-mono text-ink-tertiary">
                {formatDuration(duration || data.version.duration_secs || 0)}
              </span>
            </div>

            <p className="mt-6 text-caption text-ink-tertiary">
              Shared privately via SanGit. Please don&apos;t redistribute.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
