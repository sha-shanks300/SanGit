"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Eyebrow, Input } from "@/components/ui";

/**
 * Type-the-title confirmation for permanent project deletion. Public projects
 * get "Make private instead" as the highlighted alternative before the
 * destructive path. Deletion goes through DELETE /api/projects/[id] (storage
 * cleanup needs the admin client server-side).
 */
export function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: { id: string; title: string; is_public: boolean };
  onClose: () => void;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<{ versions: number; links: number } | null>(
    null
  );
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"delete" | "private" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    const supabase = createClient();
    const [versions, links] = await Promise.all([
      supabase
        .from("versions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id),
      supabase
        .from("share_links")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .is("revoked_at", null),
    ]);
    setCounts({ versions: versions.count ?? 0, links: links.count ?? 0 });
  }, [project.id]);

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

  async function makePrivate() {
    setBusy("private");
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("projects")
      .update({ is_public: false })
      .eq("id", project.id);
    if (dbError) {
      setError("Couldn't make the project private.");
      setBusy(null);
      return;
    }
    onClose();
    router.refresh();
  }

  async function destroy() {
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete the project. Try again.");
      setBusy(null);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const titleMatches = typed === project.title;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete project"
    >
      <div className="w-full max-w-md border border-hairline bg-surface-3 p-5">
        <Eyebrow>Delete project</Eyebrow>

        <p className="mt-4 text-body-sm text-ink">
          This permanently deletes <span className="text-ink font-medium">{project.title}</span>
          {counts
            ? ` — ${counts.versions} version${counts.versions === 1 ? "" : "s"}, every .flp snapshot and render`
            : " and every .flp snapshot and render"}
          .
          {counts !== null && counts.links > 0 && (
            <>
              {" "}
              {counts.links} active share link{counts.links === 1 ? "" : "s"} will stop
              working.
            </>
          )}
        </p>
        <p className="mt-2 text-caption text-ink-tertiary">
          Files on your computer are untouched. There is no undo.
        </p>

        {project.is_public && (
          <div className="mt-4 border border-hairline bg-surface-2 p-3">
            <p className="text-body-sm text-ink">
              This project is public. You can make it private instead — nothing is
              deleted, it just disappears from your public page.
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={makePrivate}
              disabled={busy !== null}
            >
              {busy === "private" ? "Making private…" : "Make private instead"}
            </Button>
          </div>
        )}

        <label className="mt-5 block text-caption text-ink-subtle">
          Type <span className="font-mono text-ink">{project.title}</span> to confirm
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
          <Button variant="tertiary" onClick={onClose} disabled={busy !== null}>
            Cancel
          </Button>
          <Button onClick={destroy} disabled={!titleMatches || busy !== null}>
            {busy === "delete" ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
