import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { ProjectView } from "@/components/project-view";

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS: only public projects (or the owner's own) resolve here.
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (!project || (!project.is_public && project.user_id !== user?.id)) {
    notFound();
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        <ProjectView projectId={project.id} isOwner={project.user_id === user?.id} />
      </main>
    </>
  );
}
