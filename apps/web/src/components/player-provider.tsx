"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PlayerContext,
  PlayerProgressContext,
  type PlayerContextValue,
  type PlayerTrack,
} from "@/components/player-context";
import { PlayerBar } from "@/components/player";

const defaultAudioUrl = (id: string) => `/api/audio/${id}`;

/**
 * Single owner of playback for a route subtree. Mounted in the dashboard
 * layout it keeps one <audio> alive across dashboard ↔ project navigation
 * (Spotify-style continuity); mounted per-page it just powers that page's bar.
 * The bar it renders is purely presentational — all state lives here.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);

  const current = queue[index] ?? null;
  const currentId = current?.version.id ?? null;

  // Refs mirror state so event handlers / media-session / keydown read fresh
  // values without re-binding. Updated in effects (declared before the load
  // effect below, so they commit first) rather than during render.
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const loopRef = useRef(loop);
  const playingRef = useRef(playing);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  // Whether the *next* track-load should autoplay: play/prev/next set true,
  // cue sets false. Read once when the load effect fires.
  const autoplayRef = useRef(true);
  const retriedRef = useRef(false);

  const load = useCallback(async (autoplay: boolean) => {
    const audio = audioRef.current;
    const track = queueRef.current[indexRef.current] ?? null;
    if (!audio || !track || track.version.render_status !== "ready") return;
    setBuffering(true);
    try {
      const url = (track.meta.audioUrlFor ?? defaultAudioUrl)(track.version.id);
      const res = await fetch(url);
      if (!res.ok) return;
      const { url: signed } = await res.json();
      audio.src = signed;
      if (autoplay) await audio.play();
    } catch {
      /* leave the bar idle on failure */
    }
  }, []);

  // Load whenever the loaded track changes (keyed on id so a fresh object with
  // the same id — a realtime refetch — never reloads/interrupts playback).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    retriedRef.current = false;
    // Reset transport for the new track; the <audio> element re-reports time
    // and duration as soon as the new source loads.
    setTime(0);
    setDuration(current?.version.duration_secs ?? 0);
    if (!current || current.version.render_status !== "ready") {
      audio.pause();
      audio.removeAttribute("src");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI to an external track change
      setBuffering(false);
      return;
    }
    load(autoplayRef.current);
    autoplayRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id-keyed by design
  }, [currentId]);

  // Reflect volume/mute onto the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const play = useCallback((q: PlayerTrack[], i: number) => {
    autoplayRef.current = true;
    setQueue(q);
    setIndex(i);
  }, []);

  const cue = useCallback((q: PlayerTrack[], i: number) => {
    if (queueRef.current[indexRef.current]) return; // already loaded
    autoplayRef.current = false;
    setQueue(q);
    setIndex(i);
  }, []);

  const syncQueue = useCallback((q: PlayerTrack[]) => {
    const cur = queueRef.current[indexRef.current];
    if (!cur) return;
    const i = q.findIndex((t) => t.version.id === cur.version.id);
    if (i < 0) return; // this queue doesn't own the playing track
    setQueue(q);
    setIndex(i);
  }, []);

  const prev = useCallback(() => {
    const i = indexRef.current;
    if (i > 0) {
      autoplayRef.current = true;
      setIndex(i - 1);
    }
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (i < q.length - 1) {
      autoplayRef.current = true;
      setIndex(i + 1);
    }
  }, []);

  const jumpTo = useCallback((i: number) => {
    const q = queueRef.current;
    if (i < 0 || i >= q.length || i === indexRef.current) return;
    autoplayRef.current = true;
    setIndex(i);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingRef.current) audio.pause();
    else if (audio.src) audio.play().catch(() => load(true));
    else load(true);
  }, [load]);

  const seekTo = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;
    const t = fraction * audio.duration;
    audio.currentTime = t;
    setTime(t);
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration)) return;
    const t = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration);
    audio.currentTime = t;
    setTime(t);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const toggleLoop = useCallback(() => setLoop((l) => !l), []);

  // Keyboard transport: space toggles, arrows nudge ±5s. Ignored while typing
  // or when focus is on another control (so the key does its normal thing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!queueRef.current[indexRef.current]) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName))
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") {
        seekBy(-5);
      } else if (e.key === "ArrowRight") {
        seekBy(5);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seekBy]);

  // Media Session — OS media keys, lock screen, hardware play/pause.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!current) {
      ms.metadata = null;
      return;
    }
    const { version, meta } = current;
    ms.metadata = new MediaMetadata({
      title: version.display_name || version.file_name,
      artist: meta.projectTitle,
      artwork: meta.artworkUrl
        ? [{ src: meta.artworkUrl, sizes: "512x512" }]
        : undefined,
    });
    ms.setActionHandler("play", () => toggle());
    ms.setActionHandler("pause", () => toggle());
    ms.setActionHandler("previoustrack", () => prev());
    ms.setActionHandler("nexttrack", () => next());
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
    };
  }, [current, toggle, prev, next]);

  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;

  // Memoised so a time tick (which changes only the progress context below)
  // never re-renders the tree/graph/dashboard consuming this context.
  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      currentId,
      queue,
      index,
      playing,
      buffering,
      volume,
      muted,
      loop,
      hasPrev,
      hasNext,
      play,
      cue,
      jumpTo,
      syncQueue,
      toggle,
      seekTo,
      seekBy,
      setVolume,
      toggleMute,
      toggleLoop,
      prev,
      next,
    }),
    [
      current,
      currentId,
      queue,
      index,
      playing,
      buffering,
      volume,
      muted,
      loop,
      hasPrev,
      hasNext,
      play,
      cue,
      jumpTo,
      syncQueue,
      toggle,
      seekTo,
      seekBy,
      setVolume,
      toggleMute,
      toggleLoop,
      prev,
      next,
    ]
  );

  const progress = useMemo(() => ({ time, duration }), [time, duration]);

  return (
    <PlayerContext.Provider value={value}>
      <PlayerProgressContext.Provider value={progress}>
      {children}
      <audio
        ref={audioRef}
        loop={loop}
        onPlay={() => {
          setPlaying(true);
          setBuffering(false);
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          if (!loopRef.current) next();
        }}
        onError={() => {
          // Signed URL likely expired mid-session — refresh it once.
          if (!retriedRef.current && queueRef.current[indexRef.current]) {
            retriedRef.current = true;
            load(playingRef.current);
          }
        }}
      />
      <PlayerBar />
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}
