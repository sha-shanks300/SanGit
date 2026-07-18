import type { Metadata } from "next";

/**
 * Deliberately generic unfurl for private share links: no track title, no
 * artwork — messaging apps cache link previews, so the preview itself must
 * not leak what's behind the token. The wordmark card comes from the
 * segment-level opengraph-image.
 */
export const metadata: Metadata = {
  title: "Private share",
  description: "Someone shared a private track with you on SanGit.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Private share · SanGit",
    description: "Someone shared a private track with you.",
    siteName: "SanGit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Private share · SanGit",
    description: "Someone shared a private track with you.",
  },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
