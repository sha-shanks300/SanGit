"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonClasses, Card } from "@/components/ui";
import { DownloadApp } from "@/components/download-app";
import { cn } from "@/lib/utils";

/**
 * First-run guide shown in the dashboard empty state (no projects yet):
 * Download -> Connect -> Save. "Connect" ticks live via a Realtime
 * subscription on `devices` (RLS scopes to the user); "Download" is inferred
 * as done once a device exists (it isn't server-detectable). "Save" is the
 * goal — when the first version lands, ProjectRows swaps this out for the
 * project list, so it's never shown checked here.
 */
export function OnboardingChecklist({
  collapsible = false,
  className,
}: {
  /** Listener layout: render a chevron that collapses this to a header-only
   *  "dropdown" (choice remembered), so listen-first users can tuck it away. */
  collapsible?: boolean;
  className?: string;
} = {}) {
  const supabase = useMemo(() => createClient(), []);
  const [hasDevice, setHasDevice] = useState(false);
  // Expanded on first run; the collapse choice is remembered across sessions.
  const [open, setOpen] = useState(true);

  const refetch = useCallback(async () => {
    const { count } = await supabase
      .from("devices")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null);
    setHasDevice((count ?? 0) > 0);
  }, [supabase]);

  useEffect(() => {
    if (localStorage.getItem("sangit-setup-collapsed") === "1")
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unavailable during SSR; restore preference post-mount
      setOpen(false);
  }, []);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      localStorage.setItem("sangit-setup-collapsed", next ? "0" : "1");
      return next;
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
    const channel = supabase
      .channel("onboarding-devices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  const steps = [
    {
      n: "01",
      title: "Download the app",
      body: "Install the SanGit tray app on the PC where you make music.",
      done: hasDevice,
      action: <DownloadApp variant="secondary" label="Download for Windows" />,
    },
    {
      n: "02",
      title: "Connect it to your account",
      body: "Generate a pairing code and enter it in the app to link this PC.",
      done: hasDevice,
      action: (
        <Link href="/settings/devices" className={buttonClasses("secondary")}>
          Generate a pairing code
        </Link>
      ),
      pendingHint: "Waiting for your device to pair…",
    },
    {
      n: "03",
      title: "Save in FL Studio",
      body: "Hit save on a project — your first version shows up here automatically.",
      done: false,
    },
  ];

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-card-title font-medium text-ink">
            Get SanGit set up
          </h2>
          <p className="mt-1 text-body-sm text-ink-subtle">
            Three quick steps to your first version.
          </p>
        </div>
        {collapsible && (
          <button
            onClick={toggleOpen}
            aria-expanded={open}
            aria-label={open ? "Collapse setup steps" : "Expand setup steps"}
            className="-mr-1 shrink-0 p-1.5 text-ink-subtle transition-colors hover:text-ink"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className={cn("transition-transform", open && "rotate-180")}
              aria-hidden
            >
              <path d="M4 7.5l6 5 6-5" />
            </svg>
          </button>
        )}
      </div>

      {(open || !collapsible) && (
      <ol className="mt-6 flex flex-col gap-6">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-4">
            <StepMark n={step.n} done={step.done} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-body font-medium text-ink">{step.title}</h3>
                {step.done && (
                  <span className="font-mono text-caption uppercase tracking-[0.28px] text-success">
                    Done
                  </span>
                )}
              </div>
              <p className="mt-1 text-body-sm text-ink-muted">{step.body}</p>
              {!step.done && (
                <>
                  {step.action && <div className="mt-3">{step.action}</div>}
                  {step.pendingHint && (
                    <p className="mt-2 font-mono text-caption text-ink-tertiary">
                      {step.pendingHint}
                    </p>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      )}
    </Card>
  );
}

function StepMark({ n, done }: { n: string; done: boolean }) {
  if (done) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success text-success">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline-strong font-mono text-caption text-ink-tertiary">
      {n}
    </span>
  );
}
