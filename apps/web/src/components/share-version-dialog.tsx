"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ShareManager } from "@/components/share-manager";

/**
 * "Share version…" modal (from the version context menu): a private, single-
 * track link for one version. Locked to version scope and defaulted to a
 * 14-day expiry so links self-clean rather than piling up. Dismissed by
 * backdrop click or Escape.
 */
export function ShareVersionDialog({
  projectId,
  version,
  onClose,
}: {
  projectId: string;
  version: { id: string; name: string };
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

  // Portal to <body>: the sticky nav's backdrop-blur would otherwise trap a
  // position:fixed modal.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share version"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border border-hairline bg-surface-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-card-title text-ink">Share version</h2>
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
        <p className="mt-1 truncate font-mono text-mono text-ink-tertiary">
          {version.name}
        </p>
        <ShareManager
          projectId={projectId}
          versionId={version.id}
          lockVersion
          defaultExpiryHours={336}
        />
      </div>
    </div>,
    document.body
  );
}
