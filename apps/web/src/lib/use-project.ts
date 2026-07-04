"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Branch, Project, Version } from "@/lib/database.types";

export type ProjectData = {
  project: Project | null;
  branches: Branch[];
  versions: Version[];
  loading: boolean;
  refetch: () => void;
};

/**
 * Loads a project with its branches/versions (RLS decides visibility) and
 * live-updates via Realtime when the local service pushes commits or a
 * render finishes.
 */
export function useProject(projectId: string): ProjectData {
  const supabase = useMemo(() => createClient(), []);
  const [project, setProject] = useState<Project | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const [p, b, v] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase
        .from("branches")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("versions")
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at"),
    ]);
    setProject(p.data ?? null);
    setBranches(b.data ?? []);
    setVersions(v.data ?? []);
    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();

    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "versions",
          filter: `project_id=eq.${projectId}`,
        },
        () => refetch()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, projectId, refetch]);

  return { project, branches, versions, loading, refetch };
}
