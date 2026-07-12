import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { buttonClasses, Eyebrow } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import heroImage from "./logo/HeroSection.png";

const STEPS = [
  {
    n: "01",
    title: "Save in FL Studio",
    body: "The tray app watches your project folders. Hit save and SanGit asks if you want to commit — no terminal, no staging, no leaving the DAW.",
  },
  {
    n: "02",
    title: "Commit the version",
    body: "The .flp is snapshotted and uploaded. The folder is the project and the filename is the branch — save midnight-drive-vip.flp and you've branched.",
  },
  {
    n: "03",
    title: "Hear it, share it",
    body: "An mp3 renders when FL Studio closes. Play any version on the timeline, crown one as Main, and share with private, expiring links.",
  },
];

const DETAILS = [
  {
    eyebrow: "Branching",
    title: "Branch by filename.",
    body: "No checkout commands. A new .flp name in the project folder is a new branch, forked from the version you saved it from. The timeline tree shows every lane side by side.",
  },
  {
    eyebrow: "Playback",
    title: "Every version, audible.",
    body: "Versions land as project files and become listenable the next time FL Studio closes. Scrub any save on the timeline and hear exactly where the track was that night.",
  },
  {
    eyebrow: "Sharing",
    title: "Private by default.",
    body: "Audio streams over short-lived signed URLs — nothing sits on a public bucket. Share links expire, can be revoked, and log every view.",
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
              Version control for FL Studio
            </Eyebrow>
            <h1 className="mt-5 max-w-4xl text-[clamp(40px,7.5vw,96px)] leading-none tracking-[-0.02em] text-ink">
              Version control for your music.
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-ink/85">
              SanGit watches your FL Studio folders. Every save becomes a
              version on a branch — snapshotted, rendered to audio, ready to
              share.
            </p>
            <div className="mt-10 flex items-center gap-3">
              <Link href="/login" className={buttonClasses("primary")}>
                Get started
              </Link>
              <Link href="/login" className={buttonClasses("secondary")}>
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1280px] px-6">
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
            Your next save is a commit.
          </h2>
          <Link href="/login" className={buttonClasses("primary")}>
            Get started
          </Link>
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
