"use client";

import dynamic from "next/dynamic";
import type { VersionGraphProps } from "@/components/version-graph-canvas";

// Canvas + window access — client-only bundle, loaded when the tab opens.
// The heavy lifting (ForceGraph2D, custom forces via the imperative ref)
// lives in version-graph-canvas.tsx; this wrapper only exists because
// next/dynamic can't be combined with the ref-holding module directly.
const VersionGraphCanvas = dynamic(
  () => import("@/components/version-graph-canvas"),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-body-sm text-ink-subtle">
        Loading graph…
      </p>
    ),
  }
);

export function VersionGraph(props: VersionGraphProps) {
  return <VersionGraphCanvas {...props} />;
}
