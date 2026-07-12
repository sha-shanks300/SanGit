import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui";
import { LogoMark } from "@/components/logo";

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink">
      <LogoMark size={30} />
      <span className="font-display text-subhead font-medium tracking-tight">
        SanGit
      </span>
    </Link>
  );
}

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Wordmark />
          {user && (
            <nav className="hidden items-center gap-6 font-mono text-body-sm tracking-[0.28px] text-ink-subtle sm:flex">
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
