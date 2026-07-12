"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadPublicImage } from "@/lib/image-upload";
import { artworkFallback, cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

/** Owner header controls: rename, toggle public visibility, artwork. */
export function ProjectSettings({
  project,
}: {
  project: {
    id: string;
    title: string;
    slug: string;
    is_public: boolean;
    artwork_url: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / Escape (popover convention). The listener
  // only exists while open, and clicks inside the wrapper (button included)
  // are ignored so toggling and form interaction keep working.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const [title, setTitle] = useState(project.title);
  const [isPublic, setIsPublic] = useState(project.is_public);
  const [artworkUrl, setArtworkUrl] = useState(project.artwork_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ title: title.trim() || project.title, is_public: isPublic })
      .eq("id", project.id);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function pickArtwork(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPublicImage("artwork", file, {
        projectId: project.id,
        previousUrl: artworkUrl,
      });
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("projects")
        .update({ artwork_url: url })
        .eq("id", project.id);
      if (dbError) throw new Error(dbError.message);
      setArtworkUrl(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setUploading(false);
  }

  return (
    <div className="relative" ref={popoverRef}>
      <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
        Settings
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-lg border border-hairline bg-surface-3 p-4">
          <label className="text-caption text-ink-subtle">Project title</label>
          <Input
            className="mt-1 bg-surface-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="mt-4 block text-caption text-ink-subtle">
            Artwork
          </label>
          <div className="mt-1 flex items-center gap-3">
            <div
              className="h-14 w-14 shrink-0 overflow-hidden border border-hairline"
              style={
                artworkUrl ? undefined : { background: artworkFallback(project.id) }
              }
            >
              {artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
                <img src={artworkUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <label>
              <span className="cursor-pointer text-body-sm text-ink underline underline-offset-2">
                {uploading ? "Uploading…" : "Upload"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => pickArtwork(e.target.files?.[0])}
              />
            </label>
          </div>
          {error && <p className="mt-2 text-caption text-primary">{error}</p>}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-body-sm text-ink">Public project page</span>
            {/* Toggle button: stays pressed (surface lift + green) while
                public; pressing again releases it back to private. */}
            <button
              type="button"
              aria-pressed={isPublic}
              onClick={() => setIsPublic((p) => !p)}
              className={cn(
                "cursor-pointer border px-3.5 py-1.5 text-button transition-colors",
                isPublic
                  ? "border-hairline-strong bg-surface-2 text-success"
                  : "border-hairline text-ink-subtle hover:text-ink"
              )}
            >
              {isPublic ? "Public" : "Private"}
            </button>
          </div>
          {isPublic && (
            <p className="mt-2 text-caption text-ink-tertiary">
              Visible at /p/{project.slug}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="tertiary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
