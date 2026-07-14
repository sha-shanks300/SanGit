"use client";

import { useEffect, useRef } from "react";

/**
 * Right-click menu for a version node (Tree and Graph views). Positioned at
 * the pointer in viewport coordinates; dismissed by click-away or Escape.
 */
export function VersionContextMenu({
  x,
  y,
  isMain,
  onSetMain,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  isMain: boolean;
  onSetMain: () => void;
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

  // Keep the menu inside the viewport when invoked near the right/bottom edge.
  const left = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 0) - 192);
  const top = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 0) - 96);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Version actions"
      className="fixed z-50 w-44 border border-hairline-strong bg-surface-3 py-1"
      style={{ left, top }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={isMain}
        className="block w-full cursor-pointer px-4 py-2 text-left text-body-sm text-ink transition-colors hover:bg-surface-2 disabled:cursor-default disabled:text-ink-tertiary"
        onClick={() => {
          onSetMain();
          onClose();
        }}
      >
        {isMain ? "Current Main" : "Set as Main"}
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
        Delete version…
      </button>
    </div>
  );
}
