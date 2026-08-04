import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@/lib/public-project";
import { TopNav } from "@/components/top-nav";
import { ProjectsSectionHeading } from "@/components/section-heading";
import { ProfileHeader } from "@/components/profile-header";
import { ProjectRow, type ProjectRowData } from "@/components/project-row";
import type { PlayerTrack } from "@/components/player-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicProfile(username);
  // Unlisted model: reachable by link, never by search engine.
  if (!data) return { robots: { index: false, follow: false } };
  const { profile, publicProjects } = data;
  const name = profile.display_name || profile.username;
  const title = `${name} (@${profile.username})`;
  const description =
    profile.bio ||
    `${name} shares music in progress on SanGit${
      publicProjects > 0
        ? ` — ${publicProjects} project${publicProjects === 1 ? "" : "s"}`
        : ""
    }.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "SanGit",
      url: `/u/${profile.username}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  // NB: versions embed disambiguated — projects↔versions has a second FK via
  // main_version_id (PGRST201).
  // Most recent commit first (updated_at also moves on settings saves).
  const { data } = await supabase
    .from("projects")
    .select(
      // `main:` embeds the Main version via the projects_main_version_fk FK
      // (named to dodge PGRST201) so shared listeners can hover-play it.
      "*, versions!versions_project_id_fkey(count), branches(count), latest:versions!versions_project_id_fkey(uploaded_at), main:versions!projects_main_version_fk(*)"
    )
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("uploaded_at", { referencedTable: "latest", ascending: false })
    .limit(1, { referencedTable: "latest" })
    .returns<ProjectRowData[]>();
  const projects = (data ?? []).sort(
    (a, b) =>
      +new Date(b.latest?.[0]?.uploaded_at ?? b.created_at) -
      +new Date(a.latest?.[0]?.uploaded_at ?? a.created_at)
  );

  // Listener playlist: the Main track of each public project (ready ones only),
  // in the same order. audioUrlFor defaults to /api/audio/:id, which mints a
  // signed URL for anyone on a public project. isOwner:false → the bar shows
  // the listener (social) actions, never management.
  const queue: PlayerTrack[] = [];
  const indexByProject = new Map<string, number>();
  for (const p of projects) {
    if (p.main && p.main.render_status === "ready") {
      indexByProject.set(p.id, queue.length);
      queue.push({
        version: p.main,
        meta: {
          projectId: p.id,
          projectTitle: p.title,
          artistName: profile.display_name || profile.username,
          artistUsername: profile.username,
          artworkUrl: p.artwork_url,
          isOwner: false,
          mainVersionId: p.main_version_id,
          favoriteProjectId: p.id,
          slug: p.slug, // these are public projects — /p/[slug] is shareable
        },
      });
    }
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10 pb-28">
        <ProfileHeader profile={profile} isOwner={isOwnProfile} />

        <section className="mt-8 sm:mt-12">
          <ProjectsSectionHeading
            title="Public projects"
            count={projects.length > 0 ? projects.length : undefined}
          />
          {projects.length === 0 ? (
            <p className="mt-6 text-body-sm text-ink-subtle">
              Nothing public yet.
            </p>
          ) : (
            // The (app) group provider powers this listener player: hover-play a
            // project's Main from the row, then next/prev across the profile —
            // and playback carries in from wherever the visitor arrived.
            <div className="mt-6 flex flex-col gap-3">
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  // Rows are the listener's row either way, but the destination
                  // follows the viewer, not the project: /p/[slug] is the
                  // visitor surface (it hardcodes isOwner=false, so an owner
                  // landing there gets a read-only copy of their own project
                  // with no management). Own profile => manage on the dashboard.
                  href={
                    isOwnProfile
                      ? `/dashboard/projects/${p.id}`
                      : `/p/${p.slug}`
                  }
                  // A visitor clicking a Main-only project gets the now-playing
                  // surface expanded in place — /p/[slug] renders exactly that
                  // surface, so navigating there would just reload what's
                  // already on screen. All-versions rows still navigate, since
                  // that page has a whole tree the overlay can't show.
                  openInPlace={!isOwnProfile && !p.show_history}
                  showVisibility={false}
                  variant="listener"
                  playQueue={queue}
                  playIndex={indexByProject.get(p.id) ?? -1}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
