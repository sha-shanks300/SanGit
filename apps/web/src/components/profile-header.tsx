import Link from "next/link";
import type { Profile } from "@/lib/database.types";
import { buttonClasses } from "@/components/ui";
import { ShareProfileButton } from "@/components/share-profile-button";

/**
 * SoundCloud-style profile masthead: banner backdrop, avatar overlapping its
 * bottom edge, name/@username/bio. Presentational — used by the owner
 * dashboard and the public /u/[username] page.
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
    <div>
      <div
        className="h-44 w-full border border-hairline sm:h-60"
        style={
          profile.banner_url
            ? {
                backgroundImage: `url(${profile.banner_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "linear-gradient(180deg, #3c3c3c, #030303 64%)" }
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4 px-2 sm:px-4">
        <div className="flex items-end gap-5">
          <div className="-mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-canvas bg-surface-3 sm:-mt-14 sm:h-28 sm:w-28">
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
          <div className="pb-1">
            <h1 className="text-display-md text-ink">{name}</h1>
            <p className="mt-0.5 font-mono text-body-sm text-ink-subtle">
              @{profile.username}
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
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
      </div>
      {profile.bio && (
        <p className="mt-4 max-w-xl px-2 text-body text-ink-subtle sm:px-4">
          {profile.bio}
        </p>
      )}
    </div>
  );
}
