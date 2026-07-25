"use client";

import { useEffect, useRef } from "react";

/**
 * Left-click menu for a fork branch's label (Tree view). Positioned at the
 * pointer in viewport coordinates; dismissed by click-away or Escape. Only
 * shown for forks — the trunk ("main") has no menu.
 */
export function BranchActionsMenu({
  x,
  y,
  parentLabel,
  onMerge,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  parentLabel: string;
  onMerge: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const left = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 0) - 208);
  const top = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 0) - 96);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Branch actions"
      className="fixed z-50 w-52 border border-hairline-strong bg-surface-3 py-1"
      style={{ left, top }}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full cursor-pointer truncate px-4 py-2 text-left text-body-sm text-ink transition-colors hover:bg-surface-2"
        onClick={() => {
          onMerge();
          onClose();
        }}
      >
        Merge into {parentLabel}…
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full cursor-pointer px-4 py-2 text-left text-body-sm text-primary transition-colors hover:bg-surface-2"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete branch…
      </button>
    </div>
  );
}
