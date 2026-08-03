import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The PlayerProvider now lives in the (app) group layout above, so the same
  // <audio> and bar persist across the whole browsing surface — not just the
  // dashboard segment. This layout just supplies the dashboard chrome.
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        {children}
      </main>
    </>
  );
}
