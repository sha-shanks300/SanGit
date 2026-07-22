"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectRow, type ProjectRowData } from "@/components/project-row";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

/**
 * Live project list (SoundCloud-style rows): refetches on any Realtime change
 * to projects or versions, so a commit from the studio PC pops in without a
 * refresh. NB: `versions!versions_project_id_fkey` disambiguates the embed —
 * projects↔versions has a second FK via main_version_id (PGRST201).
 */
export function ProjectRows() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<ProjectRowData[] | null>(null);

  const refetch = useCallback(async () => {
    // "Recent" means the last commit, not projects.updated_at — settings
    // saves bump updated_at and would shove stale projects to the top.
    const { data, error } = await supabase
      .from("projects")
      .select(
        "*, versions!versions_project_id_fkey(count), branches(count), latest:versions!versions_project_id_fkey(uploaded_at)"
      )
      .order("uploaded_at", { referencedTable: "latest", ascending: false })
      .limit(1, { referencedTable: "latest" })
      .returns<ProjectRowData[]>();
    if (!error)
      setProjects(
        (data ?? []).sort(
          (a, b) =>
            +new Date(b.latest?.[0]?.uploaded_at ?? b.created_at) -
            +new Date(a.latest?.[0]?.uploaded_at ?? a.created_at)
        )
      );
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
    const channel = supabase
      .channel("dashboard-projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "versions" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  if (projects === null) {
    return (
      <p className="mt-8 text-body-sm text-ink-subtle">Loading projects…</p>
    );
  }

  if (projects.length === 0) {
    return <OnboardingChecklist />;
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {projects.map((p) => (
        <ProjectRow
          key={p.id}
          project={p}
          href={`/dashboard/projects/${p.id}`}
        />
      ))}
    </div>
  );
}
