"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Private follow toggle on a producer's /u/[username] header (non-owner only).
 * "Follow" is a personal bookmark — the followee never sees a count (RLS lets a
 * user read only their own follow rows). Signed-out visitors see the button but
 * clicking it routes to sign-in and back. Optimistic; reverts on error.
 */
export function FollowButton({
  profileId,
  username,
  accent = false,
}: {
  profileId: string;
  username: string;
  /** Rosso Corsa treatment: a filled red "Follow" (outlined once following).
   *  Used on the mobile profile panel; the desktop overlay keeps the plain
   *  secondary button. */
  accent?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  const refetch = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setViewerId(user?.id ?? null);
    if (user) {
      // RLS returns only the viewer's own row, so a hit === "I follow them".
      const { data } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("followee_id", profileId)
        .maybeSingle();
      setFollowing(!!data);
    }
    setReady(true);
  }, [supabase, profileId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refetch();
  }, [refetch]);

  async function toggle() {
    if (!viewerId) {
      router.push(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
      return;
    }
    if (pending) return;
    setPending(true);
    const next = !following;
    setFollowing(next); // optimistic
    const { error } = next
      ? await supabase
          .from("follows")
          .insert({ follower_id: viewerId, followee_id: profileId })
      : await supabase.from("follows").delete().eq("followee_id", profileId);
    if (error) setFollowing(!next); // revert
    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      title={following ? "Unfollow" : "Follow"}
      className={cn(
        accent && !following ? buttonClasses("primary") : buttonClasses("secondary"),
        // Following reads in Rosso Corsa — the same red the un-followed accent
        // button is filled with, so the state change is a colour swap rather
        // than a fade to grey.
        following && "text-primary",
        !ready && "opacity-0"
      )}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
