"use client";

import { createContext, useContext } from "react";
import type { Version } from "@/lib/database.types";
import type { InteractionsApi } from "@/components/interactions";

/**
 * Everything the bar needs to present a track that isn't the audio itself:
 * artwork, the audience split (owner management vs. listener social), and the
 * per-source plumbing (token-scoped audio/like routes on share pages). Carried
 * per queue entry so a cross-project dashboard queue can mix projects.
 */
export type TrackMeta = {
  projectId: string;
  /** The project name — shown as the "song" title in the bar. */
  projectTitle: string;
  /** The producer's name — shown as the "artist" line under the title. */
  artistName?: string | null;
  /** The producer's @username — when set on a listener track, the artist line
   *  links to /u/[username] (audio keeps playing across the client nav). Omit
   *  to render plain text (owner bars, or share pages with no reachable
   *  profile). */
  artistUsername?: string | null;
  artworkUrl: string | null;
  isOwner: boolean;
  mainVersionId: string | null;
  /** Branch this version lives on — the desktop bar's secondary line. */
  branchName?: string | null;
  /** Owner-only management action; absent = no "Set as Main" affordance. */
  onSetMain?: (v: Version) => void;
  /** Listener-only project favourite (RLS path). Omit on token share pages. */
  favoriteProjectId?: string;
  /** Like backend for the version heart (token routes on share pages). */
  interactionsApi?: InteractionsApi;
  /** Signed-URL minting endpoint; defaults to the owner `/api/audio/:id`. */
  audioUrlFor?: (id: string) => string;
};

export type PlayerTrack = { version: Version; meta: TrackMeta };

export type PlayerContextValue = {
  current: PlayerTrack | null;
  /** id of the playing/cued version — cheap signal for hover overlays. */
  currentId: string | null;
  playing: boolean;
  buffering: boolean;
  volume: number;
  muted: boolean;
  loop: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  /** Start a queue at `index` and play (a user gesture). */
  play: (queue: PlayerTrack[], index: number) => void;
  /** Load a queue at `index` without playing — no-op if something's already
   *  loaded, so navigating in never hijacks an in-flight track. */
  cue: (queue: PlayerTrack[], index: number) => void;
  /** Refresh the live queue/meta in place, but only if this queue owns the
   *  currently-loaded track (else the caller is just a bystander page). */
  syncQueue: (queue: PlayerTrack[]) => void;
  toggle: () => void;
  seekTo: (fraction: number) => void;
  seekBy: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  prev: () => void;
  next: () => void;
};

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}

/**
 * High-frequency playback position, split from {@link PlayerContext} so the
 * ~4×/s time ticks only re-render the bar — not the timeline tree, graph, or
 * dashboard grid, which consume the stable context above.
 */
export type PlayerProgress = { time: number; duration: number };

export const PlayerProgressContext = createContext<PlayerProgress>({
  time: 0,
  duration: 0,
});

export function usePlayerProgress(): PlayerProgress {
  return useContext(PlayerProgressContext);
}
