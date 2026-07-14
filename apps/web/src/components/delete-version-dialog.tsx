"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Version } from "@/lib/database.types";
import { Button, Eyebrow } from "@/components/ui";

/**
 * Simple are-you-sure confirmation for deleting one version (the type-title
 * gate is reserved for project deletion). States what dies with it and warns
 * when the version is Main or the last one on its branch. Deletion goes
 * through DELETE /api/versions/[id] (storage cleanup needs the admin client
 * server-side).
 */
export function DeleteVersionDialog({
  version,
  isMain,
  isLastOnBranch,
  branchName,
  onClose,
  onDeleted,
}: {
  version: Version;
  isMain: boolean;
  isLastOnBranch: boolean;
  branchName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [counts, setCounts] = useState<{
    comments: number;
    reactions: number;
    links: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    const supabase = createClient();
    const [comments, reactions, links] = await Promise.all([
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("version_id", version.id),
      supabase
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("version_id", version.id),
      supabase
        .from("share_links")
        .select("id", { count: "exact", head: true })
        .eq("version_id", version.id)
        .is("revoked_at", null),
    ]);
    setCounts({
      comments: comments.count ?? 0,
      reactions: reactions.count ?? 0,
      links: links.count ?? 0,
    });
  }, [version.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    fetchCounts();
  }, [fetchCounts]);

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
    const res = await fetch(`/api/versions/${version.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete the version. Try again.");
      setBusy(false);
      return;
    }
    onDeleted();
  }

  const impact = counts
    ? [
        counts.comments > 0 &&
          `${counts.comments} comment${counts.comments === 1 ? "" : "s"}`,
        counts.reactions > 0 &&
          `${counts.reactions} reaction${counts.reactions === 1 ? "" : "s"}`,
        counts.links > 0 &&
          `${counts.links} active share link${counts.links === 1 ? "" : "s"}`,
      ].filter((s): s is string => Boolean(s))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete version"
    >
      <div className="w-full max-w-md border border-hairline bg-surface-3 p-5">
        <Eyebrow>Delete version</Eyebrow>

        <p className="mt-4 text-body-sm text-ink">
          Delete{" "}
          <span className="font-medium">
            {version.display_name || version.file_name}
          </span>
          ? The .flp snapshot and its render are permanently removed
          {impact.length > 0 && <>, along with {impact.join(", ")}</>}.
        </p>

        {isMain && (
          <p className="mt-3 border border-hairline bg-surface-2 p-3 text-body-sm text-ink">
            This is your <span className="text-primary">Main</span> version — the
            project will have no Main until you pick another.
          </p>
        )}
        {isLastOnBranch && (
          <p className="mt-3 border border-hairline bg-surface-2 p-3 text-body-sm text-ink">
            This is the last version on{" "}
            <span className="font-mono">{branchName}</span> — the branch disappears
            too. Saving that file again re-creates it.
          </p>
        )}

        <p className="mt-3 text-caption text-ink-tertiary">
          Files on your computer are untouched. There is no undo.
        </p>

        {error && <p className="mt-3 text-caption text-primary">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="tertiary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={destroy} disabled={busy}>
            {busy ? "Deleting…" : "Delete version"}
          </Button>
        </div>
      </div>
    </div>
  );
}
