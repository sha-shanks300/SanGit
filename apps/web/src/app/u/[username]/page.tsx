import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@/lib/public-project";
import { TopNav } from "@/components/top-nav";
import { ProjectsSectionHeading } from "@/components/section-heading";
import { ProfileHeader } from "@/components/profile-header";
import { ProjectRow, type ProjectRowData } from "@/components/project-row";

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

  // NB: versions embed disambiguated — projects↔versions has a second FK via
  // main_version_id (PGRST201).
  // Most recent commit first (updated_at also moves on settings saves).
  const { data } = await supabase
    .from("projects")
    .select(
      "*, versions!versions_project_id_fkey(count), branches(count), latest:versions!versions_project_id_fkey(uploaded_at)"
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

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        <ProfileHeader
          profile={profile}
          isOwner={user?.id === profile.id}
          onPublicPage
        />

        <section className="mt-10 border-t border-hairline pt-8">
          <ProjectsSectionHeading
            title="Public projects"
            count={projects.length > 0 ? projects.length : undefined}
          />
          {projects.length === 0 ? (
            <p className="mt-6 text-body-sm text-ink-subtle">
              Nothing public yet.
            </p>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  href={`/p/${p.slug}`}
                  showVisibility={false}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
