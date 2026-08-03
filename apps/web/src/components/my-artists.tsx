"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eyebrow } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/database.types";

type Artist = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
// follows→profiles has two FKs (follower_id, followee_id), so the embed MUST be
// disambiguated by constraint name or PGRST201 (silently-empty) results.
type FollowRow = { created_at: string; followee: Artist | null };

const CAP = 5;

/**
 * "My artists" — a private, glanceable shelf of the producers you follow (a
 * bookmark list, not a feed). Read-only: rows link out to /u/[username]; the
 * card never shows a follower count or anyone else's data. RLS scopes the
 * query to your own follows, so no filter is needed.
 */
export function MyArtists({ className }: { className?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("follows")
      .select(
        "created_at, followee:profiles!follows_followee_id_fkey(id, username, display_name, avatar_url)"
      )
      .order("created_at", { ascending: false })
      .returns<FollowRow[]>();
    setArtists(
      (data ?? [])
        .map((r) => r.followee)
        .filter((a): a is Artist => a != null)
    );
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  const count = artists?.length ?? 0;
  const shown = expanded ? artists ?? [] : (artists ?? []).slice(0, CAP);

  return (
    <section className={cn("border border-hairline bg-surface-1 p-5", className)}>
      <div className="flex items-baseline justify-between">
        <Eyebrow>My artists</Eyebrow>
        {count > 0 && (
          <span className="font-mono text-caption text-ink-tertiary">{count}</span>
        )}
      </div>

      {artists === null ? (
        <p className="mt-4 text-body-sm text-ink-subtle">Loading…</p>
      ) : count === 0 ? (
        <p className="mt-4 text-body-sm text-ink-subtle">
          Artists you follow show up here.
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-0.5">
            {shown.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/u/${a.username}`}
                  className="group flex items-center gap-3 px-1 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <Avatar artist={a} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-sm text-ink">
                      {a.display_name || a.username}
                    </span>
                    <span className="truncate font-mono text-caption text-ink-tertiary">
                      @{a.username}
                    </span>
                  </span>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="shrink-0 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  >
                    <path d="M7.5 4l5 6-5 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
          {count > CAP && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-3 w-full border-t border-hairline pt-3 text-left font-mono text-caption uppercase tracking-[0.28px] text-ink-subtle transition-colors hover:text-ink"
            >
              Show all {count}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Avatar({ artist }: { artist: Artist }) {
  const name = artist.display_name || artist.username;
  return (
    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-hairline bg-surface-3">
      {artist.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
        <img
          src={artist.avatar_url}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-mono text-caption text-ink-muted">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
