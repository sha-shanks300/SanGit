import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicProject } from "@/lib/public-project";
import { TopNav } from "@/components/top-nav";
import { ProjectView } from "@/components/project-view";
import { PublicTrackView } from "@/components/public-track-view";
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
  // playable, else the latest ready one. The full tree stays private.
  if (!project.show_history) {
    let version: { id: string; display_name: string | null; file_name: string; duration_secs: number | null } | null =
      null;
    if (project.main_version_id) {
      const { data: main } = await supabase
        .from("versions")
        .select("id, display_name, file_name, duration_secs, render_status")
        .eq("id", project.main_version_id)
        .maybeSingle();
      if (main?.render_status === "ready") version = main;
    }
    if (!version) {
      const { data: latest } = await supabase
        .from("versions")
        .select("id, display_name, file_name, duration_secs")
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
          project={project}
          producer={{
            username: profile?.username ?? "",
            display_name: profile?.display_name ?? null,
          }}
          version={
            version
              ? {
                  id: version.id,
                  name: version.display_name || version.file_name,
                  duration_secs: version.duration_secs,
                }
              : null
          }
        />
      </>
    );
  }

  // Full-history mode: the read-only tree/graph view (visitor experience —
  // owners manage from the dashboard).
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        <ProjectView
          projectId={project.id}
          isOwner={false}
          headerActions={<CopyLinkButton path={`/p/${project.slug}`} />}
        />
      </main>
    </>
  );
}
