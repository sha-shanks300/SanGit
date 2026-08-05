"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShareLink } from "@/lib/database.types";
import { Button } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type Scope = "project" | "version";

/** Expiry choices, shortest-lived first. `hours: null` = never expires.
 *  The ramp below leans on this order: the longer a link lives, the lighter
 *  its segment sits, so the risky end of the control reads as the bright end. */
const EXPIRY_OPTIONS = [
  { label: "1 day", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "Never", hours: null },
] as const;

/** Resting fill per segment — a deliberate step up the surface ladder. */
const SEGMENT_REST = [
  "bg-surface-1",
  "bg-surface-2",
  "bg-surface-3",
  "bg-surface-4",
] as const;

/**
 * Owner tool: create/copy/revoke private share links. Two scopes — the whole
 * project (default: recipient gets the read-only project view with every
 * version) or just the selected version (single-track preview). The raw URL
 * is shown once at creation (only its hash is stored).
 */
export function ShareManager({
  versionId,
  projectId,
  lockVersion = false,
  defaultExpiryHours = 168,
}: {
  /** Selected version for version-scoped ("Share version…") links. */
  versionId: string | null;
  projectId: string;
  /** Lock to version scope — used by "Share version…". */
  lockVersion?: boolean;
  defaultExpiryHours?: number;
}) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  // No scope toggle: node links are version-scoped, the header is project-scoped.
  const scope: Scope = lockVersion ? "version" : "project";
  const [expiryIndex, setExpiryIndex] = useState(() => {
    const i = EXPIRY_OPTIONS.findIndex((o) => o.hours === defaultExpiryHours);
    return i >= 0 ? i : 1; // 7 days — the value this tool has always defaulted to
  });
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function create() {
    setCreating(true);
    const res = await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        ...(scope === "project" ? { project_id: projectId } : { version_id: versionId }),
        expires_in_hours: EXPIRY_OPTIONS[expiryIndex].hours,
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

  // Locked mode shows only this version's links; the header shows project links.
  const visible = links.filter((l) =>
    lockVersion ? l.version_id === versionId : l.version_id === null
  );

  return (
    <div className="mt-4">
      <p className="text-caption text-ink-subtle">Private share links</p>

      {!lockVersion && (
        <p className="mt-1 text-caption text-ink-tertiary">
          Recipients see every version and the tree.
        </p>
      )}

      <div className="mt-4">
        <span
          id="expiry-label"
          className="font-mono text-caption uppercase tracking-[0.28px] text-ink-tertiary"
        >
          Expires
        </span>
        {/* Shortest-lived on the left, "Never" on the right, each segment a step
            up the surface ladder — so a longer-lived (more exposed) link is
            visibly the brighter choice. */}
        <div
          role="radiogroup"
          aria-labelledby="expiry-label"
          className="mt-2 flex divide-x divide-hairline border border-hairline"
        >
          {EXPIRY_OPTIONS.map((opt, i) => {
            const active = i === expiryIndex;
            return (
              <button
                key={opt.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setExpiryIndex(i)}
                className={cn(
                  "flex-1 px-3 py-2 text-button transition-colors",
                  active
                    ? "bg-ink text-canvas"
                    : cn(
                        SEGMENT_REST[i],
                        "text-ink-subtle hover:bg-canvas hover:text-ink"
                      )
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-caption text-ink-tertiary">
            {EXPIRY_OPTIONS[expiryIndex].hours === null
              ? "Works until you revoke it."
              : `Stops working after ${EXPIRY_OPTIONS[expiryIndex].label}. Revoke any time.`}
          </p>
          <Button variant="secondary" onClick={create} disabled={creating}>
            {creating ? "Creating…" : "New link"}
          </Button>
        </div>
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
