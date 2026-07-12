"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/** Copies the permanent public profile URL (/u/username) to the clipboard.
 *  No token: the link only exposes what is already public. */
export function ShareProfileButton({ username }: { username: string }) {
  const [label, setLabel] = useState<"Share profile" | "Copied" | "Copy failed">(
    "Share profile"
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setLabel("Copied");
    } catch {
      setLabel("Copy failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel("Share profile"), 2000);
  }

  return (
    <Button variant="secondary" onClick={copy} aria-live="polite">
      {label}
    </Button>
  );
}
