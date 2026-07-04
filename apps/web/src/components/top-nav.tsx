import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui";

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-ink">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <circle cx="4" cy="9" r="2.5" fill="var(--primary)" />
        <circle cx="13" cy="4" r="2.5" fill="var(--primary)" />
        <circle cx="13" cy="14" r="2.5" fill="var(--primary)" />
        <path d="M6 8l5-3.2M6 10l5 3.2" stroke="var(--primary)" strokeWidth="1.5" />
      </svg>
      <span className="text-body-sm font-semibold tracking-tight">SanGit</span>
    </Link>
  );
}

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Wordmark />
          {user && (
            <nav className="hidden items-center gap-6 text-body-sm text-ink-subtle sm:flex">
              <Link href="/dashboard" className="hover:text-ink transition-colors">
                Projects
              </Link>
              <Link href="/settings/devices" className="hover:text-ink transition-colors">
                Devices
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <form action="/auth/signout" method="post">
              <button className={buttonClasses("secondary")} type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className={buttonClasses("secondary")}>
                Sign in
              </Link>
              <Link href="/login" className={buttonClasses("primary")}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
