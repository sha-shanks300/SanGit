"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Branch, Version } from "@/lib/database.types";
import { buildGraph, type GraphNode } from "@/lib/graph-data";
import { StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

// Canvas + window access — client-only bundle, loaded when the tab opens.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <p className="py-16 text-center text-body-sm text-ink-subtle">
      Loading graph…
    </p>
  ),
});

/** Simulation node: library adds/mutates position fields at runtime. */
type SimNode = GraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type Tokens = Record<
  | "surface3"
  | "surface4"
  | "hairline"
  | "hairlineStrong"
  | "hairlineTertiary"
  | "ink"
  | "inkSubtle"
  | "inkTertiary"
  | "primary"
  | "primaryHover",
  string
>;

/** Canvas can't use Tailwind classes — read the theme vars once at mount. */
function readTokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    surface3: v("--surface-3", "#141516"),
    surface4: v("--surface-4", "#191a1b"),
    hairline: v("--hairline", "#23252a"),
    hairlineStrong: v("--hairline-strong", "#2e3035"),
    hairlineTertiary: v("--hairline-tertiary", "#3a3d44"),
    ink: v("--ink", "#f7f8f8"),
    inkSubtle: v("--ink-subtle", "#8a8f98"),
    inkTertiary: v("--ink-tertiary", "#62666d"),
    primary: v("--primary", "#5e6ad2"),
    primaryHover: v("--primary-hover", "#828fff"),
  };
}

const NODE_R = 5;

/**
 * Obsidian-style physics view of the version DAG. dagMode="lr" re-applies
 * the ancestry constraint every tick, so nodes can be dragged freely but a
 * descendant can never settle upstream of its ancestor.
 */
export function VersionGraph({
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [hover, setHover] = useState<{
    node: GraphNode;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time DOM reads (canvas theming + measurement) must run post-mount
    setTokens(readTokens());
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const height = Math.max(300, Math.min(520, 140 + branches.length * 70));

  const graphData = useMemo(
    () => buildGraph(branches, versions, mainVersionId),
    [branches, versions, mainVersionId]
  );

  // Direct DAG neighbors per node — the horizontal drag corridor.
  const neighbors = useMemo(() => {
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const l of graphData.links) {
      (children.get(l.source) ?? children.set(l.source, []).get(l.source)!).push(l.target);
      (parents.get(l.target) ?? parents.set(l.target, []).get(l.target)!).push(l.source);
    }
    const byId = new Map(graphData.nodes.map((n) => [n.id, n as SimNode]));
    return { parents, children, byId };
  }, [graphData]);

  /** x-range a node may occupy without crossing its prev/next versions. */
  function dragBounds(id: string): [number, number] {
    const GAP = 24;
    let min = -Infinity;
    let max = Infinity;
    for (const pid of neighbors.parents.get(id) ?? []) {
      const p = neighbors.byId.get(pid);
      if (p?.x != null) min = Math.max(min, p.x + GAP);
    }
    for (const cid of neighbors.children.get(id) ?? []) {
      const c = neighbors.byId.get(cid);
      if (c?.x != null) max = Math.min(max, c.x - GAP);
    }
    return min <= max ? [min, max] : [min, min]; // degenerate: sit at the floor
  }

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 && tokens && (
        <ForceGraph2D
          graphData={graphData}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          dagMode="lr"
          dagLevelDistance={64}
          cooldownTime={5000}
          enableNodeDrag
          onNodeDrag={(node) => {
            // Live-clamp x to the corridor between prev/next versions;
            // y stays free.
            const n = node as SimNode;
            if (n.x == null) return;
            const [min, max] = dragBounds(n.id);
            const clamped = Math.min(Math.max(n.x, min), max);
            if (clamped !== n.x) {
              n.x = clamped;
              n.fx = clamped;
            }
          }}
          onNodeDragEnd={(node) => {
            // Pin where dropped (so the node stays put), but never outside
            // the chronological corridor.
            const n = node as SimNode;
            if (n.x == null || n.y == null) return;
            const [min, max] = dragBounds(n.id);
            n.fx = Math.min(Math.max(n.x, min), max);
            n.fy = n.y;
          }}
          onNodeClick={(node) => onSelect((node as SimNode).version)}
          onNodeHover={(node) => {
            const n = node as SimNode | null;
            setHover(
              n && n.x != null && n.y != null
                ? { node: n, x: n.x, y: n.y }
                : null
            );
          }}
          linkColor={(link) =>
            (link as { kind?: string }).kind === "fork"
              ? tokens.hairlineTertiary
              : tokens.hairlineStrong
          }
          linkLineDash={(link) =>
            (link as { kind?: string }).kind === "fork" ? [4, 3] : null
          }
          linkWidth={1.5}
          linkDirectionalParticles={0}
          nodeRelSize={NODE_R}
          nodeLabel={() => ""}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as SimNode;
            if (n.x == null || n.y == null) return;
            const v = n.version;
            const selected = v.id === selectedId;
            const processing =
              v.render_status === "pending" || v.render_status === "rendering";
            const failed = v.render_status === "failed";

            // Main indicator: lavender halo ring.
            if (n.isMain) {
              ctx.beginPath();
              ctx.arc(n.x, n.y, NODE_R + 3.5, 0, 2 * Math.PI);
              ctx.strokeStyle = tokens.primary;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(n.x, n.y, NODE_R, 0, 2 * Math.PI);
            ctx.globalAlpha = processing ? 0.55 : 1;
            ctx.fillStyle = selected
              ? tokens.primary
              : processing
                ? tokens.surface3
                : tokens.surface4;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.setLineDash(failed ? [2.5, 2] : []);
            ctx.strokeStyle = selected
              ? tokens.primaryHover
              : failed
                ? tokens.inkTertiary
                : tokens.hairlineTertiary;
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.setLineDash([]);

            // Name under the node once zoomed in enough to read it.
            if (globalScale > 1.2) {
              const label = (v.display_name || v.file_name).slice(0, 18);
              ctx.font = `${10 / globalScale}px "JetBrains Mono", monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = selected ? tokens.ink : tokens.inkSubtle;
              ctx.fillText(label, n.x, n.y + NODE_R + 3);
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as SimNode;
            if (n.x == null || n.y == null) return;
            ctx.beginPath();
            ctx.arc(n.x, n.y, NODE_R + 4, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      )}

      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-hairline bg-surface-3 px-3 py-2">
          <p className="text-body-sm text-ink">
            {hover.node.version.display_name || hover.node.version.file_name}
          </p>
          <p className="mt-0.5 font-mono text-mono text-ink-tertiary">
            {hover.node.branchName} · {formatDate(hover.node.version.uploaded_at)}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            {hover.node.isMain && <StatusBadge tone="accent">Main</StatusBadge>}
            {hover.node.version.render_status === "ready" ? (
              <StatusBadge tone="success">ready</StatusBadge>
            ) : hover.node.version.render_status === "failed" ? (
              <StatusBadge>render failed</StatusBadge>
            ) : (
              <StatusBadge tone="processing">processing</StatusBadge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
