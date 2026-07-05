import { Eyebrow } from "@/components/ui";
import { ProjectGrid } from "@/components/project-grid";

export default function DashboardPage() {
  return (
    <div>
      <Eyebrow>Dashboard</Eyebrow>
      <h1 className="mt-1 text-headline font-semibold tracking-tight text-ink">
        Projects
      </h1>
      <ProjectGrid />
    </div>
  );
}
