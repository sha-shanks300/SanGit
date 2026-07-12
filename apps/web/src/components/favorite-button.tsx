"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Star = favourite a whole project (a bookmark), distinct from the per-version
 * heart like. Signed-out viewers see the count with the button disabled.
 * Works inside <Link> rows: the click never propagates to the row navigation.
 */
export function FavoriteButton({
  projectId,
  compact,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("favorites")
      .select("user_id")
      .eq("project_id", projectId);
    const rows = data ?? [];
    setViewerId(user?.id ?? null);
    setCount(rows.length);
    setMine(rows.some((r) => r.user_id === user?.id));
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!viewerId || busy) return;
    setBusy(true);
    const supabase = createClient();
    if (mine) {
      await supabase
        .from("favorites")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", viewerId);
    } else {
      await supabase
        .from("favorites")
        .insert({ project_id: projectId, user_id: viewerId });
    }
    await refetch();
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={!viewerId}
      className={cn(
        "flex items-center gap-1.5 rounded-md border text-body-sm transition-colors disabled:opacity-50",
        compact ? "px-2 py-1" : "px-3 py-1.5",
        mine
          ? "border-hairline-tertiary bg-surface-3 text-ink"
          : "border-hairline bg-surface-1 text-ink-subtle hover:text-ink"
      )}
      aria-label={mine ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={mine}
      title={mine ? "Remove from favourites" : "Add to favourites"}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill={mine ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M8 1l2 5h5l-4 3.5L12.5 15 8 11.8 3.5 15 5 9.5 1 6h5z" />
      </svg>
      {count}
    </button>
  );
}
