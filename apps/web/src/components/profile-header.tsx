import Link from "next/link";
import type { Profile } from "@/lib/database.types";
import { buttonClasses } from "@/components/ui";
import { ShareProfileButton } from "@/components/share-profile-button";

/**
 * Profile masthead: the banner is the whole block. The avatar sits directly on
 * it and the name/@username/bio live in a frosted-glass panel — backdrop-blur
 * plus a translucent-dark scrim — so the text stays legible over any banner
 * image (not a solid box). Owner actions float top-right on their own frosted
 * tray. Self-contained, so it reads as a distinct block above the projects
 * list. Used by the owner dashboard and the public /u/[username] page.
 */
export function ProfileHeader({
  profile,
  isOwner,
  onPublicPage = false,
}: {
  profile: Profile;
  isOwner: boolean;
  /** true on /u/[username] itself — hides the "View public profile" link */
  onPublicPage?: boolean;
}) {
  const name = profile.display_name || profile.username;
  return (
    <div
      className="relative flex min-h-[15rem] w-full flex-col justify-end overflow-hidden border border-hairline p-4 sm:min-h-[19rem] sm:p-5"
      style={
        profile.banner_url
          ? {
              backgroundImage: `url(${profile.banner_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: "linear-gradient(180deg, #3c3c3c, #030303 64%)" }
      }
    >
      {isOwner && (
        <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2 bg-canvas/40 p-1.5 backdrop-blur-md sm:right-5 sm:top-5">
          {!onPublicPage && (
            <Link
              href={`/u/${profile.username}`}
              className={buttonClasses("tertiary")}
            >
              View public profile
            </Link>
          )}
          <ShareProfileButton username={profile.username} />
          <Link href="/settings/profile" className={buttonClasses("secondary")}>
            Edit profile
          </Link>
        </div>
      )}

      <div className="flex items-end gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-canvas bg-surface-3 sm:h-28 sm:w-28">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
            <img
              src={profile.avatar_url}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-headline text-ink-muted">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 max-w-[min(100%,34rem)] bg-canvas/50 px-4 py-3 backdrop-blur-md">
          <h1 className="truncate text-headline text-ink sm:text-display-md">
            {name}
          </h1>
          <p className="mt-0.5 truncate font-mono text-body-sm text-ink/70">
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-2 line-clamp-2 text-body-sm text-ink/85">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
