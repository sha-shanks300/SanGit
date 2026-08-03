import { PlayerProvider } from "@/components/player-provider";

/**
 * One PlayerProvider for the whole authenticated/browsing surface (dashboard,
 * /u profiles, /p projects). A single <audio> + bar persists across every
 * navigation within this group — so clicking a track's artist to open their
 * profile never interrupts playback. Each page still renders its own TopNav.
 *
 * Share pages (/s/[token]) deliberately stay OUTSIDE this group: they use a
 * token-scoped provider with different audio routes.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlayerProvider>{children}</PlayerProvider>;
}
