import Link from "next/link";
import { ProjectArtwork } from "@/components/project-artwork";
import { buttonClasses, Eyebrow, Panel } from "@/components/ui";

/**
 * Signed-out teaser for a public project whose producer shared the full
 * version history (`show_history`). The header (real, already-public info) is
 * revealed; the timeline is suggested by a decorative silhouette that fades
 * into the canvas, with a sign-in prompt floating over the fade.
 *
 * Deliberately NOT the real <ProjectView>: the version rows are readable by the
 * anon key (RLS: public projects), so rendering + CSS-blurring the real tree
 * would leave every version in the DOM. The silhouette below carries no data —
 * it's pure decoration. The only real content shown is the header.
 *
 * Not a payment wall — the single action is a free sign-in, returned straight
 * back to this project via `?next=` (login/page.tsx threads it through
 * /auth/callback).
 */
export function ProjectSigninGate({
  project,
  profile,
}: {
  project: {
    id: string;
    title: string;
    slug: string;
    artwork_url: string | null;
  };
  profile: { username: string | null; display_name: string | null } | null;
}) {
  const artist = profile?.display_name || profile?.username || "This producer";
  const next = encodeURIComponent(`/p/${project.slug}`);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
      {/* Revealed header — the real, already-public project identity. */}
      <div className="flex min-w-0 items-start gap-5">
        <ProjectArtwork
          projectId={project.id}
          artworkUrl={project.artwork_url}
          title={project.title}
          className="h-32 w-32 shrink-0 border border-hairline"
        />
        <div className="min-w-0">
          <Eyebrow>Project</Eyebrow>
          <h1 className="mt-1 text-headline text-ink">{project.title}</h1>
          <p className="mt-1 text-body-sm text-ink-subtle">by {artist}</p>
        </div>
      </div>

      {/* Obscured timeline + gate. The silhouette fades out downward (mask),
          and the prompt sits over the fade. */}
      <div className="relative mt-8">
        <div
          aria-hidden
          className="pointer-events-none select-none blur-[3px] opacity-60"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 0%, black 30%, transparent 92%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 30%, transparent 92%)",
          }}
        >
          <Panel className="overflow-hidden">
            <Eyebrow>Timeline</Eyebrow>
            <TimelineSilhouette />
          </Panel>
        </div>

        {/* Prompt: wrapper ignores pointer events so it never blocks scroll;
            the card re-enables them for the link. */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="pointer-events-auto flex max-w-md flex-col items-center px-6 text-center animate-signin-gate-rise">
            <p className="text-display-md text-ink">Sign in to view this project</p>
            <p className="mt-3 text-body text-ink-subtle">
              {artist} shared the full version history. Sign in to explore the
              timeline.
            </p>
            <Link href={`/login?next=${next}`} className={buttonClasses("primary") + " mt-6"}>
              Sign in to continue
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Decorative, data-free suggestion of a version tree: a main lane with two
 * forks and scattered nodes, drawn in surface/hairline tones with one accent
 * node echoing the Main indicator. Purely illustrative — no real versions.
 */
function TimelineSilhouette() {
  const lane1 = 70;
  const lane2 = 140;
  const lane3 = 205;
  const main1 = [90, 230, 370, 510, 650, 790, 930, 1070];
  const branch2 = [470, 610, 750, 890];
  const branch3 = [690, 830, 970];

  return (
    <svg
      viewBox="0 0 1160 250"
      className="mt-6 h-auto w-full"
      role="presentation"
    >
      {/* lane edges */}
      <line
        x1={main1[0]}
        y1={lane1}
        x2={main1[main1.length - 1]}
        y2={lane1}
        stroke="var(--hairline-strong)"
        strokeWidth={2}
      />
      <path
        d={`M370 ${lane1} C 410 ${lane1}, 430 ${lane2}, ${branch2[0]} ${lane2} L ${branch2[branch2.length - 1]} ${lane2}`}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth={2}
      />
      <path
        d={`M610 ${lane2} C 650 ${lane2}, 660 ${lane3}, ${branch3[0]} ${lane3} L ${branch3[branch3.length - 1]} ${lane3}`}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth={2}
      />

      {/* nodes */}
      {main1.map((x, i) => (
        <circle
          key={`a${x}`}
          cx={x}
          cy={lane1}
          r={7}
          fill={i === 4 ? "var(--primary)" : "var(--surface-3, #2a2a2a)"}
          stroke="var(--hairline-strong)"
          strokeWidth={1.5}
        />
      ))}
      {branch2.map((x) => (
        <circle
          key={`b${x}`}
          cx={x}
          cy={lane2}
          r={7}
          fill="var(--surface-3, #2a2a2a)"
          stroke="var(--hairline-strong)"
          strokeWidth={1.5}
        />
      ))}
      {branch3.map((x) => (
        <circle
          key={`c${x}`}
          cx={x}
          cy={lane3}
          r={7}
          fill="var(--surface-3, #2a2a2a)"
          stroke="var(--hairline-strong)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
