import { artworkFallback, cn } from "@/lib/utils";

/**
 * Square project artwork with the shared no-artwork fallback: deterministic
 * greyscale gradient + project initial. Size/border come from `className`
 * (sharp corners per DESIGN.md — no rounding here). Server-safe; wrap it for
 * interactive uses (e.g. the owner upload affordance in project-view).
 */
export function ProjectArtwork({
  projectId,
  artworkUrl,
  title,
  className,
  initialClassName = "text-headline",
}: {
  projectId: string;
  artworkUrl: string | null;
  title: string;
  className?: string;
  /** Type size of the fallback initial — override for very small/large tiles. */
  initialClassName?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden", className)}
      style={artworkUrl ? undefined : { background: artworkFallback(projectId) }}
    >
      {artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
        <img src={artworkUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center text-ink-muted",
            initialClassName
          )}
        >
          {title.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
