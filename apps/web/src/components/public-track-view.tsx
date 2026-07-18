"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ProjectArtwork } from "@/components/project-artwork";
import { CopyLinkButton } from "@/components/copy-link-button";
import { cn, formatDuration } from "@/lib/utils";

/**
 * The Main-only public project page (show_history off): one track, big
 * artwork, producer byline — what a visitor from a socials link sees.
 * Playback streams a short-lived signed URL from /api/audio (anonymous
 * access is allowed by RLS for public projects) and refreshes it once if
 * it expires mid-session.
 */
export function PublicTrackView({
  project,
  producer,
  version,
}: {
  project: { id: string; title: string; slug: string; artwork_url: string | null };
  producer: { username: string; display_name: string | null };
  /** Main version if playable, else the latest ready one; null = nothing ready. */
  version: { id: string; name: string; duration_secs: number | null } | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const retriedRef = useRef(false);

  async function loadUrl(): Promise<string | null> {
    if (!version) return null;
    const res = await fetch(`/api/audio/${version.id}`);
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !version) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (!audio.src) {
      const url = await loadUrl();
      if (!url) return;
      audio.src = url;
    }
    audio.play().catch(() => {});
  }

  async function refreshUrl() {
    // Signed URL likely expired — refresh once, resume position.
    if (retriedRef.current) return;
    retriedRef.current = true;
    const audio = audioRef.current;
    const url = await loadUrl();
    if (!audio || !url) return;
    const t = audio.currentTime;
    audio.src = url;
    audio.currentTime = t;
    if (playing) audio.play().catch(() => {});
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <ProjectArtwork
          projectId={project.id}
          artworkUrl={project.artwork_url}
          title={project.title}
          className="mx-auto aspect-square w-full max-w-[320px] border border-hairline"
          initialClassName="text-display-md"
        />

        <div className="mt-8 text-center">
          <h1 className="truncate text-headline text-ink">{project.title}</h1>
          <p className="mt-1 text-body-sm text-ink-subtle">
            by{" "}
            <Link
              href={`/u/${producer.username}`}
              className="text-ink underline underline-offset-2"
            >
              {producer.display_name || producer.username}
            </Link>
          </p>
        </div>

        <audio
          ref={audioRef}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onError={refreshUrl}
        />

        {version ? (
          <div className="mt-8 flex items-center gap-3">
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
              {formatDuration(duration || version.duration_secs || 0)}
            </span>
          </div>
        ) : (
          <p className="mt-8 text-center text-body-sm text-ink-subtle">
            Nothing to play yet — check back soon.
          </p>
        )}

        <div className="mt-8 flex justify-center">
          <CopyLinkButton path={`/p/${project.slug}`} />
        </div>
      </div>
    </main>
  );
}
