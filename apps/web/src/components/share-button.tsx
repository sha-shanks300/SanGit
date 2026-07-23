"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClasses } from "@/components/ui";
import { ShareManager } from "@/components/share-manager";

/**
 * Owner header control: a share icon that opens a centered modal holding the
 * share-link tool. Project-level by default; "this version only" links are
 * available when a version is selected (passed through as `versionId`). Moved
 * out of the version panel so the share advanced settings don't crowd the
 * version details.
 */
export function ShareButton({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses("secondary")}
        aria-label="Share links"
        title="Share"
      >
        <ShareIcon />
      </button>
      {open && (
        <ShareDialog
          projectId={projectId}
          versionId={versionId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareDialog({
  projectId,
  versionId,
  onClose,
}: {
  projectId: string;
  versionId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  // Portal to <body>: the sticky nav's backdrop-blur creates a containing
  // block for position:fixed, which would otherwise trap the modal.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share this project"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border border-hairline bg-surface-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-card-title text-ink">Share</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-ink-subtle transition-colors hover:text-ink"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <ShareManager projectId={projectId} versionId={versionId} />
      </div>
    </div>,
    document.body
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
