"use client";

import { useMemo } from "react";
import type { Branch, Version } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const LANE_HEIGHT = 64;
const NODE_SPACING = 76;
const LEFT_PAD = 40;
const TOP_PAD = 36;
const NODE_R = 8;

type NodePos = { version: Version; x: number; y: number; lane: number };

type Layout = {
  nodes: NodePos[];
  lanes: { branch: Branch; y: number }[];
  width: number;
  height: number;
  forks: { fromX: number; fromY: number; toX: number; toY: number }[];
};

/**
 * Horizontal "git log --graph": one lane per branch, nodes in global
 * chronological order left→right, a connector dropping from the parent lane
 * where each branch forks. Branches only fork (never merge), so the layout
 * is deterministic.
 */
function computeLayout(branches: Branch[], versions: Version[]): Layout {
  const laneOf = new Map<string, number>();
  branches.forEach((b, i) => laneOf.set(b.id, i));

  const ordered = [...versions].sort(
    (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
  );

  const nodes: NodePos[] = ordered.map((v, i) => {
    const lane = laneOf.get(v.branch_id) ?? 0;
    return {
      version: v,
      x: LEFT_PAD + i * NODE_SPACING,
      y: TOP_PAD + lane * LANE_HEIGHT,
      lane,
    };
  });

  const byBranch = new Map<string, NodePos[]>();
  for (const n of nodes) {
    const list = byBranch.get(n.version.branch_id) ?? [];
    list.push(n);
    byBranch.set(n.version.branch_id, list);
  }

  // Fork connectors: parent lane -> first node of the child branch.
  const forks: Layout["forks"] = [];
  for (const b of branches) {
    if (!b.parent_branch_id || !laneOf.has(b.parent_branch_id)) continue;
    const first = byBranch.get(b.id)?.[0];
    if (!first) continue;
    const parentNodes = byBranch.get(b.parent_branch_id) ?? [];
    const anchor = [...parentNodes].reverse().find((p) => p.x < first.x);
    const fromX = anchor ? anchor.x : LEFT_PAD - 24;
    const fromY = TOP_PAD + (laneOf.get(b.parent_branch_id) ?? 0) * LANE_HEIGHT;
    forks.push({ fromX, fromY, toX: first.x, toY: first.y });
  }

  return {
    nodes,
    lanes: branches.map((b, i) => ({ branch: b, y: TOP_PAD + i * LANE_HEIGHT })),
    width: LEFT_PAD + Math.max(ordered.length, 1) * NODE_SPACING + 20,
    height: TOP_PAD + Math.max(branches.length, 1) * LANE_HEIGHT + 10,
    forks,
  };
}

export function TimelineTree({
  branches,
  versions,
  mainVersionId,
  selectedId,
  onSelect,
}: {
  branches: Branch[];
  versions: Version[];
  mainVersionId: string | null;
  selectedId: string | null;
  onSelect: (version: Version) => void;
}) {
  const layout = useMemo(
    () => computeLayout(branches, versions),
    [branches, versions]
  );

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
          {/* lane guide lines */}
          {layout.lanes.map(({ branch, y }, i) => {
            const laneNodes = layout.nodes.filter((n) => n.lane === i);
            if (laneNodes.length === 0) return null;
            const x1 = laneNodes[0].x;
            const x2 = laneNodes[laneNodes.length - 1].x;
            return (
              <line
                key={branch.id}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={i === mainLane ? "var(--hairline-tertiary)" : "var(--hairline)"}
                strokeWidth={2}
              />
            );
          })}

          {/* fork connectors */}
          {layout.forks.map((f, i) => (
            <path
              key={i}
              d={`M ${f.fromX} ${f.fromY} C ${f.fromX + 28} ${f.fromY}, ${f.toX - 28} ${f.toY}, ${f.toX} ${f.toY}`}
              fill="none"
              stroke="var(--hairline-strong)"
              strokeWidth={2}
            />
          ))}

          {/* version nodes */}
          {layout.nodes.map(({ version: v, x, y }) => {
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
                onClick={() => onSelect(v)}
              >
                <title>
                  {(v.display_name || v.file_name) +
                    (isMain ? " · Main" : "") +
                    (processing ? " · processing" : failed ? " · render failed" : "")}
                </title>
                {isMain && (
                  <circle
                    cx={x}
                    cy={y}
                    r={NODE_R + 5}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
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
                    x={x}
                    y={y - NODE_R - 12}
                    textAnchor="middle"
                    fill="var(--primary)"
                    fontSize={10}
                    fontWeight={500}
                  >
                    Main
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
