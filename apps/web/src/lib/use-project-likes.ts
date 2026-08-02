"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProjectLikes = {
  /** version_id → like count. Only versions with ≥1 like appear. */
  likesByVersion: Map<string, number>;
  /** Sum of every version's likes — the project's total-likes stat. */
  total: number;
};

/**
 * Owner-only per-version like counts for a project, tallied from the
 * `reactions` table (kind='like'; dislikes are retired). Powers the
 * most-liked-version crown on the tree/graph and the project's total-likes
 * stat. Live: refetches on any reaction change. Returns empty when disabled —
 * these stats are never shown to listeners.
 */
export function useProjectLikes(
  projectId: string,
  versionIds: string[],
  enabled: boolean
): ProjectLikes {
  const supabase = useMemo(() => createClient(), []);
  const [likesByVersion, setLikesByVersion] = useState<Map<string, number>>(
    () => new Map()
  );
  const key = versionIds.join(",");

  const refetch = useCallback(async () => {
    if (!enabled || versionIds.length === 0) {
      setLikesByVersion(new Map());
      return;
    }
    const { data } = await supabase
      .from("reactions")
      .select("version_id")
      .eq("kind", "like")
      .in("version_id", versionIds);
    const counts = new Map<string, number>();
    for (const r of data ?? [])
      counts.set(r.version_id, (counts.get(r.version_id) ?? 0) + 1);
    setLikesByVersion(counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for the versionIds identity
  }, [supabase, key, enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
    if (!enabled) return;
    // reactions carry no project_id, so we can't server-filter the stream;
    // any reaction change refetches (cheap for a single producer).
    const channel = supabase
      .channel(`project-likes-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, projectId, refetch, enabled]);

  const total = useMemo(() => {
    let t = 0;
    for (const c of likesByVersion.values()) t += c;
    return t;
  }, [likesByVersion]);

  return { likesByVersion, total };
}
