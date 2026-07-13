"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Eyebrow } from "@/components/ui";
import { formatDate } from "@/lib/utils";

/**
 * Owner tool: the per-project .flp download passkey. API-key semantics — the
 * plaintext is shown exactly once at creation (only its hash is stored);
 * Regenerate invalidates the old key instantly, Revoke disables downloads.
 * Destructive actions take a second confirming click.
 */
export function FlpAccess({ projectId }: { projectId: string }) {
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<"regenerate" | "revoke" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("project_flp_keys")
      .select("created_at")
      .eq("project_id", projectId)
      .maybeSingle();
    setCreatedAt(data?.created_at ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function generate() {
    setBusy(true);
    setError(null);
    setConfirming(null);
    const res = await fetch("/api/flp-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't generate a key.");
      return;
    }
    const { key } = await res.json();
    setFreshKey(key);
    setCopied(false);
    refetch();
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    setConfirming(null);
    const res = await fetch("/api/flp-key", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't revoke the key.");
      return;
    }
    setFreshKey(null);
    refetch();
  }

  async function copy() {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey);
    setCopied(true);
  }

  return (
    <div className="mt-5 border-t border-hairline pt-5">
      <Eyebrow>.flp access</Eyebrow>
      {loading ? (
        <p className="mt-2 text-body-sm text-ink-tertiary">Loading…</p>
      ) : (
        <>
          <p className="mt-2 text-body-sm text-ink-subtle">
            {createdAt
              ? `Passkey active since ${formatDate(createdAt)} — anyone with it can download this project's .flp files from your public or shared pages.`
              : "No passkey — only you can download the .flp files of this project."}
          </p>

          {freshKey && (
            <div className="mt-3 border border-hairline-strong bg-surface-1 p-3">
              <p className="break-all font-mono text-mono text-ink">{freshKey}</p>
              <div className="mt-2 flex items-center gap-3">
                <Button variant="secondary" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <p className="text-caption text-ink-tertiary">
                  Save it now — you won&apos;t see this key again.
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {!createdAt ? (
              <Button onClick={generate} disabled={busy}>
                {busy ? "Generating…" : "Generate passkey"}
              </Button>
            ) : confirming ? (
              <>
                <Button
                  onClick={confirming === "revoke" ? revoke : generate}
                  disabled={busy}
                >
                  {confirming === "revoke"
                    ? "Yes, disable downloads"
                    : "Yes, replace the key"}
                </Button>
                <Button variant="tertiary" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setConfirming("regenerate")}
                  disabled={busy}
                >
                  Regenerate
                </Button>
                <Button
                  variant="tertiary"
                  onClick={() => setConfirming("revoke")}
                  disabled={busy}
                >
                  Revoke
                </Button>
              </>
            )}
          </div>
          {confirming && (
            <p className="mt-2 text-caption text-ink-tertiary">
              The current key stops working immediately.
            </p>
          )}
          {error && <p className="mt-2 text-caption text-primary">{error}</p>}
        </>
      )}
    </div>
  );
}
