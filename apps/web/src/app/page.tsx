import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { buttonClasses, Eyebrow } from "@/components/ui";
import { DownloadApp } from "@/components/download-app";
import { LogoMark } from "@/components/logo";
import heroImage from "./logo/HeroSection.png";

const STEPS = [
  {
    n: "01",
    title: "Save like you always do",
    body: "The tray app watches your FL Studio folders. Hit save and SanGit offers to commit the version. No terminal, no staging, no leaving the DAW.",
  },
  {
    n: "02",
    title: "Every idea keeps its own lane",
    body: "Each commit snapshots the .flp and uploads it. The folder is the project, the filename is the branch. Save midnight-drive-vip.flp and you've branched a new direction without touching the original.",
  },
  {
    n: "03",
    title: "Hear any version, share the best",
    body: "An mp3 renders the moment FL Studio closes, so every save becomes listenable. Scrub the timeline to hear any take, crown one as Main, and share it with private links that expire.",
  },
];

const DETAILS = [
  {
    eyebrow: "Branching",
    title: "Branch without breaking a thing.",
    body: "No checkout commands to learn. A new .flp name in the folder starts a new branch, forked from the exact version you saved it from, so a bold idea never risks the take you love. The timeline tree shows every lane side by side.",
  },
  {
    eyebrow: "Playback",
    title: "Every version, audible.",
    body: "Every save becomes a track you can actually play. An mp3 renders the next time FL Studio closes. Scrub the timeline and hear exactly where the song was that night.",
  },
  {
    eyebrow: "Sharing",
    title: "Yours until you decide to share.",
    body: "Your audio streams over short-lived signed URLs. Nothing ever sits on a public bucket. Share links expire, can be revoked, and log every view, so a work-in-progress stays exactly as private as you want.",
  },
];

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

        {/* How it works — a real pipeline, so the numbers mean something */}
        <section className="border-b border-hairline py-24">
          <Eyebrow>How it works</Eyebrow>
          <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t border-hairline-strong pt-6">
                <span className="font-mono text-mono text-ink-tertiary">
                  {step.n}
                </span>
                <h3 className="mt-4 text-card-title text-ink">{step.title}</h3>
                <p className="mt-3 text-body-sm text-ink-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Spec sheet — editorial rows, eyebrow left / claim right */}
        <section className="py-8">
          {DETAILS.map((d) => (
            <div
              key={d.eyebrow}
              className="grid gap-4 border-b border-hairline py-10 last:border-b-0 md:grid-cols-[220px_1fr] md:gap-8"
            >
              <Eyebrow>{d.eyebrow}</Eyebrow>
              <div className="max-w-2xl">
                <h3 className="text-card-title text-ink">{d.title}</h3>
                <p className="mt-3 text-body text-ink-muted">{d.body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* CTA band */}
        <section className="my-24 flex flex-col items-start justify-between gap-8 border border-hairline bg-surface-1 p-12 md:flex-row md:items-center">
          <h2 className="text-headline text-ink">
            Your best version is one save away.
          </h2>
          <div className="flex items-center gap-3">
            <Link href="/#get-started" className={buttonClasses("primary")}>
              Get started
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
