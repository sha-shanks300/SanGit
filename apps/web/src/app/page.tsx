import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { buttonClasses } from "@/components/ui";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <TopNav />
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-[clamp(36px,7vw,80px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">
          Version control for your music.
        </h1>
        <p className="mt-6 max-w-xl text-body-lg text-ink-subtle">
          Every FL Studio save, committed. Branch your ideas, hear every
          version, and share the one that matters.
        </p>
        <div className="mt-10 flex items-center gap-3">
          <Link href="/login" className={buttonClasses("primary")}>
            Get started
          </Link>
          <Link href="/login" className={buttonClasses("secondary")}>
            Sign in
          </Link>
        </div>
      </main>
    </>
  );
}
