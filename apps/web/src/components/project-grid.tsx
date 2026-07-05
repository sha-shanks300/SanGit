"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/database.types";
import { Card, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type ProjectCard = Project & {
  versions: { count: number }[];
  branches: { count: number }[];
};

/**
 * Live project grid: refetches on any Realtime change to projects or
 * versions, so a commit from the studio PC pops in without a refresh.
 * NB: `versions!versions_project_id_fkey` disambiguates the embed —
 * projects↔versions has a second FK via main_version_id (PGRST201).
 */
export function ProjectGrid() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<ProjectCard[] | null>(null);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*, versions!versions_project_id_fkey(count), branches(count)")
      .order("updated_at", { ascending: false })
      .returns<ProjectCard[]>();
    if (!error) setProjects(data ?? []);
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
    return (
      <Card className="mt-8 max-w-xl">
        <h2 className="text-card-title font-medium text-ink">
          No projects yet
        </h2>
        <p className="mt-2 text-body-sm text-ink-subtle">
          Pair the SanGit local service under{" "}
          <Link href="/settings/devices" className="text-primary-hover">
            Settings → Devices
          </Link>
          , then save your FL Studio project. Your first commit will show up
          here automatically.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
          <Card className="h-full transition-colors hover:border-hairline-strong hover:bg-surface-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-card-title font-medium text-ink">
                {p.title}
              </h2>
              {p.is_public ? (
                <StatusBadge tone="success">public</StatusBadge>
              ) : (
                <StatusBadge>private</StatusBadge>
              )}
            </div>
            <p className="mt-3 text-body-sm text-ink-subtle">
              {p.branches[0]?.count ?? 0} branches · {p.versions[0]?.count ?? 0}{" "}
              versions
            </p>
            <p className="mt-1 text-caption text-ink-tertiary">
              Updated {formatDate(p.updated_at)}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
