import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { buttonClasses, Eyebrow } from "@/components/ui";
import { DownloadApp } from "@/components/download-app";
import { LogoMark } from "@/components/logo";
import heroImage from "./logo/HeroSection.png";
import branchingShot from "./logo/Tree.png";
import commitShot from "./logo/Commit.png";
import sharingShot from "./logo/Share.png";

// The feature showcase — each entry pairs a real product screenshot with the
// claim it proves. The tray/commit shot is captured on the desktop app, so it
// stays a labelled placeholder (see `shot`) until that image is dropped in.
type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  image: StaticImageData | null;
  alt?: string;
  shot?: string;
};

const FEATURES: Feature[] = [
  {
    eyebrow: "Branching",
    title: "See your whole song as a tree.",
    body: "Every save becomes a version on its branch. Give the file a new name and a new idea branches off, rooted in the exact take you left behind. See it all two ways: a quiet tree of every branch, or a living graph you can push around.",
    image: branchingShot,
    alt: "SanGit's timeline tree: three branches of a project, each with several versions, one crowned Main and another marked most-liked.",
  },
  {
    eyebrow: "Playback",
    title: "Every save is a track you can play.",
    body: "The moment FL Studio closes, each save turns into sound. Scrub the timeline and hear where the song stood that night. The music follows you from page to page and never stops for a reload.",
    image: null,
    shot: "Player bar mid-playback, over the version timeline",
  },
  {
    eyebrow: "Committing",
    title: "Keep your hands on the keys.",
    body: "SanGit waits quietly in your tray, watching your project folders. Hit save the way you always do and it offers to keep that version, then tucks it away in the background. No commands to learn, no rhythm to break.",
    image: commitShot,
    alt: "SanGit's tray prompt asking to commit the version just saved in FL Studio.",
  },
  {
    eyebrow: "Sharing",
    title: "Share it long before it's done.",
    body: "No need to wait for the final master. Send any take the moment it moves you, a rough loop or a half-finished drop, straight from the studio. The link fades on its own and answers only to you, so you can get ears on an idea while it's still warm.",
    image: sharingShot,
    alt: "SanGit's share manager: private links with view counts, expiry dates, and a revoke control on each.",
  },
];

// A captured screenshot in an on-brand frame — hairline border, sharp corners,
// shown at its natural aspect (the screens vary in shape).
function ShotFrame({
  image,
  alt,
}: {
  image: StaticImageData;
  alt: string;
}) {
  return (
    <div className="overflow-hidden border border-hairline-strong bg-surface-1">
      <Image
        src={image}
        alt={alt}
        className="h-auto w-full"
        sizes="(max-width: 768px) 100vw, 600px"
      />
    </div>
  );
}

// On-brand placeholder plate: surface-1, hairline, sharp corners, with a mono
// label naming the screenshot that belongs here (used for the tray shot).
function ShotPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden border border-hairline-strong bg-surface-1">
      <div
        aria-hidden
        className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0,transparent_11px,rgba(255,255,255,0.02)_11px,rgba(255,255,255,0.02)_12px)]"
      />
      <div className="relative flex flex-col items-center gap-2 px-8 text-center">
        <span className="font-mono text-eyebrow uppercase text-ink-tertiary">
          Screenshot
        </span>
        <span className="max-w-xs text-body-sm text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <TopNav />
      <main className="w-full flex-1">
        {/* Hero — full-bleed image plate; the artwork melts into the canvas
            at the bottom so the white display type stays on brand. */}
        <section className="relative flex h-[min(88vh,820px)] min-h-[560px] w-full items-end overflow-hidden">
          <Image
            src={heroImage}
            alt="A record spinning music into a branching version graph, guided by a reaching hand"
            priority
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,24,0)_30%,rgba(24,24,24,0.55)_62%,#181818_97%)]"
          />
          <div className="relative mx-auto w-full max-w-[1280px] px-6 pb-16">
            <Eyebrow className="text-ink/70">
              Version control for your music.
            </Eyebrow>
            <h1 className="mt-5 max-w-4xl text-[clamp(40px,7.5vw,96px)] leading-none tracking-[-0.02em] text-ink">
              Build your masterpiece, one commit at a time.
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-ink/85">
              SanGit tracks every take, mix, and variation of your solo projects
              so you never lose a great idea again.
            </p>
            <div className="mt-10 flex items-center gap-3">
              <Link href="/#get-started" className={buttonClasses("primary")}>
                Get started
              </Link>
              <DownloadApp variant="secondary" label="Download for Windows" anchor />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1280px] px-6">
        {/* What it is — a plain-language explainer so visitors understand
            SanGit before the checklist asks them to sign in. */}
        <section className="border-b border-hairline py-24">
          <Eyebrow>What it is</Eyebrow>
          <p className="mt-6 max-w-3xl text-subhead text-ink">
            SanGit is version control for your FL Studio projects. A small tray
            app watches your folders, turns every save into a labelled version
            on its own branch, and renders each one to audio you can play back,
            so no idea is ever lost and any version is one click from sharing.
          </p>
        </section>
        {/* Get started — the four-step onboarding checklist that every
            "Get started" button scrolls to. Static: the landing is
            logged-out only, so there's no live progress to track. */}
        <section id="get-started" className="scroll-mt-24 border-b border-hairline py-24">
          <Eyebrow>Get started</Eyebrow>
          <h2 className="mt-3 text-headline text-ink">
            Four steps to your first commit.
          </h2>
          <ol className="mt-12 flex flex-col">
            <li className="flex flex-col gap-4 border-t border-hairline-strong py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-5">
                <span className="font-mono text-mono text-ink-tertiary">01</span>
                <div>
                  <h3 className="text-card-title text-ink">Sign in</h3>
                  <p className="mt-1 text-body-sm text-ink-muted">
                    Create your account or sign back in. It only takes a few
                    seconds.
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className={buttonClasses("primary") + " shrink-0"}
              >
                Sign in
              </Link>
            </li>
            <li className="flex flex-col gap-4 border-t border-hairline-strong py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-5">
                <span className="font-mono text-mono text-ink-tertiary">02</span>
                <div>
                  <h3 className="text-card-title text-ink">Download the app</h3>
                  <p className="mt-1 text-body-sm text-ink-muted">
                    Grab the Windows tray app that watches your FL Studio folders
                    and pairs to your account.
                  </p>
                </div>
              </div>
              <DownloadApp
                label="Download for Windows"
                anchor
                className={buttonClasses("secondary") + " shrink-0"}
              />
            </li>
            <li className="flex items-start gap-5 border-t border-hairline-strong py-6">
              <span className="font-mono text-mono text-ink-tertiary">03</span>
              <div>
                <h3 className="text-card-title text-ink">Make music</h3>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Open FL Studio and work exactly like you always do. SanGit stays
                  out of the way.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-5 border-t border-hairline-strong py-6">
              <span className="font-mono text-mono text-ink-tertiary">04</span>
              <div>
                <h3 className="text-card-title text-ink">Commit</h3>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Hit save, and SanGit snapshots the version to your account,
                  ready to hear and share.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Feature showcase — strict alternating image/text rows
            (left/right/left/right). Each screenshot proves its claim; the
            playback shot stays a placeholder until captured. */}
        <section className="border-b border-hairline py-24">
          <Eyebrow>What you get</Eyebrow>
          <div className="mt-16 flex flex-col gap-20 md:gap-28">
            {FEATURES.map((f, i) => (
              <div
                key={f.eyebrow}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-16"
              >
                <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                  {f.image ? (
                    <ShotFrame image={f.image} alt={f.alt!} />
                  ) : (
                    <ShotPlaceholder label={f.shot!} />
                  )}
                </div>
                <div className={i % 2 === 1 ? "md:order-1" : undefined}>
                  <Eyebrow>{f.eyebrow}</Eyebrow>
                  <h3 className="mt-4 max-w-md text-display-md text-ink">
                    {f.title}
                  </h3>
                  <p className="mt-5 max-w-lg text-body text-ink-muted">
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="my-24 flex flex-col items-start justify-between gap-8 border border-hairline bg-surface-1 p-12 md:flex-row md:items-center">
          <h2 className="text-headline text-ink">
            Your best version is one save away.
          </h2>
          <div className="flex items-center gap-3">
            <Link href="/login" className={buttonClasses("primary")}>
              Sign in
            </Link>
            <DownloadApp variant="secondary" label="Download for Windows" anchor />
          </div>
        </section>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-8">
          <div className="flex items-center gap-2 text-ink">
            <LogoMark size={16} />
            <span className="text-body-sm font-medium tracking-tight">
              SanGit
            </span>
          </div>
          <span className="font-mono text-caption text-ink-tertiary">
            © 2026 SanGit
          </span>
        </div>
      </footer>
    </>
  );
}
