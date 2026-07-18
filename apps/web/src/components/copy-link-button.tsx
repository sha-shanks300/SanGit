"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/** One-click copy of the current page's canonical public URL — the product's
 *  whole distribution loop is pasting links, so don't make people use the
 *  address bar. */
export function CopyLinkButton({
  path,
  label = "Copy link",
}: {
  /** Site-relative path (e.g. /p/my-track); origin is taken from the browser. */
  path: string;
  label?: string;
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

  return (
    <Button variant="secondary" onClick={copy} aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}
