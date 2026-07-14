"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Eyebrow, Input } from "@/components/ui";

const CONFIRM_PHRASE = "delete my account";

/**
 * Phrase-gated confirmation for account deletion — the most destructive
 * action in the app, so it summarizes everything that dies before the gate.
 * Deletion goes through DELETE /api/account (storage cleanup + auth admin
 * deleteUser need the service role server-side).
 */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const [counts, setCounts] = useState<{
    projects: number;
    versions: number;
    devices: number;
    links: number;
  } | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const mine = { count: "exact" as const, head: true };
    const [projects, versions, devices, links] = await Promise.all([
      supabase.from("projects").select("id", mine).eq("user_id", user.id),
      supabase.from("versions").select("id", mine).eq("user_id", user.id),
      supabase.from("devices").select("id", mine).eq("user_id", user.id),
      supabase
        .from("share_links")
        .select("id", mine)
        .eq("user_id", user.id)
        .is("revoked_at", null),
    ]);
    setCounts({
      projects: projects.count ?? 0,
      versions: versions.count ?? 0,
      devices: devices.count ?? 0,
      links: links.count ?? 0,
    });
  }, []);

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
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete the account. Try again.");
      setBusy(false);
      return;
    }
    // Full reload: every session-derived state in the app is now invalid.
    window.location.href = "/";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete account"
    >
      <div className="w-full max-w-md border border-hairline bg-surface-3 p-5">
        <Eyebrow>Delete account</Eyebrow>

        <p className="mt-4 text-body-sm text-ink">
          This permanently deletes your account and everything in it
          {counts
            ? ` — ${counts.projects} project${counts.projects === 1 ? "" : "s"}, ${counts.versions} version${counts.versions === 1 ? "" : "s"}, every comment and like, ${counts.devices} paired device${counts.devices === 1 ? "" : "s"}, and ${counts.links} active share link${counts.links === 1 ? "" : "s"}`
            : ""}
          . Your public profile and project pages stop working immediately.
        </p>
        <p className="mt-2 text-caption text-ink-tertiary">
          Your .flp files and FL Studio projects on this computer are untouched.
          The tray app will ask to pair again — you can just close it. There is
          no undo.
        </p>

        <label className="mt-5 block text-caption text-ink-subtle">
          Type <span className="font-mono text-ink">{CONFIRM_PHRASE}</span> to
          confirm
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
          <Button onClick={destroy} disabled={typed !== CONFIRM_PHRASE || busy}>
            {busy ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
