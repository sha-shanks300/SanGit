"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { ShareManager } from "@/components/share-manager";
import { Eyebrow } from "@/components/ui";

/**
 * Dev-only playground for the private share tool: renders the real
 * {@link ShareManager} in the same chrome the Share modal gives it, in both of
 * its shapes — project-scoped (the header Share button) and version-locked
 * ("Share version…"). Lets the expiry segments and the copy-once block be
 * styled without auth or a live project. 404s in production builds.
 *
 * The POST that mints a link is stubbed below so "New link" produces a fake URL
 * instead of a 401. The saved-links list stays empty: it reads share_links
 * through RLS, which correctly returns nothing for an anonymous visitor. To
 * exercise the revoke row you need a real session on a real project.
 */

const P = "00000000-0000-4000-8000-0000000000aa";
const V = "00000000-0000-4000-8000-0000000000cc";

export default function DevSharePage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Intercept only the mint call; everything else falls through untouched.
  useEffect(() => {
    const real = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (url.includes("/api/share-links") && (init?.method ?? "GET") === "POST") {
        const token = Math.random().toString(36).slice(2, 10).padEnd(8, "x");
        return new Response(
          JSON.stringify({
            id: crypto.randomUUID(),
            url: `${window.location.origin}/s/dev_${token}`,
            expires_at: null,
            max_views: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return real(input, init);
    };
    return () => {
      window.fetch = real;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
      <Eyebrow>Dev</Eyebrow>
      <h1 className="mt-1 text-headline text-ink">Share links playground</h1>
      <p className="mt-4 max-w-xl text-body-sm text-ink-muted">
        Both shapes of the real share tool. Click the expiry segments to check
        the ramp, the hover darkening, and the selected state; &ldquo;New
        link&rdquo; is stubbed and returns a fake URL so the copy-once block
        renders. The saved-links list stays empty without a session.
      </p>

      <div className="mt-8 flex flex-wrap items-start gap-8">
        <Card title="Project link — header Share button">
          <ShareManager projectId={P} versionId={V} />
        </Card>

        <Card title="Single version link — “Share version…”">
          <ShareManager projectId={P} versionId={V} lockVersion />
        </Card>
      </div>
    </main>
  );
}

/** The Share modal's panel, minus the portal/backdrop — same surface, border
 *  and width so spacing inside reads exactly as it does in the dialog. */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md border border-hairline bg-surface-3 p-6">
      <h2 className="text-card-title text-ink">{title}</h2>
      {children}
    </div>
  );
}
