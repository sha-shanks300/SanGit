import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/lib/database.types";

type ProjectCard = Project & {
  versions: { count: number }[];
  branches: { count: number }[];
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*, versions(count), branches(count)")
    .order("updated_at", { ascending: false })
    .returns<ProjectCard[]>();

  return (
    <div>
      <Eyebrow>Dashboard</Eyebrow>
      <h1 className="mt-1 text-headline font-semibold tracking-tight text-ink">
        Projects
      </h1>

      {!projects || projects.length === 0 ? (
        <Card className="mt-8 max-w-xl">
          <h2 className="text-card-title font-medium text-ink">
            No projects yet
          </h2>
          <p className="mt-2 text-body-sm text-ink-subtle">
            Pair the SanGit local service under{" "}
            <Link href="/settings/devices" className="text-primary-hover">
              Settings → Devices
            </Link>
            , then save your FL Studio project. Your first commit will show up
            here automatically.
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
              <Card className="h-full transition-colors hover:border-hairline-strong hover:bg-surface-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-card-title font-medium text-ink">
                    {p.title}
                  </h2>
                  {p.is_public ? (
                    <StatusBadge tone="success">public</StatusBadge>
                  ) : (
                    <StatusBadge>private</StatusBadge>
                  )}
                </div>
                <p className="mt-3 text-body-sm text-ink-subtle">
                  {p.branches[0]?.count ?? 0} branches · {p.versions[0]?.count ?? 0}{" "}
                  versions
                </p>
                <p className="mt-1 text-caption text-ink-tertiary">
                  Updated {formatDate(p.updated_at)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
