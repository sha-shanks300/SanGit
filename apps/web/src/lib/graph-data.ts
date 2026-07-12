import type { Branch, Version } from "@/lib/database.types";

/**
 * Adapter: branches + versions -> react-force-graph {nodes, links}.
 *
 * Edges encode ancestry, which is what dagMode="lr" enforces every tick:
 * chain edges between consecutive versions of a branch, plus one fork edge
 * from the last parent-branch version saved BEFORE the child branch's first
 * version (same anchor rule as the SVG timeline tree). Depth = generations,
 * not wall-clock time — order is locked within any ancestry chain.
 */

export type GraphNode = {
  id: string;
  version: Version;
  branchName: string;
  isMain: boolean;
  /** Resting y for the zig-zag layout: branch lane ± alternating stagger. */
  zigY: number;
  /** Initial y seed so the first frames already look staggered. */
  y: number;
};

/** Vertical distance between branch lanes. */
const LANE_GAP = 70;
/** Alternating up/down stagger along a chain. */
const ZIG = 32;

export type GraphLink = {
  source: string;
  target: string;
  kind: "chain" | "fork";
};

export function buildGraph(
  branches: Branch[],
  versions: Version[],
  mainVersionId: string | null
): { nodes: GraphNode[]; links: GraphLink[] } {
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const ordered = [...versions].sort(
    (a, b) =>
      new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
  );

  const byBranch = new Map<string, Version[]>();
  for (const v of ordered) {
    const list = byBranch.get(v.branch_id);
    if (list) list.push(v);
    else byBranch.set(v.branch_id, [v]);
  }

  const laneOf = new Map(branches.map((b, i) => [b.id, i]));
  const seqOf = new Map<string, number>();
  for (const list of byBranch.values()) {
    list.forEach((v, i) => seqOf.set(v.id, i));
  }
  const laneCount = Math.max(branches.length, 1);

  const nodes: GraphNode[] = ordered.map((v) => {
    const lane = laneOf.get(v.branch_id) ?? 0;
    const seq = seqOf.get(v.id) ?? 0;
    const zigY =
      (lane - (laneCount - 1) / 2) * LANE_GAP +
      (seq % 2 === 0 ? -ZIG : ZIG);
    return {
      id: v.id,
      version: v,
      branchName: branchName.get(v.branch_id) ?? "",
      isMain: v.id === mainVersionId,
      zigY,
      y: zigY,
    };
  });

  const links: GraphLink[] = [];

  for (const list of byBranch.values()) {
    for (let i = 1; i < list.length; i++) {
      links.push({ source: list[i - 1].id, target: list[i].id, kind: "chain" });
    }
  }

  for (const b of branches) {
    if (!b.parent_branch_id) continue;
    const first = byBranch.get(b.id)?.[0];
    const parentList = byBranch.get(b.parent_branch_id);
    if (!first || !parentList?.length) continue;
    const firstTime = new Date(first.uploaded_at).getTime();
    const anchor =
      [...parentList]
        .reverse()
        .find((p) => new Date(p.uploaded_at).getTime() < firstTime) ??
      parentList[0];
    if (anchor.id !== first.id) {
      links.push({ source: anchor.id, target: first.id, kind: "fork" });
    }
  }

  return { nodes, links };
}
