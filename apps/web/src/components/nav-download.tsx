"use client";

import { useEffect, useState } from "react";
import { DownloadApp } from "@/components/download-app";
import { cn } from "@/lib/utils";

/**
 * Nav "Download" that yields to the page's in-content download buttons. It
 * watches every element marked `[data-download-anchor]` (the hero and
 * bottom-CTA buttons on the landing page) and fades itself out whenever any of
 * them is on screen, so the page never shows two download buttons at once.
 *
 * The behaviour is driven purely by the presence of those anchors — on pages
 * that have none (dashboard, login, public share pages) the observer bails and
 * the button stays exactly as it was, including the logged-in nav where
 * Download is the primary red CTA. No page-type checks needed.
 */
export function NavDownload({
  variant,
  label = "Download",
}: {
  variant?: "primary" | "secondary" | "tertiary";
  label?: string;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLElement>("[data-download-anchor]")
    );
    if (anchors.length === 0) return;

    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }
        setHidden(onScreen.size > 0);
      },
      // Treat the hero button as "gone" the moment it slides under the 64px
      // sticky nav, not only once it fully clears the viewport top.
      { rootMargin: "-64px 0px 0px 0px" }
    );
    anchors.forEach((a) => observer.observe(a));
    return () => observer.disconnect();
  }, []);

  // Space is reserved (opacity fade, not unmount) so the adjacent nav buttons
  // never reflow as it appears/disappears.
  return (
    <div
      className={cn(
        "transition-opacity duration-300 motion-reduce:transition-none",
        hidden && "pointer-events-none opacity-0"
      )}
      aria-hidden={hidden}
    >
      <DownloadApp variant={variant} label={label} />
    </div>
  );
}
