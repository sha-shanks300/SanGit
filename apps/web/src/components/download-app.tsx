"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClasses, Eyebrow } from "@/components/ui";
import { APP_VERSION } from "@/lib/app-version";

/**
 * "Download" button that opens a popup explaining how to install the SanGit
 * tray app. Public (no login needed) — the app is inert until paired, which
 * is the real login gate. Used in the top nav and on the landing hero.
 */
export function DownloadApp({
  variant = "secondary",
  label = "Download",
  className,
}: {
  variant?: "primary" | "secondary" | "tertiary";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? buttonClasses(variant)}
      >
        {label}
      </button>
      {open && <DownloadDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function DownloadDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  // Portal to <body>: the top nav's backdrop-blur creates a containing block
  // for position:fixed, which would otherwise trap this modal inside the
  // 64px header band instead of centering it in the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Download SanGit"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border border-hairline bg-surface-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <Eyebrow>Get the app</Eyebrow>
        <h2 className="mt-3 text-card-title text-ink">SanGit for Windows</h2>
        <p className="mt-2 text-body-sm text-ink-muted">
          The tray app watches your FL Studio project folders and turns every
          save into a version on your account.
        </p>

        <a
          href="/download"
          className={buttonClasses("primary") + " mt-5 w-full"}
        >
          Download for Windows
        </a>
        <p className="mt-2 text-center font-mono text-caption text-ink-tertiary">
          Windows 10 / 11 · v{APP_VERSION} · free
        </p>

        {/* Reassurance: unsigned indie apps trip SmartScreen; this is normal. */}
        <div className="mt-5 border border-hairline bg-surface-2 p-3">
          <p className="text-body-sm text-ink">This app is safe to run.</p>
          <p className="mt-1 text-caption text-ink-muted">
            Windows may show a blue “Windows protected your PC” screen the first
            time — that just means it isn’t code-signed yet, which is normal for
            small indie apps. Click <span className="text-ink">More info</span> →{" "}
            <span className="text-ink">Run anyway</span> and you’re set.
          </p>
        </div>

        <ol className="mt-5 flex flex-col gap-2 text-body-sm text-ink-muted">
          <li>
            <span className="font-mono text-ink-tertiary">1.</span> Run the
            downloaded{" "}
            <span className="font-mono text-ink">SanGitSetup.exe</span> — a quick
            installer adds SanGit to your system tray.
          </li>
          <li>
            <span className="font-mono text-ink-tertiary">2.</span> Open its
            settings and pair it with a code from{" "}
            <span className="text-ink">Settings → Devices</span>.
          </li>
          <li>
            <span className="font-mono text-ink-tertiary">3.</span> Save in FL
            Studio — SanGit does the rest.
          </li>
        </ol>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={buttonClasses("tertiary")}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
