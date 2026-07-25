"use client";

import { useEffect, useState } from "react";
import { Button, Eyebrow, Input } from "@/components/ui";

/**
 * Type-the-name confirmation for deleting a whole branch (and every version on
 * it). Warns when the branch holds the project's Main version. Deletion goes
 * through DELETE /api/branches/[id] (storage cleanup needs the admin client).
 */
export function DeleteBranchDialog({
  branch,
  versionCount,
  hasMainVersion,
  onClose,
  onDeleted,
}: {
  branch: { id: string; name: string };
  versionCount: number;
  hasMainVersion: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function destroy() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/branches/${branch.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error
          ? `Couldn't delete: ${body.error}`
          : "Couldn't delete the branch. Try again."
      );
      setBusy(false);
      return;
    }
    onDeleted();
  }

  const matches = typed === branch.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete branch"
    >
      <div className="w-full max-w-md border border-hairline bg-surface-3 p-5">
        <Eyebrow>Delete branch</Eyebrow>

        <p className="mt-4 text-body-sm text-ink">
          This permanently deletes branch{" "}
          <span className="font-mono">{branch.name}</span> and its {versionCount}{" "}
          version{versionCount === 1 ? "" : "s"} — every .flp snapshot and render
          on it.
        </p>

        {hasMainVersion && (
          <p className="mt-3 border border-hairline bg-surface-2 p-3 text-body-sm text-ink">
            Your <span className="text-primary">Main</span> version is on this
            branch — the project will have no Main until you pick another.
          </p>
        )}

        <p className="mt-2 text-caption text-ink-tertiary">
          Files on your computer are untouched. There is no undo.
        </p>

        <label className="mt-5 block text-caption text-ink-subtle">
          Type <span className="font-mono text-ink">{branch.name}</span> to confirm
        </label>
        <Input
          className="mt-1 bg-surface-2"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />

        {error && <p className="mt-3 text-caption text-primary">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="tertiary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={destroy} disabled={!matches || busy}>
            {busy ? "Deleting…" : "Delete branch"}
          </Button>
        </div>
      </div>
    </div>
  );
}
