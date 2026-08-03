"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ProfileMenuProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Circular avatar with an initial-letter fallback. Shared by the trigger and
 * the menu's identity header so both read as the same account. */
function Avatar({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  size: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-surface-4"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-body-sm text-ink-muted">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * Account menu in the top nav: an avatar-plus-caret trigger opening a dropdown
 * popover. The bar keeps Projects/Devices inline on desktop, so the popover is
 * account-only there (identity header, Dashboard, Settings, Sign out). On mobile
 * those inline links are hidden (< sm), so the popover additionally carries
 * Projects/Devices — making it the full mobile nav. Closes on outside-click and
 * Escape, returning focus to the trigger.
 *
 * Styled to match the app's other menus (surface-3 + hairline-strong, sharp
 * corners) with one signature: a Rosso Corsa "playhead" tick that slides in on
 * the hovered/focused row, reusing the brand's accent-as-indicator language.
 */
export function ProfileMenu({ profile }: { profile: ProfileMenuProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const name = profile.display_name || profile.username;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The accent "playhead" tick (before:) + row feedback. Shared so every row —
  // links and the sign-out submit — animates identically.
  const tick =
    "relative before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:bg-primary before:opacity-0 before:transition-opacity before:content-[''] hover:before:opacity-100 focus-visible:before:opacity-100";
  const item = cn(
    "flex w-full items-center px-4 py-2 text-left text-body-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink focus-visible:outline-none",
    tick
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-90"
      >
        <Avatar url={profile.avatar_url} name={name} size={36} />
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn(
            "text-ink-subtle transition-transform duration-200",
            open && "rotate-180"
          )}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden border border-hairline-strong bg-surface-3"
        >
          {/* Identity — the one thing the action menus don't have. */}
          <div className="flex items-center gap-3 border-b border-hairline-strong px-4 py-3.5">
            <Avatar url={profile.avatar_url} name={name} size={40} />
            <div className="min-w-0">
              <p className="truncate text-body-sm font-medium text-ink">{name}</p>
              <p className="truncate font-mono text-caption text-ink-subtle">
                @{profile.username}
              </p>
            </div>
          </div>

          <div className="py-1.5">
            {/* Mobile-only: primary nav links live inline on desktop (< sm hides
                them), so surface them here to keep all navigation reachable. */}
            <div className="sm:hidden">
              <Link
                href="/dashboard"
                role="menuitem"
                className={item}
                onClick={() => setOpen(false)}
              >
                Projects
              </Link>
              <Link
                href="/settings/devices"
                role="menuitem"
                className={item}
                onClick={() => setOpen(false)}
              >
                Devices
              </Link>
              <div className="mx-4 my-1.5 border-t border-hairline" />
            </div>

            <Link
              href="/dashboard"
              role="menuitem"
              className={item}
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/settings/profile"
              role="menuitem"
              className={item}
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>

            <div className="mx-4 my-1.5 border-t border-hairline" />

            <form action="/auth/signout" method="post">
              <button
                role="menuitem"
                type="submit"
                className={cn(
                  "flex w-full items-center px-4 py-2 text-left text-body-sm text-primary transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none",
                  tick
                )}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
