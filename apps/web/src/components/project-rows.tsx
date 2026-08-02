"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectRow, type ProjectRowData } from "@/components/project-row";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ProjectsSectionHeading } from "@/components/section-heading";
import type { PlayerTrack } from "@/components/player-context";

/**
 * Live project list (SoundCloud-style rows): refetches on any Realtime change
 * to projects or versions, so a commit from the studio PC pops in without a
 * refresh. NB: `versions!versions_project_id_fkey` disambiguates the embed —
 * projects↔versions has a second FK via main_version_id (PGRST201).
 */
export function ProjectRows({ artistName }: { artistName?: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<ProjectRowData[] | null>(null);

  const refetch = useCallback(async () => {
    // The dashboard is an owner-only view, so scope to the current user.
    // RLS alone is NOT enough here: "public projects are readable" makes every
    // is_public row world-readable (for public profiles/share pages), so an
    // unscoped select would surface every user's public catalog on this page.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProjects([]);
      return;
    }
    // "Recent" means the last commit, not projects.updated_at — settings
    // saves bump updated_at and would shove stale projects to the top.
    const { data, error } = await supabase
      .from("projects")
      .select(
        // `main:` embeds the Main version row via the *other* projects↔versions
        // FK (projects_main_version_fk) — must be named to dodge PGRST201.
        "*, versions!versions_project_id_fkey(count), branches(count), latest:versions!versions_project_id_fkey(uploaded_at), main:versions!projects_main_version_fk(*)"
      )
      .eq("user_id", user.id)
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

  // Dashboard playback is a playlist of Main tracks: one entry per project
  // whose Main is rendered, in dashboard order. Next/prev hop across projects;
  // projects without a ready Main simply have no play affordance.
  const { queue, indexByProject } = useMemo(() => {
    const q: PlayerTrack[] = [];
    const byId = new Map<string, number>();
    for (const p of projects ?? []) {
      if (p.main && p.main.render_status === "ready") {
        byId.set(p.id, q.length);
        q.push({
          version: p.main,
          meta: {
            projectId: p.id,
            projectTitle: p.title,
            artistName,
            artworkUrl: p.artwork_url,
            isOwner: true,
            mainVersionId: p.main_version_id,
          },
        });
      }
    }
    return { queue: q, indexByProject: byId };
  }, [projects, artistName]);

  if (projects === null) {
    return (
      <section className="mt-12">
        <ProjectsSectionHeading title="Projects" />
        <p className="mt-6 text-body-sm text-ink-subtle">Loading projects…</p>
      </section>
    );
  }

  if (projects.length === 0) {
    return (
      <section className="mt-12">
        <OnboardingChecklist />
      </section>
    );
  }

  return (
    <section className="mt-12">
      <ProjectsSectionHeading title="Projects" count={projects.length} />
      <div className="mt-6 flex flex-col gap-3">
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            href={`/dashboard/projects/${p.id}`}
            playQueue={queue}
            playIndex={indexByProject.get(p.id) ?? -1}
          />
        ))}
      </div>
    </section>
  );
}
