"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";

/** d3-force custom force shape (the package doesn't export its ForceFn). */
type ForceFn<N> = {
  (alpha: number): void;
  initialize?: (nodes: N[]) => void;
};
import type { Branch, Version } from "@/lib/database.types";
import { buildGraph, type GraphLink, type GraphNode } from "@/lib/graph-data";
import { StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

/** Simulation node: library adds/mutates position fields at runtime. */
type SimNode = GraphNode & {
  x?: number;
  y?: number;
  vy?: number;
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
  | "primary",
  string
>;

/** Canvas can't use Tailwind classes — read the theme vars once at mount. */
function readTokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    surface3: v("--surface-3", "#3c3c3c"),
    surface4: v("--surface-4", "#484848"),
    hairline: v("--hairline", "#303030"),
    hairlineStrong: v("--hairline-strong", "#3c3c3c"),
    hairlineTertiary: v("--hairline-tertiary", "#4a4a4a"),
    ink: v("--ink", "#ffffff"),
    inkSubtle: v("--ink-subtle", "#8f8f8f"),
    inkTertiary: v("--ink-tertiary", "#666666"),
    primary: v("--primary", "#da291c"),
  };
}

const NODE_R = 5;

export type VersionGraphProps = {
  branches: Branch[];
  versions: Version[];
  mainVersionId: string | null;
  selectedId: string | null;
  onSelect: (version: Version) => void;
};

/**
 * Obsidian-style physics view of the version DAG. dagMode="lr" lays nodes
 * out left-to-right by ancestry depth; a weak custom y-force staggers each
 * chain into a zig-zag instead of a flat lane. Dragging is elastic play, not
 * placement: the simulation is kept hot while a node is grabbed so its
 * neighbours tug along, and on release fx/fy are cleared so the dag + zig-zag
 * forces spring the graph back to its resting order. Nothing persists — a
 * refresh (or just letting go) restores the original layout.
 */
export default function VersionGraphCanvas({
  branches,
  versions,
  mainVersionId,
  selectedId,
  onSelect,
}: VersionGraphProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<
    ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>> | undefined
  >(undefined);
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

  const ready = width > 0 && tokens !== null;

  // Zig-zag layout: a weak y-force pulls every unpinned node toward its
  // staggered lane target (GraphNode.zigY). User-pinned nodes (fy set) are
  // left alone.
  useEffect(() => {
    if (!ready) return;
    const fg = fgRef.current;
    if (!fg) return;
    let nodes: SimNode[] = [];
    const force: ForceFn<NodeObject<GraphNode>> = (alpha: number) => {
      for (const n of nodes) {
        if (n.fy != null || n.y == null) continue;
        n.vy = (n.vy ?? 0) + (n.zigY - n.y) * 0.18 * alpha;
      }
    };
    force.initialize = (ns: NodeObject<GraphNode>[]) => {
      nodes = ns as SimNode[];
    };
    fg.d3Force("zigzag", force);
    fg.d3ReheatSimulation();
  }, [graphData, ready]);

  return (
    <div ref={wrapRef} className="relative">
      {ready && tokens && (
        <ForceGraph2D<GraphNode, GraphLink>
          ref={fgRef}
          graphData={graphData}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          dagMode="lr"
          dagLevelDistance={64}
          cooldownTime={5000}
          enableNodeDrag
          onNodeDrag={() => {
            // Keep the simulation hot while grabbing so neighbours tug along.
            fgRef.current?.d3ReheatSimulation();
          }}
          onNodeDragEnd={(node) => {
            // Release instead of pinning: the dag + zig-zag forces are the
            // restoring spring, so the graph wobbles back to its rest order.
            const n = node as SimNode;
            n.fx = undefined;
            n.fy = undefined;
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

            // Main indicator: Rosso Corsa halo ring.
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
              ? tokens.ink
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
            // Generous grab target — a 5px dot is too small to catch mid-play.
            ctx.beginPath();
            ctx.arc(n.x, n.y, NODE_R + 9, 0, 2 * Math.PI);
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
