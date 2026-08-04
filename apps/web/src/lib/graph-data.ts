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
  // the trunk (no parent) reads "default", mirroring the tree; forks keep names
  const branchName = new Map(
    branches.map((b) => [b.id, b.parent_branch_id === null ? "default" : b.name])
  );
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

  const versionIds = new Set(ordered.map((v) => v.id));
  const branchOf = new Map(ordered.map((v) => [v.id, v.branch_id]));

  // Fork anchor for a branch's first node when its parent wasn't recorded
  // (legacy rows): the explicit fork_version_id, else the timestamp guess (last
  // parent-branch version saved before this branch began).
  const forkAnchor = (branchId: string, first: Version): string | null => {
    const b = branches.find((x) => x.id === branchId);
    if (!b) return null;
    if (b.fork_version_id && versionIds.has(b.fork_version_id)) return b.fork_version_id;
    if (!b.parent_branch_id) return null;
    const parentList = byBranch.get(b.parent_branch_id);
    if (!parentList?.length) return null;
    const firstTime = new Date(first.uploaded_at).getTime();
    const anchor =
      [...parentList]
        .reverse()
        .find((p) => new Date(p.uploaded_at).getTime() < firstTime) ??
      parentList[0];
    return anchor.id;
  };

  // One edge per version, from its parent. Prefer the recorded parent_version_id
  // (open-tree ancestry); fall back to the branch chain (previous node), or the
  // fork anchor for a branch's first node. Same branch => chain, else fork.
  const links: GraphLink[] = [];
  for (const list of byBranch.values()) {
    list.forEach((v, i) => {
      let parentId: string | null = null;
      if (v.parent_version_id && versionIds.has(v.parent_version_id)) {
        parentId = v.parent_version_id;
      } else if (i > 0) {
        parentId = list[i - 1].id;
      } else {
        parentId = forkAnchor(v.branch_id, v);
      }
      if (parentId && parentId !== v.id) {
        const kind = branchOf.get(parentId) === v.branch_id ? "chain" : "fork";
        links.push({ source: parentId, target: v.id, kind });
      }
    });
  }

  return { nodes, links };
}
