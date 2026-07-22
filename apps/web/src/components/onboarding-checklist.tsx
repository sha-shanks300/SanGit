"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonClasses, Card } from "@/components/ui";
import { DownloadApp } from "@/components/download-app";

/**
 * First-run guide shown in the dashboard empty state (no projects yet):
 * Download -> Connect -> Save. "Connect" ticks live via a Realtime
 * subscription on `devices` (RLS scopes to the user); "Download" is inferred
 * as done once a device exists (it isn't server-detectable). "Save" is the
 * goal — when the first version lands, ProjectRows swaps this out for the
 * project list, so it's never shown checked here.
 */
export function OnboardingChecklist() {
  const supabase = useMemo(() => createClient(), []);
  const [hasDevice, setHasDevice] = useState(false);

  const refetch = useCallback(async () => {
    const { count } = await supabase
      .from("devices")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null);
    setHasDevice((count ?? 0) > 0);
  }, [supabase]);

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
    <Card className="mt-8 max-w-xl">
      <h2 className="text-card-title font-medium text-ink">Get SanGit set up</h2>
      <p className="mt-1 text-body-sm text-ink-subtle">
        Three quick steps to your first version.
      </p>

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
