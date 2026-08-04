"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DownloadApp } from "@/components/download-app";
import { cn } from "@/lib/utils";

/**
 * Mobile-only nav overflow menu for the signed-out top bar. Desktop keeps
 * Download / Sign in inline; below `sm` they'd overflow next to the lone red
 * "Get started" CTA, so a hamburger collapses them into a popover that mirrors
 * {@link ProfileMenu}'s visual language (surface-3 + hairline-strong, sharp
 * corners, the Rosso Corsa "playhead" tick on the hovered/focused row). Closes
 * on outside-click and Escape, returning focus to the trigger.
 *
 * Signed-in users get their nav through ProfileMenu instead, so this renders
 * only the public actions (Download, Sign in).
 */
export function NavMobileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  // Shared with ProfileMenu: the accent "playhead" tick + row feedback.
  const tick =
    "relative before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:bg-primary before:opacity-0 before:transition-opacity before:content-[''] hover:before:opacity-100 focus-visible:before:opacity-100";
  const item = cn(
    "flex w-full items-center px-4 py-2 text-left text-body-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink focus-visible:outline-none",
    tick
  );

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        className="flex items-center justify-center rounded-md p-2 text-ink-subtle transition-colors hover:text-ink"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M3 6h14M3 10h14M3 14h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden border border-hairline-strong bg-surface-3 py-1.5"
        >
          <DownloadApp variant="tertiary" label="Download" className={item} />
          <Link
            href="/login"
            role="menuitem"
            className={item}
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
