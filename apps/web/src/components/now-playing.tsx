"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui";
import { Input, Button } from "@/components/ui";
import { ProjectArtwork } from "@/components/project-artwork";
import { FavoriteButton } from "@/components/favorite-button";
import {
  defaultInteractionsApi,
  type InteractionsApi,
  type CommentWithAuthor,
} from "@/components/interactions";
import {
  usePlayer,
  usePlayerProgress,
  type PlayerTrack,
} from "@/components/player-context";
import {
  ArtistLine,
  ChevronIcon,
  IconButton,
  LikeHeart,
  MainToggle,
  NextIcon,
  PlayToggle,
  PrevIcon,
  QueueIcon,
  RepeatIcon,
  SeekSlider,
  trackLabels,
} from "@/components/player-controls";
import { cn, formatDate, formatDuration } from "@/lib/utils";

/**
 * The full-screen "now playing" experience — a rich expansion of the bottom
 * bar (see {@link ./player}). The persistent <audio> keeps playing underneath;
 * this is pure presentation over {@link usePlayer}. Desktop is a centered,
 * symmetric column (oversized artwork, credits, scrubber, transport, volume)
 * with the Up-next/Comments rail ({@link NowPlayingRail}) tucked behind a
 * header toggle — off by default so the hero player breathes. The mobile sheet
 * stacks the same column with the rail beneath. Strict flat #181818 canvas per
 * DESIGN.md — no ambient backdrop.
 */

/* ───────────────────────── desktop overlay ─────────────────────── */

export function NowPlayingDesktop({
  track,
  onClose,
  closeRef,
}: {
  track: PlayerTrack;
  onClose: () => void;
  closeRef?: React.Ref<HTMLButtonElement>;
}) {
  const player = usePlayer();
  const { time, duration } = usePlayerProgress();
  const [railOpen, setRailOpen] = useState(false);
  const { version, meta } = track;
  const playable = version.render_status === "ready";
  const { songName, artist } = trackLabels(track);
  const artistHref =
    !meta.isOwner && meta.artistUsername ? `/u/${meta.artistUsername}` : null;
  const api = meta.interactionsApi ?? defaultInteractionsApi;

  const seekValue = duration ? Math.round((time / duration) * 1000) : 0;
  const seek = (e: React.ChangeEvent<HTMLInputElement>) =>
    player.seekTo(Number(e.target.value) / 1000);

  return (
    // Opaque canvas: clicking the empty void closes; interactive clusters below
    // stop propagation so controls never dismiss the overlay.
    <div
      className="fixed inset-0 z-[60] hidden animate-now-playing-in flex-col bg-canvas sm:flex"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      onClick={onClose}
    >
      {/* header — eyebrow left; owner/listener action, queue toggle, close right */}
      <div
        className="flex h-16 shrink-0 items-center justify-between px-8"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-mono text-eyebrow uppercase tracking-[0.28px] text-ink-subtle">
          Now playing
        </span>
        <div className="flex items-center gap-1">
          {meta.isOwner && meta.onSetMain ? (
            <MainToggle
              version={version}
              mainVersionId={meta.mainVersionId}
              onSetMain={meta.onSetMain}
            />
          ) : meta.favoriteProjectId ? (
            <FavoriteButton projectId={meta.favoriteProjectId} bare />
          ) : null}
          <button
            onClick={() => setRailOpen((o) => !o)}
            aria-pressed={railOpen}
            aria-label="Toggle up next and comments"
            title="Up next & comments"
            className={cn(
              "flex items-center justify-center rounded-md p-2 transition-colors",
              railOpen ? "text-ink" : "text-ink-subtle hover:text-ink"
            )}
          >
            <QueueIcon size={20} />
          </button>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close now playing"
            title="Collapse"
            className="flex items-center justify-center rounded-md p-2 text-ink-subtle transition-colors hover:text-ink"
          >
            <ChevronIcon dir="down" size={22} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── protagonist: a single centered, symmetric column ── */}
        <div className="flex min-w-0 flex-1 items-center justify-center px-10 pb-14">
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-[min(420px,42vh)] flex-col"
          >
            <ProjectArtwork
              projectId={meta.projectId}
              artworkUrl={meta.artworkUrl}
              title={meta.projectTitle}
              className="aspect-square w-full border border-hairline"
              initialClassName="text-display-xl"
            />

            {/* credits — centered */}
            <div className="mt-9 text-center">
              <h2 className="truncate text-headline text-ink">{songName}</h2>
              {artist && (
                <div className="mt-2 flex justify-center">
                  <ArtistLine artist={artist} href={artistHref} className="text-body-sm" />
                </div>
              )}
            </div>

            {/* scrubber */}
            <div className="mt-8 flex items-center gap-3">
              <span className="w-10 text-right font-mono text-mono tabular-nums text-ink-tertiary">
                {formatDuration(time)}
              </span>
              <SeekSlider value={seekValue} onChange={seek} disabled={!playable} />
              <span className="w-10 font-mono text-mono tabular-nums text-ink-tertiary">
                {formatDuration(duration)}
              </span>
            </div>

            {/* transport — symmetric: like · prev · PLAY · next · repeat */}
            <div className="mt-8 flex items-center justify-center gap-8">
              <LikeHeart versionId={version.id} api={api} showCount={false} size={20} />
              <IconButton label="Previous" onClick={player.prev} disabled={!player.hasPrev} size="lg">
                <PrevIcon />
              </IconButton>
              <PlayToggle
                playing={player.playing}
                buffering={player.buffering}
                playable={playable}
                onClick={player.toggle}
                size="xl"
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

        {/* ── rail: up next / comments — toggled, off by default ── */}
        {railOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-[360px] shrink-0 border-l border-hairline"
          >
            <NowPlayingRail track={track} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── shared rail ─────────────────────────── */

/** Segmented Up-next / Comments panel — shared by the desktop overlay and the
 *  mobile sheet. Fills its parent's height and scrolls internally. `active`
 *  (the mobile sheet's queue-open flag) drives the auto-scroll-to-current in
 *  {@link QueueList}; it defaults false so the desktop overlay — which passes
 *  nothing — keeps its original behaviour untouched. */
export function NowPlayingRail({
  track,
  active = false,
}: {
  track: PlayerTrack;
  active?: boolean;
}) {
  const [tab, setTab] = useState<"queue" | "comments">("queue");
  const api = track.meta.interactionsApi ?? defaultInteractionsApi;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex shrink-0 gap-1 px-4 pt-4">
        <RailTab active={tab === "queue"} onClick={() => setTab("queue")}>
          Up next
        </RailTab>
        <RailTab active={tab === "comments"} onClick={() => setTab("comments")}>
          Comments
        </RailTab>
      </div>
      {tab === "queue" ? (
        <QueueList active={active} />
      ) : (
        <CommentsPanel versionId={track.version.id} api={api} />
      )}
    </div>
  );
}

function RailTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-3 py-1.5 font-mono text-caption uppercase tracking-[0.28px] transition-colors",
        active
          ? "border-hairline-strong bg-surface-2 text-ink"
          : "border-transparent text-ink-subtle hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── up-next queue ───────────────────────── */

function QueueList({ active = false }: { active?: boolean }) {
  const { queue, index, jumpTo, currentId, playing } = usePlayer();
  const currentRef = useRef<HTMLLIElement>(null);

  // When the panel becomes visible (or the current track changes while open),
  // bring the playing row into view so "up next" actually starts where you are.
  // Deferred past the sheet's ~300ms open animation so the scroll container has
  // its full height before we scroll within it.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(
      () => currentRef.current?.scrollIntoView({ block: "center" }),
      320
    );
    return () => clearTimeout(t);
  }, [active, currentId]);

  if (queue.length <= 1) {
    return (
      <p className="px-5 py-6 text-body-sm text-ink-tertiary">
        Nothing queued after this track.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      {queue.map((t, i) => {
        const isCurrent = t.version.id === currentId;
        const { songName, artist } = trackLabels(t);
        const ready = t.version.render_status === "ready";
        return (
          <li key={`${t.version.id}-${i}`} ref={isCurrent ? currentRef : undefined}>
            <button
              onClick={() => jumpTo(i)}
              disabled={i === index}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                isCurrent ? "bg-surface-1" : "hover:bg-surface-1"
              )}
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                <ProjectArtwork
                  projectId={t.meta.projectId}
                  artworkUrl={t.meta.artworkUrl}
                  title={t.meta.projectTitle}
                  className="h-11 w-11 border border-hairline"
                  initialClassName="text-caption"
                />
                {isCurrent && (
                  <span className="absolute inset-0 flex items-center justify-center bg-canvas/55">
                    <Equalizer playing={playing} />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-body-sm",
                    isCurrent ? "text-primary" : "text-ink"
                  )}
                >
                  {songName}
                </span>
                {artist && (
                  <span className="block truncate font-mono text-caption text-ink-tertiary">
                    {artist}
                  </span>
                )}
              </span>
              {ready ? (
                <span className="shrink-0 font-mono text-caption tabular-nums text-ink-tertiary">
                  {formatDuration(t.version.duration_secs ?? 0)}
                </span>
              ) : (
                <StatusBadge tone="processing">processing</StatusBadge>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Three-bar equalizer overlaid on the currently-playing queue row. Animates
 *  while playing; rests low when paused. */
export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] origin-bottom bg-primary",
            playing ? "h-full animate-eq" : "h-1/3"
          )}
          style={playing ? { animationDelay: `${i * 130}ms` } : undefined}
        />
      ))}
    </span>
  );
}

/* ───────────────────────── comments panel ──────────────────────── */

function CommentsPanel({
  versionId,
  api,
}: {
  versionId: string;
  api: InteractionsApi;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const refetch = useCallback(async () => {
    const snap = await api.fetch(versionId);
    setViewerId(snap.viewerId);
    setComments(snap.comments);
  }, [api, versionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!viewerId || !draft.trim()) return;
    setPosting(true);
    await api.postComment(versionId, draft.trim());
    setDraft("");
    setPosting(false);
    refetch();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={post} className="flex shrink-0 gap-2 px-4 py-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={viewerId ? "Add a comment…" : "Sign in to comment"}
          disabled={!viewerId}
          maxLength={2000}
        />
        <Button type="submit" disabled={!viewerId || !draft.trim() || posting}>
          Post
        </Button>
      </form>
      <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-caption text-ink-muted">
              {(c.profiles?.display_name || c.profiles?.username || "?")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-caption text-ink-subtle">
                {c.profiles?.display_name || c.profiles?.username || "user"}
                <span className="ml-2 text-ink-tertiary">{formatDate(c.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-body-sm text-ink-muted">
                {c.body}
              </p>
            </div>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="text-body-sm text-ink-tertiary">No comments yet.</li>
        )}
      </ul>
    </div>
  );
}
