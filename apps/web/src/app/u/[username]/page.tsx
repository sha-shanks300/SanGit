import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { Card, Eyebrow } from "@/components/ui";
import { formatDate } from "@/lib/utils";

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

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        <Eyebrow>Producer</Eyebrow>
        <h1 className="mt-1 text-display-md font-semibold tracking-tight text-ink">
          {profile.display_name || profile.username}
        </h1>
        {profile.bio && (
          <p className="mt-2 max-w-xl text-body text-ink-subtle">{profile.bio}</p>
        )}

        <h2 className="mt-12 text-card-title font-medium text-ink">
          Public projects
        </h2>
        {!projects || projects.length === 0 ? (
          <p className="mt-4 text-body-sm text-ink-subtle">
            Nothing public yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/p/${p.slug}`}>
                <Card className="h-full transition-colors hover:border-hairline-strong hover:bg-surface-2">
                  <h3 className="text-card-title font-medium text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-caption text-ink-tertiary">
                    Updated {formatDate(p.updated_at)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
