"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/lib/use-project";
import type { Version } from "@/lib/database.types";
import { TimelineTree } from "@/components/timeline-tree";
import { VersionGraph } from "@/components/version-graph";
import { cn } from "@/lib/utils";
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
  const [view, setView] = useState<"tree" | "graph">("tree");

  useEffect(() => {
    if (localStorage.getItem("sangit-timeline-view") === "graph")
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unavailable during SSR; restore preference post-mount
      setView("graph");
  }, []);

  function switchView(next: "tree" | "graph") {
    setView(next);
    localStorage.setItem("sangit-timeline-view", next);
  }

  // Keep the selected version fresh across realtime refetches (e.g. a
  // processing node flipping to ready), and default to the Main version.
  // Adjust-during-render: the guards make this settle in one extra pass.
  if (selected) {
    const updated = versions.find((v) => v.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  } else if (project?.main_version_id) {
    const main = versions.find((v) => v.id === project.main_version_id);
    if (main) setSelected(main);
  }

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
        <div className="mb-6 flex items-center justify-between">
          <Eyebrow>Timeline</Eyebrow>
          <div className="flex gap-1" role="tablist" aria-label="Timeline view">
            {(["tree", "graph"] as const).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={view === mode}
                onClick={() => switchView(mode)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-button capitalize transition-colors",
                  view === mode
                    ? "bg-surface-2 text-ink"
                    : "text-ink-subtle hover:text-ink"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {view === "graph" ? (
          <VersionGraph
            branches={branches}
            versions={versions}
            mainVersionId={project.main_version_id}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        ) : (
          <TimelineTree
            branches={branches}
            versions={versions}
            mainVersionId={project.main_version_id}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        )}
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
