import Link from "next/link";
import type { Profile } from "@/lib/database.types";
import { buttonClasses } from "@/components/ui";
import { ShareProfileButton } from "@/components/share-profile-button";

/**
 * Profile masthead (SoundCloud proportions): a short, wide banner is the whole
 * block. A large circular avatar fills most of its height on the left, and the
 * name/@username/bio sit beside it — vertically centered — each line in its own
 * tight frosted-glass box (backdrop-blur + a translucent-dark scrim) so the
 * text stays legible over any banner image, not a solid box. Owner actions
 * float top-right on their own frosted tray. Used by the owner dashboard and
 * the public /u/[username] page.
 */
export function ProfileHeader({
  profile,
  isOwner,
}: {
  profile: Profile;
  isOwner: boolean;
}) {
  const name = profile.display_name || profile.username;
  return (
    <div
      className="relative h-48 w-full overflow-hidden border border-hairline sm:h-64"
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
        <div className="absolute right-4 top-4 z-10 flex flex-wrap items-center gap-2 bg-canvas/40 p-1.5 backdrop-blur-md">
          <ShareProfileButton username={profile.username} />
          <Link href="/settings/profile" className={buttonClasses("secondary")}>
            Edit profile
          </Link>
        </div>
      )}

      <div className="flex h-full items-center gap-4 p-4 sm:gap-6 sm:p-6">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-canvas bg-surface-3 sm:h-44 sm:w-44">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
            <img
              src={profile.avatar_url}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-display-md text-ink-muted">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <div className="w-fit max-w-full bg-canvas/50 px-3 py-1 backdrop-blur-md">
            <h1 className="truncate text-headline text-ink sm:text-display-md">
              {name}
            </h1>
          </div>
          <div className="w-fit max-w-full bg-canvas/50 px-2.5 py-0.5 backdrop-blur-md">
            <p className="truncate font-mono text-body-sm text-ink/70">
              @{profile.username}
            </p>
          </div>
          {profile.bio && (
            <div className="w-fit max-w-full bg-canvas/50 px-2.5 py-0.5 backdrop-blur-md">
              <p className="truncate text-body-sm text-ink/85">{profile.bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
