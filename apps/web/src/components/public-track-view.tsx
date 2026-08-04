"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { Version } from "@/lib/database.types";
import { ProjectArtwork } from "@/components/project-artwork";
import { CopyLinkButton } from "@/components/copy-link-button";
import {
  usePlayer,
  usePlayerProgress,
  type PlayerTrack,
} from "@/components/player-context";
import { PlayToggle, SeekSlider } from "@/components/player-controls";
import { formatDuration } from "@/lib/utils";

/**
 * The Main-only public project page (show_history off): one track, big
 * artwork, producer byline — what a visitor from a socials link sees.
 *
 * This page lives inside the (app) group, whose layout mounts the shared
 * <PlayerProvider> (persistent bar + full-screen NowPlayingDesktop overlay).
 * So rather than run a private <audio>, the hero cues a one-track listener
 * queue into that provider: the bottom bar appears and clicking it expands the
 * same "now playing" experience owners and full-history listeners already get.
 * `isOwner:false` meta gives the listener (social) chrome, never management.
 */
export function PublicTrackView({
  project,
  producer,
  version,
}: {
  project: {
    id: string;
    title: string;
    slug: string;
    artwork_url: string | null;
    main_version_id: string | null;
  };
  producer: { username: string; display_name: string | null };
  /** Main version if playable, else the latest ready one; null = nothing ready. */
  version: Version | null;
}) {
  const player = usePlayer();
  const { time, duration } = usePlayerProgress();

  const queue = useMemo<PlayerTrack[]>(() => {
    if (!version) return [];
    return [
      {
        version,
        meta: {
          projectId: project.id,
          projectTitle: project.title,
          artistName: producer.display_name || producer.username,
          artistUsername: producer.username,
          artworkUrl: project.artwork_url,
          isOwner: false,
          mainVersionId: project.main_version_id,
          favoriteProjectId: project.id,
        },
      },
    ];
  }, [version, project, producer]);

  // Cue into the shared provider so the bar + overlay light up (no autoplay).
  // A no-op if audio is already carried in from another page, so arriving here
  // never hijacks an in-flight track.
  const { cue } = player;
  useEffect(() => {
    if (queue.length) cue(queue, 0);
  }, [queue, cue]);

  // The hero presents THIS page's track. It's "live" only while this version is
  // the one actually loaded in the provider (a carried-in track keeps the bar);
  // otherwise the hero is a static play affordance that starts this queue.
  const isCurrent = player.currentId === version?.id;
  const playable = version?.render_status === "ready";
  const shownTime = isCurrent ? time : 0;
  const shownDuration =
    isCurrent && duration ? duration : version?.duration_secs ?? 0;
  const seekValue =
    isCurrent && duration ? Math.round((time / duration) * 1000) : 0;

  function onPlay() {
    if (!version) return;
    if (isCurrent) player.toggle();
    else player.play(queue, 0);
  }
  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    player.seekTo(Number(e.target.value) / 1000);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16 pb-32">
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

        {version ? (
          <div className="mt-8 flex items-center gap-3">
            <PlayToggle
              playing={isCurrent && player.playing}
              buffering={isCurrent && player.buffering}
              playable={!!playable}
              onClick={onPlay}
              size="lg"
            />
            <span className="w-10 text-right font-mono text-mono text-ink-tertiary">
              {formatDuration(shownTime)}
            </span>
            <SeekSlider
              value={seekValue}
              onChange={seek}
              disabled={!isCurrent || !playable}
            />
            <span className="w-10 font-mono text-mono text-ink-tertiary">
              {formatDuration(shownDuration)}
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
