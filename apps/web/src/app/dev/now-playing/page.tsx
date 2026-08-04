"use client";

import { useEffect, useMemo } from "react";
import { notFound } from "next/navigation";
import { PlayerProvider } from "@/components/player-provider";
import { usePlayer, type PlayerTrack } from "@/components/player-context";
import { Eyebrow } from "@/components/ui";
import type { Version } from "@/lib/database.types";

/**
 * Dev-only playground for the now-playing player: mounts a real
 * <PlayerProvider> seeded with a mock queue so the bottom bar, the desktop
 * full-screen overlay, and the mobile slide-up sheet can be styled and
 * verified without auth, a live project, or working audio (playback fails
 * silently — only layout is exercised). 404s in production builds.
 */

const P = "00000000-0000-4000-8000-0000000000aa";
const U = "00000000-0000-4000-8000-0000000000bb";

const mkVersion = (
  id: string,
  name: string,
  duration: number,
  status: Version["render_status"] = "ready"
): Version => ({
  id,
  branch_id: "b-main",
  parent_version_id: null,
  project_id: P,
  user_id: U,
  display_name: name,
  file_name: `${name}.flp`,
  flp_storage_path: null,
  mp3_storage_path: null,
  render_status: status,
  render_error: null,
  flp_sha256: id.repeat(16).slice(0, 64),
  duration_secs: duration,
  uploaded_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
});

const TRACKS: { v: Version; branch: string }[] = [
  { v: mkVersion("v1", "pre-master", 214), branch: "midnight-drive" },
  { v: mkVersion("v2", "new bassline", 201), branch: "midnight-drive" },
  { v: mkVersion("v3", "halftime experiment", 188), branch: "midnight-drive-halftime" },
  { v: mkVersion("v4", "rough vocal take", 176), branch: "midnight-drive-vocals" },
  { v: mkVersion("v5", "comped vocals", 179, "pending"), branch: "midnight-drive-vocals" },
];

function Seed({ queue }: { queue: PlayerTrack[] }) {
  const { cue } = usePlayer();
  useEffect(() => {
    cue(queue, 0);
  }, [cue, queue]);
  return null;
}

export default function DevNowPlayingPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const queue = useMemo<PlayerTrack[]>(
    () =>
      TRACKS.map(({ v, branch }) => ({
        version: v,
        meta: {
          projectId: P,
          projectTitle: "Midnight Drive",
          artistName: "Producer",
          artworkUrl: null,
          isOwner: true,
          mainVersionId: "v1",
          branchName: branch,
          onSetMain: () => {},
          // No real audio backend here — return a dead path so load() fails
          // fast and stays caught. Layout renders from context regardless.
          audioUrlFor: () => "/dev/null-audio",
        },
      })),
    []
  );

  return (
    <PlayerProvider>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
        <Eyebrow>Dev</Eyebrow>
        <h1 className="mt-1 text-headline text-ink">Now playing playground</h1>
        <p className="mt-4 text-body-sm text-ink-muted">
          The bottom bar is seeded with a mock queue. On desktop, click the
          artwork or the expand chevron to open the full-screen overlay. On a
          mobile viewport, tap or drag the mini-bar up to reveal the sheet, and
          drag the grabber down to dismiss.
        </p>
      </main>
      <Seed queue={queue} />
    </PlayerProvider>
  );
}
