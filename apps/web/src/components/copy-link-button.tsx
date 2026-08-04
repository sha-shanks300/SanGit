"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/** One-click copy of the current page's canonical public URL — the product's
 *  whole distribution loop is pasting links, so don't make people use the
 *  address bar. */
export function CopyLinkButton({
  path,
  label = "Copy link",
  bare = false,
}: {
  /** Site-relative path (e.g. /p/my-track); origin is taken from the browser. */
  path: string;
  label?: string;
  /** Icon-only variant for control clusters that have no room for a button
   *  (the now-playing overlay header). Same copy behaviour, ghost chrome. */
  bare?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  if (bare) {
    return (
      <button
        onClick={copy}
        aria-live="polite"
        aria-label={state === "copied" ? "Link copied" : label}
        title={state === "copied" ? "Copied" : label}
        className={cn(
          "flex items-center justify-center rounded-md p-2 transition-colors",
          state === "copied" ? "text-primary" : "text-ink-subtle hover:text-ink"
        )}
      >
        {state === "copied" ? <CheckIcon /> : <LinkIcon />}
      </button>
    );
  }

  return (
    <Button variant="secondary" onClick={copy} aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}

function LinkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
