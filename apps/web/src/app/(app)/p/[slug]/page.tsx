import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Version } from "@/lib/database.types";
import { getPublicProject } from "@/lib/public-project";
import { TopNav } from "@/components/top-nav";
import { ProjectView } from "@/components/project-view";
import { PublicTrackView } from "@/components/public-track-view";
import { ProjectSigninGate } from "@/components/project-signin-gate";
import { CopyLinkButton } from "@/components/copy-link-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicProject(slug);
  // Unlisted model: reachable by link, never by search engine.
  if (!data || !data.project.is_public) {
    return { robots: { index: false, follow: false } };
  }
  const { project, profile } = data;
  const producer = profile?.display_name || profile?.username || "a producer";
  const title = `${project.title} — ${producer}`;
  const description = `Listen to ${project.title} by ${producer} on SanGit.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "music.song",
      siteName: "SanGit",
      url: `/p/${project.slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicProject(slug);
  if (!data) notFound();
  const { project, profile } = data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = project.user_id === user?.id;
  if (!project.is_public && !isOwner) notFound();

  // Main-only mode (default): one track — the Main version when it's
  // playable, else the latest ready one. The full tree stays private. Full
  // rows so the hero can cue them into the shared player (bar + overlay).
  if (!project.show_history) {
    let version: Version | null = null;
    if (project.main_version_id) {
      const { data: main } = await supabase
        .from("versions")
        .select("*")
        .eq("id", project.main_version_id)
        .maybeSingle();
      if (main?.render_status === "ready") version = main;
    }
    if (!version) {
      const { data: latest } = await supabase
        .from("versions")
        .select("*")
        .eq("project_id", project.id)
        .eq("render_status", "ready")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      version = latest ?? null;
    }
    return (
      <>
        <TopNav />
        <PublicTrackView
          project={{
            id: project.id,
            title: project.title,
            slug: project.slug,
            artwork_url: project.artwork_url,
            main_version_id: project.main_version_id,
          }}
          producer={{
            username: profile?.username ?? "",
            display_name: profile?.display_name ?? null,
          }}
          version={version}
        />
      </>
    );
  }

  // Full-history mode: the full tree is shared publicly, but only with
  // signed-in listeners. Anonymous visitors get a teaser + sign-in gate that
  // returns them straight here (owners are always signed in, so !user is the
  // gate). Privacy for specific people is handled by share links, not this.
  if (!user) {
    return (
      <>
        <TopNav />
        <ProjectSigninGate project={project} profile={profile} />
      </>
    );
  }

  // The read-only tree/graph view (visitor experience — owners manage from the
  // dashboard).
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        <ProjectView
          projectId={project.id}
          isOwner={false}
          headerActions={<CopyLinkButton path={`/p/${project.slug}`} />}
          artistName={profile?.display_name || profile?.username || null}
          artistUsername={profile?.username || null}
        />
      </main>
    </>
  );
}
