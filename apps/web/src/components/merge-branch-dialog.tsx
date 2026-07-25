"use client";

import { useEffect, useState } from "react";
import { Button, Eyebrow } from "@/components/ui";

/**
 * Confirmation for merging a branch into its parent. The versions (and audio)
 * are kept — only re-parented and re-dated to append after the parent's tip —
 * then the branch line is removed. Goes through POST /api/branches/[id]/merge.
 */
export function MergeBranchDialog({
  branch,
  parentLabel,
  versionCount,
  onClose,
  onMerged,
}: {
  branch: { id: string; name: string };
  parentLabel: string;
  versionCount: number;
  onClose: () => void;
  onMerged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function merge() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/branches/${branch.id}/merge`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error
          ? `Couldn't merge: ${body.error}`
          : "Couldn't merge the branch. Try again."
      );
      setBusy(false);
      return;
    }
    onMerged();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Merge branch"
    >
      <div className="w-full max-w-md border border-hairline bg-surface-3 p-5">
        <Eyebrow>Merge branch</Eyebrow>

        <p className="mt-4 text-body-sm text-ink">
          Move {versionCount} version{versionCount === 1 ? "" : "s"} from{" "}
          <span className="font-mono">{branch.name}</span> to the end of{" "}
          <span className="font-mono">{parentLabel}</span>, then remove the{" "}
          <span className="font-mono">{branch.name}</span> branch. The versions
          and their audio are kept — only the branch line goes away.
        </p>

        <p className="mt-2 text-caption text-ink-tertiary">
          The merged versions are re-dated to sit after {parentLabel}&apos;s
          latest. There is no undo.
        </p>

        {error && <p className="mt-3 text-caption text-primary">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="tertiary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={merge} disabled={busy}>
            {busy ? "Merging…" : "Merge branch"}
          </Button>
        </div>
      </div>
    </div>
  );
}
