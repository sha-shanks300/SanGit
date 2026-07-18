import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** satori (next/og) can't decode WebP — cropped avatars/banners/artwork are
 *  stored as .webp, so OG cards must fall back to the drawn placeholder for
 *  those instead of silently rendering an empty box. */
export function ogSafeImage(url: string | null): string | null {
  if (!url) return null;
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".webp") ? null : url;
}

/** Public project + producer for /p/[slug] — shared by the page,
 *  generateMetadata, and the OG image (React cache: one query per request).
 *  RLS: only public projects (or the owner's own) resolve. */
export const getPublicProject = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, user_id, title, slug, is_public, show_history, main_version_id, artwork_url"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", project.user_id)
    .maybeSingle();
  return { project, profile };
});

/** Public profile + shown-project count for /u/[username] metadata/OG. */
export const getPublicProfile = cache(async (username: string) => {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_public", true);
  return { profile, publicProjects: count ?? 0 };
});
