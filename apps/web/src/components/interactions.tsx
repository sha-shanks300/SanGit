"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Comment } from "@/lib/database.types";
import { Button, Input } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export type CommentWithAuthor = Comment & {
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

export type InteractionsSnapshot = {
  viewerId: string | null;
  likes: number;
  mine: boolean;
  comments: CommentWithAuthor[];
};

/**
 * Pluggable backend so the same UI serves both the RLS-scoped pages
 * (supabase-js, default) and token-authenticated share-link pages
 * (API routes that validate the share token server-side).
 */
export type InteractionsApi = {
  fetch: (versionId: string) => Promise<InteractionsSnapshot>;
  toggleLike: (versionId: string, like: boolean) => Promise<void>;
  postComment: (versionId: string, body: string) => Promise<void>;
};

export const defaultInteractionsApi: InteractionsApi = {
  async fetch(versionId) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [reactions, commentRows] = await Promise.all([
      supabase.from("reactions").select("user_id, kind").eq("version_id", versionId),
      supabase
        .from("comments")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("version_id", versionId)
        .order("created_at", { ascending: false })
        .returns<CommentWithAuthor[]>(),
    ]);
    const likes = (reactions.data ?? []).filter((r) => r.kind === "like");
    return {
      viewerId: user?.id ?? null,
      likes: likes.length,
      mine: likes.some((r) => r.user_id === user?.id),
      comments: commentRows.data ?? [],
    };
  },
  async toggleLike(versionId, like) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (like) {
      await supabase
        .from("reactions")
        .upsert(
          { version_id: versionId, user_id: user.id, kind: "like" },
          { onConflict: "version_id,user_id" }
        );
    } else {
      await supabase
        .from("reactions")
        .delete()
        .eq("version_id", versionId)
        .eq("user_id", user.id);
    }
  },
  async postComment(versionId, body) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("comments")
      .insert({ version_id: versionId, user_id: user.id, body });
  },
};

/** Heart-like + comments for a version. Sign-in required to interact. */
export function Interactions({
  versionId,
  api = defaultInteractionsApi,
  signInHref = "/login",
}: {
  versionId: string;
  api?: InteractionsApi;
  signInHref?: string;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [mine, setMine] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const refetch = useCallback(async () => {
    const snap = await api.fetch(versionId);
    setViewerId(snap.viewerId);
    setLikes(snap.likes);
    setMine(snap.mine);
    setComments(snap.comments);
  }, [api, versionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function toggleLike() {
    if (!viewerId) return;
    await api.toggleLike(versionId, !mine);
    refetch();
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!viewerId || !draft.trim()) return;
    setPosting(true);
    await api.postComment(versionId, draft.trim());
    setDraft("");
    setPosting(false);
    refetch();
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-6">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLike}
          disabled={!viewerId}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-body-sm transition-colors disabled:opacity-50",
            mine
              ? "border-hairline-tertiary bg-surface-3 text-ink"
              : "border-hairline bg-surface-1 text-ink-subtle hover:text-ink"
          )}
          aria-label={mine ? "Unlike" : "Like"}
          aria-pressed={mine}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill={mine ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M8 13.6S2.4 9.9 2.4 6.2c0-1.9 1.5-3.4 3.2-3.4 1 0 1.9.5 2.4 1.3.5-.8 1.4-1.3 2.4-1.3 1.7 0 3.2 1.5 3.2 3.4 0 3.7-5.6 7.4-5.6 7.4z" />
          </svg>
          {likes}
        </button>
        {!viewerId && (
          <p className="ml-2 text-caption text-ink-tertiary">
            <Link href={signInHref} className="text-ink underline underline-offset-2">
              Sign in
            </Link>{" "}
            to like and comment.
          </p>
        )}
      </div>

      <form onSubmit={postComment} className="mt-5 flex gap-2">
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

      <ul className="mt-5 flex flex-col gap-4">
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
                <span className="ml-2 text-ink-tertiary">
                  {formatDate(c.created_at)}
                </span>
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
