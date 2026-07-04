"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

/** Owner header controls: rename, toggle public visibility. */
export function ProjectSettings({
  project,
}: {
  project: { id: string; title: string; slug: string; is_public: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [isPublic, setIsPublic] = useState(project.is_public);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="relative">
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
          <label className="mt-4 flex cursor-pointer items-center justify-between">
            <span className="text-body-sm text-ink">Public project page</span>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 accent-(--primary)"
            />
          </label>
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
