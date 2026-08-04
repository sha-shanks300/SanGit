"use client";

import Link from "next/link";
import { usePlayer, type PlayerTrack } from "@/components/player-context";

/**
 * Row wrapper for a Main-only project: a plain left-click plays the track and
 * expands the now-playing surface *in place* instead of navigating to
 * /p/[slug]. There is nothing more to see on that page than the surface itself,
 * so a page load would only re-render what the overlay already shows.
 *
 * It stays a real <Link>, not a button: the href keeps middle-click and
 * ⌘/Ctrl-click opening the shareable page in a new tab, right-click → "Copy
 * link address" working, and the destination visible in the status bar. Only
 * the unmodified left-click is intercepted.
 *
 * Falls through to normal navigation when the project has no playable track
 * (`queueIndex < 0`) — there's nothing to expand into, and /p/[slug] renders
 * the "nothing to play yet" state.
 */
export function OpenInPlaceLink({
  href,
  queue,
  queueIndex,
  className,
  children,
}: {
  href: string;
  queue: PlayerTrack[];
  /** This project's index in `queue`, or -1 when its Main isn't playable. */
  queueIndex: number;
  className?: string;
  children: React.ReactNode;
}) {
  const player = usePlayer();

  function onClick(e: React.MouseEvent) {
    // Let the browser handle new-tab / download / context gestures normally.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (queueIndex < 0) return; // nothing to play — navigate instead
    e.preventDefault();
    player.play(queue, queueIndex);
    player.setExpanded(true);
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
