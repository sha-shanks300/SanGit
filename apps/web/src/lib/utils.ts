export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(secs: number | null | undefined) {
  if (secs == null || !isFinite(secs)) return "--:--";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Deterministic greyscale gradient for projects without artwork — hashes the
 * id into an angle + two surface-ladder greys (no new chromatic colors, per
 * DESIGN.md accent scarcity).
 */
export function artworkFallback(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const greys = ["#222222", "#2b2b2b", "#343434", "#3f3f3f", "#4a4a4a"];
  const a = greys[h % greys.length];
  const b = greys[(h >> 3) % greys.length];
  const angle = (h >> 6) % 360;
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
