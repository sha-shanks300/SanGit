import { TopNav } from "@/components/top-nav";
import { PlayerProvider } from "@/components/player-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One PlayerProvider for the whole dashboard segment: the same <audio> and
  // bar persist across /dashboard ↔ /dashboard/projects/[id], so a track
  // started from the grid keeps playing when you open its project.
  return (
    <PlayerProvider>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        {children}
      </main>
    </PlayerProvider>
  );
}
