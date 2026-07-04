"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShareLink } from "@/lib/database.types";
import { Button, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

/**
 * Owner tool: create/copy/revoke private share links for a version. The raw
 * URL is shown once at creation (only its hash is stored).
 */
export function ShareManager({ versionId }: { versionId: string }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [expiresHours, setExpiresHours] = useState("168");
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("share_links")
      .select("*")
      .eq("version_id", versionId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setLinks(data ?? []);
  }, [versionId]);

  useEffect(() => {
    setFreshUrl(null);
    refetch();
  }, [refetch]);

  async function create() {
    setCreating(true);
    const hours = parseInt(expiresHours, 10);
    const res = await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version_id: versionId,
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

  return (
    <div className="mt-5 border-t border-hairline pt-5">
      <p className="text-caption text-ink-subtle">Private share links</p>

      <div className="mt-2 flex items-center gap-2">
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

      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded-md border border-hairline bg-surface-1 px-3 py-2"
            >
              <div className="text-caption text-ink-subtle">
                Created {formatDate(l.created_at)} · {l.view_count} view
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
