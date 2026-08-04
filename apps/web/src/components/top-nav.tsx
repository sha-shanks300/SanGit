import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui";
import { NavDownload } from "@/components/nav-download";
import { NavMobileMenu } from "@/components/nav-mobile-menu";
import { ProfileMenu } from "@/components/profile-menu";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

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

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

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
            <>
              {/* Red CTA only when signed in — on the landing, "Get started" is
                  the lone accent, so Download stays quiet there (DESIGN.md: one
                  accent). On mobile Download moves into the ProfileMenu popover
                  so the bar stays to just the avatar. */}
              <div className="hidden sm:block">
                <NavDownload variant="primary" label="Download" />
              </div>
              {profile ? (
                <ProfileMenu profile={profile} />
              ) : (
                <form action="/auth/signout" method="post">
                  <button className={buttonClasses("secondary")} type="submit">
                    Sign out
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              {/* Desktop: full signed-out row. Below sm these would overflow
                  next to the lone red CTA, so Download + Sign in collapse into
                  the hamburger (NavMobileMenu) and only "Get started" stays. */}
              <div className="hidden items-center gap-3 sm:flex">
                <NavDownload variant="tertiary" label="Download" />
                <Link href="/login" className={buttonClasses("secondary")}>
                  Sign in
                </Link>
                <Link href="/#get-started" className={buttonClasses("primary")}>
                  Get started
                </Link>
              </div>
              <Link
                href="/#get-started"
                className={cn(buttonClasses("primary"), "sm:hidden")}
              >
                Get started
              </Link>
              <NavMobileMenu />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
