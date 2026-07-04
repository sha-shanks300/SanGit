"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/lib/use-project";
import type { Version } from "@/lib/database.types";
import { TimelineTree } from "@/components/timeline-tree";
import { PlayerBar } from "@/components/player";
import { VersionPanel } from "@/components/version-panel";
import { Interactions } from "@/components/interactions";
import { ShareManager } from "@/components/share-manager";
import { Eyebrow, Panel, StatusBadge } from "@/components/ui";

/**
 * The project page body: timeline tree panel + detail panel + player bar.
 * Used by both the owner dashboard page and the public project page —
 * `isOwner` gates editing/sharing; RLS gates the data underneath either way.
 */
export function ProjectView({
  projectId,
  isOwner,
  headerActions,
}: {
  projectId: string;
  isOwner: boolean;
  headerActions?: React.ReactNode;
}) {
  const { project, branches, versions, loading, refetch } =
    useProject(projectId);
  const [selected, setSelected] = useState<Version | null>(null);

  // Keep the selected version fresh across realtime refetches (e.g. a
  // processing node flipping to ready), and default to the Main version.
  useEffect(() => {
    if (selected) {
      const updated = versions.find((v) => v.id === selected.id);
      if (updated && updated !== selected) setSelected(updated);
    } else if (project?.main_version_id) {
      const main = versions.find((v) => v.id === project.main_version_id);
      if (main) setSelected(main);
    }
  }, [versions, project?.main_version_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setMain(v: Version) {
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ main_version_id: v.id })
      .eq("id", projectId);
    refetch();
  }

  if (loading) {
    return <p className="py-16 text-center text-body-sm text-ink-subtle">Loading…</p>;
  }
  if (!project) {
    return (
      <p className="py-16 text-center text-body-sm text-ink-subtle">
        Project not found.
      </p>
    );
  }

  return (
    <div className="pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Project</Eyebrow>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-headline font-semibold tracking-tight text-ink">
              {project.title}
            </h1>
            {project.is_public ? (
              <StatusBadge tone="success">public</StatusBadge>
            ) : (
              <StatusBadge>private</StatusBadge>
            )}
          </div>
          <p className="mt-1 text-body-sm text-ink-subtle">
            {branches.length} branch{branches.length === 1 ? "" : "es"} ·{" "}
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">{headerActions}</div>
      </div>

      <Panel className="mt-8 overflow-hidden">
        <Eyebrow className="mb-6">Timeline</Eyebrow>
        <TimelineTree
          branches={branches}
          versions={versions}
          mainVersionId={project.main_version_id}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      </Panel>

      {selected && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VersionPanel
            version={selected}
            isOwner={isOwner}
            mainVersionId={project.main_version_id}
            onChanged={refetch}
          >
            {isOwner && <ShareManager versionId={selected.id} />}
          </VersionPanel>
          <Interactions versionId={selected.id} />
        </div>
      )}

      <PlayerBar
        version={selected}
        versions={versions}
        isOwner={isOwner}
        mainVersionId={project.main_version_id}
        onSelect={setSelected}
        onSetMain={isOwner ? setMain : undefined}
      />
    </div>
  );
}
