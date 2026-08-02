import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectView } from "@/components/project-view";
import { ProjectSettings } from "@/components/project-settings";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, title, slug, is_public, show_history, main_version_id, artwork_url")
    .eq("id", id)
    .maybeSingle();

  if (!project || project.user_id !== user?.id) notFound();

  // The owner is the artist here — their name is the player bar's artist line.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", project.user_id)
    .maybeSingle();

  return (
    <ProjectView
      projectId={project.id}
      isOwner
      headerActions={<ProjectSettings project={project} />}
      artistName={profile?.display_name || profile?.username || null}
    />
  );
}
