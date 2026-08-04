"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { Version } from "@/lib/database.types";
import { ProjectArtwork } from "@/components/project-artwork";
import { NowPlayingSurface } from "@/components/now-playing";
import { usePlayer, type PlayerTrack } from "@/components/player-context";

/**
 * The Main-only public project page (show_history off): one track — what a
 * visitor from a socials link sees.
 *
 * This page IS the now-playing overlay. It renders {@link NowPlayingSurface} —
 * the same header, hero column and Up-next/Comments rail the full-screen
 * overlay renders — rather than a page-shaped variant of it, so the two are
 * pixel-identical by construction and can't drift. The only difference is
 * chrome the page can't have: no backdrop, and no collapse chevron (there's
 * nothing to collapse back into).
 *
 * It sits inside the (app) group, whose layout mounts the shared
 * <PlayerProvider>, so it cues a one-track listener queue into that provider
 * instead of running a private <audio>. While this page's track is the loaded
 * one it also hides the persistent bar: the bar would be a second copy of the
 * player already filling the screen. `isOwner:false` meta gives the listener
 * (social) chrome, never management.
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
          // This page IS the shareable link — the surface header offers a copy.
          slug: project.slug,
        },
      },
    ];
  }, [version, project, producer]);

  // Cue into the shared provider so playback is wired up (no autoplay). A no-op
  // if audio is already carried in from another page, so arriving here never
  // hijacks an in-flight track — the hero then presents this page's song
  // statically while the other one keeps playing.
  const { cue, setBarHidden } = player;
  useEffect(() => {
    if (queue.length) cue(queue, 0);
  }, [queue, cue]);

  // Hide the persistent bar only while THIS page's track is the loaded one.
  // If something else is playing, the bar is still the only control surface
  // for it and must stay.
  const isCurrent = !!version && player.currentId === version.id;
  useEffect(() => {
    if (!isCurrent) return;
    setBarHidden(true);
    return () => setBarHidden(false);
  }, [isCurrent, setBarHidden]);

  // Nothing rendered yet: there's no track to hand the surface, so show the
  // identity on its own. (A .flp is committed but its mp3 hasn't landed.)
  if (!queue.length) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[320px]">
          <ProjectArtwork
            projectId={project.id}
            artworkUrl={project.artwork_url}
            title={project.title}
            className="aspect-square w-full border border-hairline"
            initialClassName="text-display-md"
          />
          <div className="mt-9 text-center">
            <h1 className="truncate text-headline text-ink">{project.title}</h1>
            <p className="mt-2 font-mono text-caption text-ink-tertiary">
              <Link
                href={`/u/${producer.username}`}
                className="underline-offset-2 hover:text-ink hover:underline"
              >
                {producer.display_name || producer.username}
              </Link>
            </p>
          </div>
          <p className="mt-8 text-center text-body-sm text-ink-subtle">
            Nothing to play yet — check back soon.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <NowPlayingSurface
        track={queue[0]}
        queue={queue}
        heading="h1"
        className="min-h-0 flex-1"
      />
    </main>
  );
}
