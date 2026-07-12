"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/database.types";
import { uploadPublicImage } from "@/lib/image-upload";
import { Button, Eyebrow, Input, Panel } from "@/components/ui";

/**
 * Profile editing: banner + avatar uploads (direct to the public-images
 * bucket; the URL is saved to the profile immediately), display name and bio.
 */
/** Mirrors the DB check on profiles.username: ^[a-z0-9_-]{3,30}$ */
function sanitizeUsername(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data ?? null);
      setDisplayName(data?.display_name ?? "");
      setUsername(data?.username ?? "");
      setBio(data?.bio ?? "");
      setLoading(false);
    })();
  }, []);

  async function pickImage(kind: "avatar" | "banner", file: File | undefined) {
    if (!file || !profile) return;
    setUploading(kind);
    setError(null);
    try {
      const url = await uploadPublicImage(kind, file, {
        previousUrl: kind === "avatar" ? profile.avatar_url : profile.banner_url,
      });
      const patch =
        kind === "avatar" ? { avatar_url: url } : { banner_url: url };
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", profile.id);
      if (dbError) throw new Error(dbError.message);
      setProfile({ ...profile, ...patch });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setUploading(null);
  }

  async function save() {
    if (!profile) return;
    const uname = sanitizeUsername(username);
    if (uname.length < 3) {
      setError("Username needs at least 3 characters (a-z, 0-9, - or _).");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        username: uname,
      })
      .eq("id", profile.id);
    if (dbError) {
      setError(
        dbError.code === "23505"
          ? "That username is already taken."
          : dbError.message
      );
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    router.push("/dashboard");
    router.refresh(); // masthead is server-rendered — pick up the new profile
  }

  if (loading) {
    return <p className="py-16 text-center text-body-sm text-ink-subtle">Loading…</p>;
  }
  if (!profile) {
    return (
      <p className="py-16 text-center text-body-sm text-ink-subtle">
        <Link href="/login" className="text-ink underline underline-offset-2">
          Sign in
        </Link>{" "}
        to edit your profile.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Eyebrow>Settings</Eyebrow>
      <h1 className="mt-1 text-headline text-ink">Profile</h1>

      <Panel className="mt-8">
        <label className="text-caption text-ink-subtle">Banner</label>
        <div
          className="mt-2 h-36 w-full border border-hairline"
          style={
            profile.banner_url
              ? {
                  backgroundImage: `url(${profile.banner_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: "linear-gradient(180deg, #3c3c3c, #030303 64%)" }
          }
        />
        <label className="mt-3 inline-block">
          <span className="cursor-pointer text-body-sm text-ink underline underline-offset-2">
            {uploading === "banner" ? "Uploading…" : "Upload banner"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading !== null}
            onChange={(e) => pickImage("banner", e.target.files?.[0])}
          />
        </label>

        <div className="mt-8 flex items-center gap-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-hairline bg-surface-3">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
              <img
                src={profile.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-card-title text-ink-muted">
                {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <label>
            <span className="cursor-pointer text-body-sm text-ink underline underline-offset-2">
              {uploading === "avatar" ? "Uploading…" : "Upload avatar"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploading !== null}
              onChange={(e) => pickImage("avatar", e.target.files?.[0])}
            />
          </label>
        </div>

        <div className="mt-8">
          <label className="text-caption text-ink-subtle" htmlFor="username">
            Username
          </label>
          <Input
            id="username"
            className="mt-1 font-mono"
            value={username}
            onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
            placeholder="your-name"
            maxLength={30}
          />
          <p className="mt-1.5 font-mono text-caption text-ink-tertiary">
            Public URL: /u/{username || "…"} — changing it breaks previously
            shared links.
          </p>
        </div>

        <div className="mt-5">
          <label className="text-caption text-ink-subtle" htmlFor="display-name">
            Display name
          </label>
          <Input
            id="display-name"
            className="mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={profile.username}
            maxLength={60}
          />
        </div>

        <div className="mt-5">
          <label className="text-caption text-ink-subtle" htmlFor="bio">
            Bio
          </label>
          <textarea
            id="bio"
            className="mt-1 w-full rounded-sm border border-hairline bg-canvas px-4 py-2.5 text-body text-ink placeholder:text-ink-tertiary"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people what you make."
            maxLength={500}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-mono text-caption text-ink-tertiary">
            @{profile.username} ·{" "}
            <Link
              href={`/u/${profile.username}`}
              className="text-ink-subtle underline underline-offset-2 hover:text-ink"
            >
              view public profile
            </Link>
          </p>
          <div className="flex items-center gap-3">
            {saved && <span className="text-caption text-success">Saved</span>}
            {error && <span className="text-caption text-primary">{error}</span>}
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
