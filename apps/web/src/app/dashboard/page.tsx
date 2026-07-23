import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/ui";
import { ProfileHeader } from "@/components/profile-header";
import { ProjectRows } from "@/components/project-rows";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div>
      {profile ? (
        <ProfileHeader profile={profile} isOwner />
      ) : (
        <Eyebrow>Dashboard</Eyebrow>
      )}
      <ProjectRows />
    </div>
  );
}
