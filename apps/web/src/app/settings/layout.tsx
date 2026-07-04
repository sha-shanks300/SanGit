import { TopNav } from "@/components/top-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        {children}
      </main>
    </>
  );
}
