"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Version } from "@/lib/database.types";
import { Button, Input, StatusBadge } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/utils";

/**
 * Detail side panel for the selected version. Owner view: rename, edit the
 * displayed upload date, download the .flp. Interactions (reactions,
 * comments) render below via `children`.
 */
export function VersionPanel({
  version,
  isOwner,
  mainVersionId,
  onChanged,
  children,
  shareToken,
  onRequestDelete,
}: {
  version: Version;
  isOwner: boolean;
  mainVersionId: string | null;
  onChanged: () => void;
  children?: React.ReactNode;
  /** Share-link token on /s/[token] pages — passkey downloads need it to prove reachability. */
  shareToken?: string;
  /** Owner-only: opens the delete-version confirmation (dialog lives in the parent). */
  onRequestDelete?: () => void;
}) {
  const [name, setName] = useState(version.display_name ?? "");
  const [date, setDate] = useState(version.uploaded_at.slice(0, 10));
  const [saving, setSaving] = useState(false);
  // Visitor passkey download flow.
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Reset the form when a different version is selected (adjust-during-render).
  const [prevVersionId, setPrevVersionId] = useState(version.id);
  if (prevVersionId !== version.id) {
    setPrevVersionId(version.id);
    setName(version.display_name ?? "");
    setDate(version.uploaded_at.slice(0, 10));
    setKeyError(null);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const uploadedAt = new Date(`${date}T00:00:00`);
    await supabase
      .from("versions")
      .update({
        display_name: name.trim() || null,
        ...(isNaN(uploadedAt.getTime())
          ? {}
          : { uploaded_at: uploadedAt.toISOString() }),
      })
      .eq("id", version.id);
    setSaving(false);
    onChanged();
  }

  async function downloadFlp() {
    const res = await fetch(`/api/flp/${version.id}`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.location.href = url;
  }

  /** Non-owner path: passkey in the body (never the URL), token when shared. */
  async function downloadWithKey(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setKeyBusy(true);
    setKeyError(null);
    const res = await fetch(`/api/flp/${version.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), token: shareToken }),
    });
    setKeyBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setKeyError(body?.error ?? "Download failed.");
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  }

  const dirty =
    name !== (version.display_name ?? "") ||
    date !== version.uploaded_at.slice(0, 10);

  return (
    <div className="rounded-lg border border-hairline-strong bg-surface-2 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-card-title font-medium text-ink">
            {version.display_name || version.file_name}
          </h3>
          <p className="mt-1 font-mono text-mono text-ink-tertiary">
            {version.file_name} · {version.flp_sha256.slice(0, 10)}
          </p>
        </div>
        {version.id === mainVersionId ? (
          <StatusBadge tone="accent">Main</StatusBadge>
        ) : version.render_status === "ready" ? (
          <StatusBadge tone="success">ready</StatusBadge>
        ) : version.render_status === "failed" ? (
          <StatusBadge>render failed</StatusBadge>
        ) : (
          <StatusBadge tone="processing">processing</StatusBadge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm">
        <dt className="text-ink-tertiary">Uploaded</dt>
        <dd className="text-ink-muted">{formatDate(version.uploaded_at)}</dd>
        <dt className="text-ink-tertiary">Duration</dt>
        <dd className="text-ink-muted">
          {version.render_status === "ready"
            ? formatDuration(version.duration_secs)
            : "—"}
        </dd>
        {version.render_status === "failed" && version.render_error && (
          <>
            <dt className="text-ink-tertiary">Render error</dt>
            <dd className="text-ink-muted">{version.render_error}</dd>
          </>
        )}
      </dl>

      {!isOwner && (
        <div className="mt-5 border-t border-hairline pt-5">
          {keyOpen ? (
            <form onSubmit={downloadWithKey}>
              <label className="text-caption text-ink-subtle" htmlFor="flp-key">
                .flp passkey
              </label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="flp-key"
                  className="font-mono"
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sgk_…"
                  autoComplete="off"
                />
                <Button type="submit" disabled={keyBusy || !key.trim()}>
                  {keyBusy ? "Checking…" : "Download"}
                </Button>
              </div>
              {keyError && (
                <p className="mt-2 text-caption text-primary">{keyError}</p>
              )}
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setKeyOpen(true)}>
              Download .flp
            </Button>
          )}
        </div>
      )}

      {isOwner && (
        <div className="mt-5 border-t border-hairline pt-5">
          <label className="text-caption text-ink-subtle">Version name</label>
          <Input
            className="mt-1"
            value={name}
            placeholder={version.file_name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="mt-3 block text-caption text-ink-subtle">
            Display date
          </label>
          <Input
            className="mt-1"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={downloadFlp}>
              Download .flp
            </Button>
            {onRequestDelete && (
              <button
                type="button"
                className="ml-auto cursor-pointer border border-hairline-strong px-4 py-2 text-button text-primary transition-colors hover:border-primary hover:bg-surface-1"
                onClick={onRequestDelete}
              >
                Delete…
              </button>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
