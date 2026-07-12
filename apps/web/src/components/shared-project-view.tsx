"use client";

import { useMemo, useState } from "react";
import type { Branch, Version } from "@/lib/database.types";
import { TimelineTree } from "@/components/timeline-tree";
import { VersionGraph } from "@/components/version-graph";
import { PlayerBar } from "@/components/player";
import { VersionPanel } from "@/components/version-panel";
import { Interactions, type InteractionsApi } from "@/components/interactions";
import { SignInPrompt } from "@/components/signin-prompt";
import { Eyebrow, Panel, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/utils";

export type SharedProjectPayload = {
  project: {
    id: string;
    title: string;
    artwork_url: string | null;
    main_version_id: string | null;
    owner: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  branches: Branch[];
  versions: Version[];
};

/**
 * Read-only project view behind a project-scoped share link: full version
 * list, Tree/Graph toggle, player for any ready version, comments + likes.
 * Writes (like/comment) go through token-authenticated routes and require a
 * signed-in session; nothing owner-only (Set as Main, settings, sharing) is
 * reachable here.
 */
export function SharedProjectView({
  token,
  payload,
}: {
  token: string;
  payload: SharedProjectPayload;
}) {
  const { project, branches, versions } = payload;
  const [selected, setSelected] = useState<Version | null>(
    () =>
      versions.find((v) => v.id === project.main_version_id) ??
      versions[versions.length - 1] ??
      null
  );
  const [view, setView] = useState<"tree" | "graph">("tree");

  // Same UI as project-view's Interactions, backed by the token routes.
  const tokenApi = useMemo<InteractionsApi>(
    () => ({
      async fetch(versionId) {
        const res = await fetch(`/api/listen/${token}/interactions/${versionId}`);
        if (!res.ok) {
          return { viewerId: null, likes: 0, mine: false, comments: [] };
        }
        return res.json();
      },
      async toggleLike(versionId, like) {
        await fetch(`/api/listen/${token}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version_id: versionId, like }),
        });
      },
      async postComment(versionId, body) {
        await fetch(`/api/listen/${token}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version_id: versionId, body }),
        });
      },
    }),
    [token]
  );

  const ownerName =
    project.owner?.display_name || project.owner?.username || null;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Shared project</Eyebrow>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-headline text-ink">{project.title}</h1>
            <StatusBadge>private preview</StatusBadge>
          </div>
          <p className="mt-1 text-body-sm text-ink-subtle">
            {ownerName ? `by ${ownerName} · ` : ""}
            {branches.length} branch{branches.length === 1 ? "" : "es"} ·{" "}
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </p>
        </div>
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
                onClick={() => setView(mode)}
                className={cn(
                  "border px-3.5 py-1.5 text-button capitalize transition-colors",
                  view === mode
                    ? "border-hairline-strong bg-surface-2 text-ink"
                    : "border-transparent text-ink-subtle hover:text-ink"
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
            isOwner={false}
            mainVersionId={project.main_version_id}
            onChanged={() => {}}
          />
          <Interactions
            versionId={selected.id}
            api={tokenApi}
            signInHref={`/login?next=${encodeURIComponent(`/s/${token}`)}`}
          />
        </div>
      )}

      <PlayerBar
        version={selected}
        versions={versions}
        isOwner={false}
        mainVersionId={project.main_version_id}
        onSelect={setSelected}
        audioUrlFor={(id) => `/api/listen/${token}/audio/${id}`}
      />

      <SignInPrompt next={`/s/${token}`} />
    </main>
  );
}
