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

  // Horizontal columns come from the BRANCH STRUCTURE, not global wall-clock
  // order: a fork's first (oldest) node shares its sibling's column — the
  // column just after the fork anchor on the parent — so siblings sit
  // vertically parallel instead of the fork sliding off to one side.
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const timeOf = (v: Version) => new Date(v.uploaded_at).getTime();
  const byBranchChrono = new Map<string, Version[]>(); // oldest → newest per branch
  for (const v of chronological) {
    const list = byBranchChrono.get(v.branch_id) ?? [];
    list.push(v);
    byBranchChrono.set(v.branch_id, list);
  }

  // The version a branch forked from (explicit anchor, else timestamp guess).
  const anchorVersionId = (b: Branch): string | null => {
    if (b.fork_version_id && versionById.has(b.fork_version_id)) return b.fork_version_id;
    if (!b.parent_branch_id) return null;
    const parentList = byBranchChrono.get(b.parent_branch_id);
    const first = byBranchChrono.get(b.id)?.[0];
    if (!parentList?.length || !first) return null;
    const ft = timeOf(first);
    let anchor: Version | null = null;
    for (const p of parentList) if (timeOf(p) < ft) anchor = p;
    return (anchor ?? parentList[0]).id;
  };

  const column = new Map<string, number>();
  // Place a branch: its oldest node at `firstCol`, each newer node one column
  // left (smaller), so the newest overall ends up leftmost.
  const place = (b: Branch, firstCol: number) => {
    (byBranchChrono.get(b.id) ?? []).forEach((v, k) => column.set(v.id, firstCol - k));
  };
  // Assign parents before children so a fork's anchor column is ready first.
  const pending = branches.filter((b) => (byBranchChrono.get(b.id)?.length ?? 0) > 0);
  let guard = pending.length + 1;
  while (pending.length && guard-- > 0) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const b = pending[i];
      const list = byBranchChrono.get(b.id)!;
      const aId = b.parent_branch_id ? anchorVersionId(b) : null;
      if (aId === null) {
        place(b, list.length - 1); // root (or unresolved): newest at column 0
        pending.splice(i, 1);
      } else if (column.has(aId)) {
        place(b, column.get(aId)! - 1); // first node aligns with the sibling column
        pending.splice(i, 1);
      }
    }
  }
  for (const b of pending) place(b, (byBranchChrono.get(b.id)?.length ?? 1) - 1);

  let minCol = 0;
  for (const c of column.values()) minCol = Math.min(minCol, c);
  const colOf = (v: Version) => (column.get(v.id) ?? 0) - minCol;
  let maxCol = 0;
  for (const v of versions) maxCol = Math.max(maxCol, colOf(v));

  const nodes: NodePos[] = ordered.map((v) => {
    const lane = laneOf.get(v.branch_id) ?? 0;
    return {
      version: v,
      x: LEFT_PAD + colOf(v) * NODE_SPACING,
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

  // Fork connectors: from the version the branch forked off -> first node of
  // the child branch. Prefer the explicit fork_version_id (a Branch & commit
  // forks off the tip's PARENT, i.e. a sibling of the tip); fall back to the
  // timestamp guess (nearest parent node just older than the child's first)
  // for branches created before fork_version_id existed.
  const nodeById = new Map(nodes.map((n) => [n.version.id, n]));
  const forks: Layout["forks"] = [];
  for (const b of branches) {
    if (!b.parent_branch_id || !laneOf.has(b.parent_branch_id)) continue;
    const laneNodes = byBranch.get(b.id);
    const first = laneNodes?.[laneNodes.length - 1]; // rightmost = oldest
    if (!first) continue;
    let anchor: NodePos | undefined = b.fork_version_id
      ? nodeById.get(b.fork_version_id)
      : undefined;
    if (!anchor) {
      const parentNodes = byBranch.get(b.parent_branch_id) ?? [];
      anchor = parentNodes.find((p) => p.x > first.x);
    }
    const fromX = anchor ? anchor.x : first.x + 24;
    const fromY =
      anchor?.y ?? TOP_PAD + (laneOf.get(b.parent_branch_id) ?? 0) * LANE_HEIGHT;
    forks.push({ fromX, fromY, toX: first.x, toY: first.y });
  }

  return {
    nodes,
    lanes: branches.map((b, i) => ({ branch: b, y: TOP_PAD + i * LANE_HEIGHT })),
    width: LEFT_PAD + (maxCol + 1) * NODE_SPACING + 20,
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
  onBranchLabelClick,
  likesByVersion,
  mostLikedId = null,
}: {
  branches: Branch[];
  versions: Version[];
  mainVersionId: string | null;
  selectedId: string | null;
  onSelect: (version: Version) => void;
  /** Owner-only right-click on a node (viewport coordinates). */
  onNodeContextMenu?: (version: Version, x: number, y: number) => void;
  /** Owner-only left-click on a fork branch's label (viewport coordinates). */
  onBranchLabelClick?: (branch: Branch, x: number, y: number) => void;
  /** Owner-only per-version like counts; presence enables the likes tooltip. */
  likesByVersion?: Map<string, number>;
  /** Owner-only: the most-liked version, crowned with a heart badge. */
  mostLikedId?: string | null;
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
        {layout.lanes.map(({ branch, y }, i) => {
          // The trunk (no parent) shows as "default" — a neutral origin label,
          // kept distinct from the Main *version* star. Forks keep their name.
          const isRoot = branch.parent_branch_id === null;
          const displayName = isRoot ? "default" : branch.name;
          // every lane is clickable for owners now (the trunk too — you can
          // Set as Main onto it); the menu itself hides Delete for the trunk.
          const clickable = Boolean(onBranchLabelClick);
          return (
            <div
              key={branch.id}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={
                clickable
                  ? (e) => onBranchLabelClick!(branch, e.clientX, e.clientY)
                  : undefined
              }
              className={cn(
                "absolute left-0 flex max-w-[128px] items-center gap-1.5 truncate font-mono text-mono",
                i === mainLane ? "text-ink" : "text-ink-subtle",
                clickable && "cursor-pointer hover:text-ink"
              )}
              style={{ top: y - 9 }}
              title={
                clickable ? `${displayName} — branch actions` : displayName
              }
            >
              {/* dot column reserved on every lane so names left-align; only the
                  lane holding the Main version shows the red mark */}
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  i === mainLane ? "bg-primary" : "bg-transparent"
                )}
              />
              <span className="truncate">{displayName}</span>
            </div>
          );
        })}
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

          {/* fork connectors — same sine style as the lane waves: cubic with
              horizontal tangents at both ends, control points at the midpoint x */}
          {layout.forks.map((f, i) => {
            const mx = (f.fromX + f.toX) / 2;
            return (
              <path
                key={`${i}:${f.fromX},${f.fromY},${f.toX},${f.toY}`}
                d={`M ${f.fromX} ${f.fromY} C ${mx} ${f.fromY}, ${mx} ${f.toY}, ${f.toX} ${f.toY}`}
                fill="none"
                stroke="var(--hairline-strong)"
                strokeWidth={2}
                className="animate-tree-fade-in"
              />
            );
          })}

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
            const likeCount = likesByVersion?.get(v.id) ?? 0;
            const isMostLiked = v.id === mostLikedId;
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
                    (likesByVersion ? ` · ${likeCount} like${likeCount === 1 ? "" : "s"}` : "") +
                    (isMostLiked ? " · most liked" : "") +
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
                {/* Most-liked crown: filled Rosso heart + count at the node's
                    upper-right, canvas-outlined so it reads over the Main ring
                    when a version is both. */}
                {isMostLiked && (
                  <g transform={`translate(${NODE_R + 1}, ${-NODE_R - 3})`}>
                    <path
                      transform="scale(0.72)"
                      d="M8 13.6S2.4 9.9 2.4 6.2c0-1.9 1.5-3.4 3.2-3.4 1 0 1.9.5 2.4 1.3.5-.8 1.4-1.3 2.4-1.3 1.7 0 3.2 1.5 3.2 3.4 0 3.7-5.6 7.4-5.6 7.4z"
                      fill="var(--primary)"
                      stroke="var(--canvas)"
                      strokeWidth={1.4}
                    />
                    <text
                      x={13}
                      y={9}
                      className="font-mono"
                      fill="var(--primary)"
                      fontSize={9}
                      fontWeight={600}
                    >
                      {likeCount}
                    </text>
                  </g>
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
