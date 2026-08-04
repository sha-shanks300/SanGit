import Link from "next/link";
import type { Profile } from "@/lib/database.types";
import { buttonClasses } from "@/components/ui";
import { ShareProfileButton } from "@/components/share-profile-button";
import { FollowButton } from "@/components/follow-button";

/**
 * Profile masthead. Two layouts share one component:
 *
 * - **Desktop (`sm:`+)** — SoundCloud proportions: a short, wide banner is the
 *   whole block, a large circular avatar fills most of its height on the left,
 *   and the name/@username/bio sit beside it in tight frosted-glass boxes
 *   (backdrop-blur + a translucent scrim) so text stays legible over any image.
 *   Owner/visitor actions float top-right on a frosted tray.
 * - **Mobile (`< sm`)** — stacked: a shorter banner strip, the avatar
 *   overlapping its bottom edge, then name/@username/bio and the action button
 *   on the solid canvas below. No frosted overlay (nothing to collide with the
 *   avatar on a narrow screen), and the bio gets two lines instead of a hard
 *   truncate.
 *
 * Used by the owner dashboard and the public /u/[username] page.
 */
export function ProfileHeader({
  profile,
  isOwner,
}: {
  profile: Profile;
  isOwner: boolean;
}) {
  const name = profile.display_name || profile.username;

  const bannerStyle = profile.banner_url
    ? {
        backgroundImage: `url(${profile.banner_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: "linear-gradient(180deg, #3c3c3c, #030303 64%)" };

  const avatar = profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase-hosted; remotePatterns not configured for next/image
    <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-display-md text-ink-muted">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );

  // `accent` gives the mobile panel's Follow the Rosso Corsa treatment; the
  // desktop overlay passes nothing and keeps the plain secondary button.
  const renderActions = (accent = false) =>
    isOwner ? (
      <>
        <ShareProfileButton username={profile.username} />
        <Link href="/settings/profile" className={buttonClasses("secondary")}>
          Edit profile
        </Link>
      </>
    ) : (
      // Non-owner (incl. signed-out): private follow toggle.
      <FollowButton
        profileId={profile.id}
        username={profile.username}
        accent={accent}
      />
    );

  return (
    <>
      {/* ── Desktop (sm+): frosted overlay on the banner ── */}
      <div
        className="relative hidden h-48 w-full overflow-hidden border border-hairline sm:block sm:h-64"
        style={bannerStyle}
      >
        <div className="absolute right-4 top-4 z-10 flex flex-wrap items-center gap-2 bg-canvas/40 p-1.5 backdrop-blur-md">
          {renderActions()}
        </div>

        <div className="flex h-full items-center gap-6 p-6">
          <div className="h-44 w-44 shrink-0 overflow-hidden rounded-full border-2 border-canvas bg-surface-3">
            {avatar}
          </div>

          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <div className="w-fit max-w-full bg-canvas/50 px-3 py-1 backdrop-blur-md">
              <h1 className="truncate text-ink text-display-md">{name}</h1>
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

      {/* ── Mobile (< sm): stacked below a shorter banner strip ──
          The identity sits on a warm-charcoal panel (#262020) so it reads as a
          distinct block against the #181818 canvas; each text line gets its own
          near-black (canvas) box so it pops against the warm panel. */}
      <div className="sm:hidden">
        <div
          className="h-32 w-full overflow-hidden border border-hairline"
          style={bannerStyle}
        />
        <div className="border-x border-b border-hairline bg-[#262020] px-4 pb-4">
          <div className="-mt-12 flex flex-col items-start gap-3">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-canvas bg-surface-3">
              {avatar}
            </div>

            <div className="flex min-w-0 max-w-full flex-col items-start gap-1.5">
              <div className="w-fit max-w-full bg-canvas px-3 py-1">
                <h1 className="truncate text-headline text-ink">{name}</h1>
              </div>
              <div className="w-fit max-w-full bg-canvas px-2.5 py-0.5">
                <p className="truncate font-mono text-body-sm text-ink/70">
                  @{profile.username}
                </p>
              </div>
              {profile.bio && (
                <div className="w-fit max-w-full bg-canvas px-2.5 py-0.5">
                  <p className="line-clamp-2 text-body-sm text-ink/85">
                    {profile.bio}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {renderActions(true)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
