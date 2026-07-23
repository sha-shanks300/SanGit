"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShareLink } from "@/lib/database.types";
import { Button, Input } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type Scope = "project" | "version";

/**
 * Owner tool: create/copy/revoke private share links. Two scopes — the whole
 * project (default: recipient gets the read-only project view with every
 * version) or just the selected version (single-track preview). The raw URL
 * is shown once at creation (only its hash is stored).
 */
export function ShareManager({
  versionId,
  projectId,
}: {
  /** Selected version for "this version only" links; null disables that scope. */
  versionId: string | null;
  projectId: string;
}) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [scope, setScope] = useState<Scope>("project");
  const [expiresHours, setExpiresHours] = useState("168");
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("share_links")
      .select("*")
      .eq("project_id", projectId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setLinks(data ?? []);
  }, [projectId]);

  // Clear the one-time URL display when switching versions (adjust-during-render).
  const [prevVersionId, setPrevVersionId] = useState(versionId);
  if (prevVersionId !== versionId) {
    setPrevVersionId(versionId);
    setFreshUrl(null);
  }

  // Version scope needs a selected version; fall back to project when there
  // isn't one (adjust-during-render, converges in one extra pass).
  if (versionId === null && scope === "version") setScope("project");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function create() {
    setCreating(true);
    const hours = parseInt(expiresHours, 10);
    const res = await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        ...(scope === "project" ? { project_id: projectId } : { version_id: versionId }),
        expires_in_hours: isNaN(hours) || hours <= 0 ? null : hours,
      }),
    });
    setCreating(false);
    if (res.ok) {
      const { url } = await res.json();
      setFreshUrl(url);
      setCopied(false);
      refetch();
    }
  }

  async function copy() {
    if (!freshUrl) return;
    await navigator.clipboard.writeText(freshUrl);
    setCopied(true);
  }

  async function revoke(id: string) {
    await fetch(`/api/share-links/${id}`, { method: "DELETE" });
    if (freshUrl) setFreshUrl(null);
    refetch();
  }

  // Project-wide links + links for the currently selected version.
  const visible = links.filter(
    (l) => l.version_id === null || l.version_id === versionId
  );

  return (
    <div className="mt-4">
      <p className="text-caption text-ink-subtle">Private share links</p>

      <div className="mt-2 flex gap-1" role="tablist" aria-label="Share scope">
        {(
          [
            ["project", "All versions"],
            ["version", "This version only"],
          ] as const
        ).map(([value, label]) => {
          const disabled = value === "version" && versionId === null;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={scope === value}
              disabled={disabled}
              title={disabled ? "Select a version first" : undefined}
              onClick={() => setScope(value)}
              className={cn(
                "border px-3 py-1 text-caption transition-colors",
                scope === value
                  ? "border-hairline-strong bg-surface-2 text-ink"
                  : "border-transparent text-ink-subtle hover:text-ink",
                disabled && "cursor-not-allowed opacity-40 hover:text-ink-subtle"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          className="w-28"
          type="number"
          min={0}
          value={expiresHours}
          onChange={(e) => setExpiresHours(e.target.value)}
          aria-label="Expiry in hours"
        />
        <span className="text-caption text-ink-tertiary">
          hours until expiry (0 = never)
        </span>
        <Button className="ml-auto" variant="secondary" onClick={create} disabled={creating}>
          {creating ? "Creating…" : "New link"}
        </Button>
      </div>

      {freshUrl && (
        <div className="mt-3 rounded-md border border-hairline bg-surface-3 p-3">
          <p className="break-all font-mono text-mono text-ink-muted">{freshUrl}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <p className="text-caption text-ink-tertiary">
              Shown once — copy it now.
            </p>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {visible.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded-md border border-hairline bg-surface-1 px-3 py-2"
            >
              <div className="text-caption text-ink-subtle">
                <span className="font-mono uppercase text-ink-muted">
                  {l.version_id === null ? "project" : "version"}
                </span>
                {" · "}Created {formatDate(l.created_at)} · {l.view_count} view
                {l.view_count === 1 ? "" : "s"}
                {l.expires_at
                  ? ` · expires ${formatDate(l.expires_at)}`
                  : " · no expiry"}
              </div>
              <Button variant="tertiary" onClick={() => revoke(l.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
