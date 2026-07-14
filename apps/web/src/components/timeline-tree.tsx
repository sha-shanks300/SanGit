"use client";

import { useEffect, useMemo, useState } from "react";
import type { Branch, Version } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const LANE_HEIGHT = 64;
const NODE_SPACING = 76;
const LEFT_PAD = 40;
// Tall enough that a crest node (centerline − WAVE_AMP) keeps its "Main"
// caption inside the SVG.
const TOP_PAD = 48;
const NODE_R = 8;
/** Crest/trough offset of the lane wave around its centerline. */
const WAVE_AMP = 12;

type NodePos = {
  version: Version;
  x: number;
  y: number;
  lane: number;
  /** Per-branch chronological number — first save on the branch is v1. */
  label: string;
};

type Layout = {
  nodes: NodePos[];
  lanes: { branch: Branch; y: number }[];
  width: number;
  height: number;
  forks: { fromX: number; fromY: number; toX: number; toY: number }[];
  /** One smooth wave path per lane with ≥2 nodes, keyed by lane index. */
  waves: { lane: number; d: string }[];
};

/**
 * Horizontal "git log --graph", newest first: one lane per branch, nodes in
 * reverse chronological order left→right (the latest save sits at the left
 * edge, no scrolling to reach it), a connector dropping from the parent lane
 * where each branch forks. Within a lane nodes ride a smooth sine-style wave
 * (crest/trough alternating per node); labels under each node give the
 * per-branch version number. Branches only fork (never merge), so the layout
 * is deterministic.
 */
function computeLayout(branches: Branch[], versions: Version[]): Layout {
  const laneOf = new Map<string, number>();
  branches.forEach((b, i) => laneOf.set(b.id, i));

  // Per-branch chronological numbering (oldest = v1), independent of the
  // right-to-left display order.
  const chronological = [...versions].sort(
    (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
  );
  const numberOf = new Map<string, number>();
  const perBranchCount = new Map<string, number>();
  for (const v of chronological) {
    const n = (perBranchCount.get(v.branch_id) ?? 0) + 1;
    perBranchCount.set(v.branch_id, n);
    numberOf.set(v.id, n);
  }

  const ordered = [...chronological].reverse(); // newest → oldest, left → right

  const nodes: NodePos[] = ordered.map((v, i) => {
    const lane = laneOf.get(v.branch_id) ?? 0;
    return {
      version: v,
      x: LEFT_PAD + i * NODE_SPACING,
      y: TOP_PAD + lane * LANE_HEIGHT, // flat; wave offset applied below
      lane,
      label: `v${numberOf.get(v.id) ?? 0}`,
    };
  });

  // Wave offsets: within each lane (nodes already in x order), alternate
  // crest/trough. Single-node lanes stay flat on the centerline.
  const byBranch = new Map<string, NodePos[]>();
  for (const n of nodes) {
    const list = byBranch.get(n.version.branch_id) ?? [];
    list.push(n);
    byBranch.set(n.version.branch_id, list);
  }
  const waves: Layout["waves"] = [];
  for (const laneNodes of byBranch.values()) {
    if (laneNodes.length < 2) continue;
    laneNodes.forEach((n, i) => {
      n.y += i % 2 === 0 ? -WAVE_AMP : WAVE_AMP;
    });
    // Smooth sine feel: cubic segments with horizontal tangents at each node.
    let d = `M ${laneNodes[0].x} ${laneNodes[0].y}`;
    for (let i = 1; i < laneNodes.length; i++) {
      const a = laneNodes[i - 1];
      const b = laneNodes[i];
      const mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
    }
    waves.push({ lane: laneNodes[0].lane, d });
  }

  // Fork connectors: parent anchor (last parent save before the child's
  // first) -> first node of the child branch. With newest on the left,
  // "earlier in time" means further right, so the anchor is the nearest
  // parent node to the child's right.
  const forks: Layout["forks"] = [];
  for (const b of branches) {
    if (!b.parent_branch_id || !laneOf.has(b.parent_branch_id)) continue;
    const laneNodes = byBranch.get(b.id);
    const first = laneNodes?.[laneNodes.length - 1]; // rightmost = oldest
    if (!first) continue;
    const parentNodes = byBranch.get(b.parent_branch_id) ?? [];
    const anchor = parentNodes.find((p) => p.x > first.x);
    const fromX = anchor ? anchor.x : first.x + 24;
    const fromY =
      anchor?.y ?? TOP_PAD + (laneOf.get(b.parent_branch_id) ?? 0) * LANE_HEIGHT;
    forks.push({ fromX, fromY, toX: first.x, toY: first.y });
  }

  return {
    nodes,
    lanes: branches.map((b, i) => ({ branch: b, y: TOP_PAD + i * LANE_HEIGHT })),
    width: LEFT_PAD + Math.max(ordered.length, 1) * NODE_SPACING + 20,
    height: TOP_PAD + Math.max(branches.length, 1) * LANE_HEIGHT + 10,
    forks,
    waves,
  };
}

export function TimelineTree({
  branches,
  versions,
  mainVersionId,
  selectedId,
  onSelect,
  onNodeContextMenu,
}: {
  branches: Branch[];
  versions: Version[];
  mainVersionId: string | null;
  selectedId: string | null;
  onSelect: (version: Version) => void;
  /** Owner-only right-click on a node (viewport coordinates). */
  onNodeContextMenu?: (version: Version, x: number, y: number) => void;
}) {
  const layout = useMemo(
    () => computeLayout(branches, versions),
    [branches, versions]
  );

  // Reflow animation: nodes slide to their recomputed spots via the CSS
  // transition on each <g> transform, while versions that just disappeared
  // linger as "ghosts" at their old positions and shrink/fade out. The
  // previous layout is held in state (adjust-during-render) so ghost
  // positions are known at the moment a version vanishes.
  const [prevLayout, setPrevLayout] = useState(layout);
  const [ghosts, setGhosts] = useState<NodePos[]>([]);
  if (prevLayout !== layout) {
    setPrevLayout(layout);
    const currentIds = new Set(versions.map((v) => v.id));
    const removed = prevLayout.nodes.filter((n) => !currentIds.has(n.version.id));
    if (removed.length > 0) setGhosts(removed);
  }
  useEffect(() => {
    if (ghosts.length === 0) return;
    const t = setTimeout(() => setGhosts([]), 400);
    return () => clearTimeout(t);
  }, [ghosts]);

  const mainLane = useMemo(() => {
    const main = versions.find((v) => v.id === mainVersionId);
    return main ? branches.findIndex((b) => b.id === main.branch_id) : -1;
  }, [versions, branches, mainVersionId]);

  if (versions.length === 0) {
    return (
      <p className="py-10 text-center text-body-sm text-ink-subtle">
        No versions yet — save your project in FL Studio and commit it.
      </p>
    );
  }

  return (
    <div className="flex">
      {/* Branch labels — fixed left column, aligned with lanes. */}
      <div
        className="relative shrink-0 pr-4"
        style={{ height: layout.height, width: 132 }}
      >
        {layout.lanes.map(({ branch, y }, i) => (
          <div
            key={branch.id}
            className={cn(
              "absolute left-0 flex max-w-[128px] items-center gap-1.5 truncate font-mono text-mono",
              i === mainLane ? "text-ink" : "text-ink-subtle"
            )}
            style={{ top: y - 9 }}
            title={branch.name}
          >
            {i === mainLane && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <span className="truncate">{branch.name}</span>
          </div>
        ))}
      </div>

      {/* Scrollable graph. */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <svg
          width={layout.width}
          height={layout.height}
          role="list"
          aria-label="Version timeline"
        >
          {/* lane wave paths (single-node lanes need no line) — keyed by
              shape so a reflow swaps in a fresh path that fades in while the
              dots slide (path `d` strings can't tween in CSS). */}
          {layout.waves.map(({ lane, d }) => (
            <path
              key={`${lane}:${d}`}
              d={d}
              fill="none"
              stroke={lane === mainLane ? "var(--hairline-tertiary)" : "var(--hairline)"}
              strokeWidth={2}
              className="animate-tree-fade-in"
            />
          ))}

          {/* fork connectors */}
          {layout.forks.map((f, i) => (
            <path
              key={`${i}:${f.fromX},${f.fromY},${f.toX},${f.toY}`}
              d={`M ${f.fromX} ${f.fromY} C ${f.fromX + 28} ${f.fromY}, ${f.toX - 28} ${f.toY}, ${f.toX} ${f.toY}`}
              fill="none"
              stroke="var(--hairline-strong)"
              strokeWidth={2}
              className="animate-tree-fade-in"
            />
          ))}

          {/* exiting nodes: shrink and fade at their old spot, then unmount */}
          {ghosts.map(({ version: v, x, y, label }) => (
            <g
              key={`ghost-${v.id}`}
              aria-hidden
              className="pointer-events-none"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <g
                className="animate-tree-node-exit"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <circle
                  r={NODE_R}
                  fill="var(--surface-4)"
                  stroke="var(--hairline-tertiary)"
                  strokeWidth={1.5}
                />
                <text
                  y={NODE_R + 16}
                  textAnchor="middle"
                  className="font-mono"
                  fill="var(--ink-subtle)"
                  fontSize={10}
                >
                  {label}
                </text>
              </g>
            </g>
          ))}

          {/* version nodes */}
          {layout.nodes.map(({ version: v, x, y, label }) => {
            const isMain = v.id === mainVersionId;
            const isSelected = v.id === selectedId;
            const failed = v.render_status === "failed";
            const processing =
              v.render_status === "pending" || v.render_status === "rendering";
            return (
              <g
                key={v.id}
                role="listitem"
                className="cursor-pointer"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transition: "transform 300ms ease",
                }}
                onClick={() => onSelect(v)}
                onContextMenu={
                  onNodeContextMenu
                    ? (e) => {
                        e.preventDefault();
                        onNodeContextMenu(v, e.clientX, e.clientY);
                      }
                    : undefined
                }
              >
                <title>
                  {(v.display_name || v.file_name) +
                    (isMain ? " · Main" : "") +
                    (processing ? " · processing" : failed ? " · render failed" : "")}
                </title>
                {isMain && (
                  <circle
                    r={NODE_R + 5}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                )}
                <circle
                  r={NODE_R}
                  fill={
                    isSelected
                      ? "var(--primary)"
                      : processing
                        ? "var(--surface-3)"
                        : "var(--surface-4)"
                  }
                  stroke={
                    isSelected
                      ? "var(--ink)"
                      : failed
                        ? "var(--ink-tertiary)"
                        : "var(--hairline-tertiary)"
                  }
                  strokeWidth={1.5}
                  strokeDasharray={failed ? "3 2" : undefined}
                  className={processing ? "animate-pulse" : undefined}
                />
                {isMain && (
                  <text
                    y={-NODE_R - 12}
                    textAnchor="middle"
                    fill="var(--primary)"
                    fontSize={10}
                    fontWeight={500}
                  >
                    Main
                  </text>
                )}
                <text
                  y={NODE_R + 16}
                  textAnchor="middle"
                  className="font-mono"
                  fill={isSelected ? "var(--ink)" : "var(--ink-subtle)"}
                  fontSize={10}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
