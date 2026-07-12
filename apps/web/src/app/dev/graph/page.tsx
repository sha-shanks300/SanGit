"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { VersionGraph } from "@/components/version-graph";
import { Eyebrow, Panel } from "@/components/ui";
import type { Branch, Version } from "@/lib/database.types";

/**
 * Dev-only playground: renders the physics graph with mock data (a main
 * branch, two forks, mixed render states) so it can be styled and verified
 * without auth or a live project. 404s in production builds.
 */

const t = (daysAgo: number, hour = 12) =>
  new Date(Date.UTC(2026, 5, 30 - daysAgo, hour)).toISOString();

const P = "00000000-0000-4000-8000-0000000000aa";
const U = "00000000-0000-4000-8000-0000000000bb";

const mkBranch = (id: string, name: string, parent: string | null): Branch => ({
  id,
  project_id: P,
  user_id: U,
  name,
  parent_branch_id: parent,
  created_at: t(20),
});

const mkVersion = (
  id: string,
  branch: string,
  daysAgo: number,
  hour: number,
  name: string | null,
  status: Version["render_status"] = "ready"
): Version => ({
  id,
  branch_id: branch,
  project_id: P,
  user_id: U,
  display_name: name,
  file_name: "demo.flp",
  flp_storage_path: null,
  mp3_storage_path: null,
  render_status: status,
  render_error: null,
  flp_sha256: id.repeat(8).slice(0, 64),
  duration_secs: 180,
  uploaded_at: t(daysAgo, hour),
  created_at: t(daysAgo, hour),
});

const branches: Branch[] = [
  mkBranch("b-main", "midnight-drive", null),
  mkBranch("b-alt", "midnight-drive-halftime", "b-main"),
  mkBranch("b-vox", "midnight-drive-vocals", "b-main"),
];

const versions: Version[] = [
  mkVersion("v1", "b-main", 18, 10, "first sketch"),
  mkVersion("v2", "b-main", 16, 14, "drums locked"),
  mkVersion("v3", "b-main", 12, 9, null),
  mkVersion("v4", "b-alt", 11, 20, "halftime experiment"),
  mkVersion("v5", "b-main", 9, 15, "new bassline"),
  mkVersion("v6", "b-alt", 8, 11, null, "failed"),
  mkVersion("v7", "b-vox", 5, 18, "rough vocal take"),
  mkVersion("v8", "b-main", 3, 13, "pre-master"),
  mkVersion("v9", "b-vox", 1, 16, "comped vocals", "pending"),
];

export default function DevGraphPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [selectedId, setSelectedId] = useState<string | null>("v8");

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
      <Eyebrow>Dev</Eyebrow>
      <h1 className="mt-1 text-headline text-ink">
        Version graph playground
      </h1>
      <Panel className="mt-8 overflow-hidden">
        <VersionGraph
          branches={branches}
          versions={versions}
          mainVersionId="v8"
          selectedId={selectedId}
          onSelect={(v) => setSelectedId(v.id)}
        />
      </Panel>
    </main>
  );
}
