"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Comment, ReactionKind } from "@/lib/database.types";
import { Button, Input } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type CommentWithAuthor = Comment & {
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

/** Like/dislike + comments for a version. Sign-in required to interact. */
export function Interactions({ versionId }: { versionId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [mine, setMine] = useState<ReactionKind | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [reactions, commentRows] = await Promise.all([
      supabase.from("reactions").select("user_id, kind").eq("version_id", versionId),
      supabase
        .from("comments")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("version_id", versionId)
        .order("created_at", { ascending: false })
        .returns<CommentWithAuthor[]>(),
    ]);

    const rows = reactions.data ?? [];
    setLikes(rows.filter((r) => r.kind === "like").length);
    setDislikes(rows.filter((r) => r.kind === "dislike").length);
    setMine(
      (rows.find((r) => r.user_id === user?.id)?.kind as ReactionKind) ?? null
    );
    setComments(commentRows.data ?? []);
  }, [versionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function react(kind: ReactionKind) {
    if (!userId) return;
    const supabase = createClient();
    if (mine === kind) {
      await supabase
        .from("reactions")
        .delete()
        .eq("version_id", versionId)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("reactions")
        .upsert(
          { version_id: versionId, user_id: userId, kind },
          { onConflict: "version_id,user_id" }
        );
    }
    refetch();
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !draft.trim()) return;
    setPosting(true);
    const supabase = createClient();
    await supabase
      .from("comments")
      .insert({ version_id: versionId, user_id: userId, body: draft.trim() });
    setDraft("");
    setPosting(false);
    refetch();
  }

  const reactionBtn = (kind: ReactionKind, count: number, label: string, flip?: boolean) => (
    <button
      onClick={() => react(kind)}
      disabled={!userId}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-body-sm transition-colors disabled:opacity-50",
        mine === kind
          ? "border-hairline-tertiary bg-surface-3 text-ink"
          : "border-hairline bg-surface-1 text-ink-subtle hover:text-ink"
      )}
      aria-label={label}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        style={flip ? { transform: "scaleY(-1)" } : undefined}
      >
        <path d="M8 1l2 5h5l-4 3.5L12.5 15 8 11.8 3.5 15 5 9.5 1 6h5z" />
      </svg>
      {count}
    </button>
  );

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-6">
      <div className="flex items-center gap-2">
        {reactionBtn("like", likes, "Like")}
        {reactionBtn("dislike", dislikes, "Dislike", true)}
        {!userId && (
          <p className="ml-2 text-caption text-ink-tertiary">
            <Link href="/login" className="text-primary-hover">
              Sign in
            </Link>{" "}
            to react and comment.
          </p>
        )}
      </div>

      <form onSubmit={postComment} className="mt-5 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={userId ? "Add a comment…" : "Sign in to comment"}
          disabled={!userId}
          maxLength={2000}
        />
        <Button type="submit" disabled={!userId || !draft.trim() || posting}>
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
