"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonClasses } from "@/components/ui";

const DISMISS_KEY = "sangit-share-signin-dismissed";

/**
 * Dismissible corner prompt on share pages: viewing is open, but liking and
 * commenting need an account. Sits above the fixed player bar.
 */
export function SignInPrompt({ next }: { next: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) setShow(true);
    })();
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 w-72 rounded-lg border border-hairline bg-surface-3 p-4">
      <button
        aria-label="Dismiss"
        className="absolute right-2 top-1.5 p-1 text-ink-subtle hover:text-ink"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setShow(false);
        }}
      >
        ×
      </button>
      <p className="pr-4 text-body-sm text-ink">
        Sign in to like and comment on versions.
      </p>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className={buttonClasses("primary") + " mt-3"}
      >
        Sign in
      </Link>
    </div>
  );
}
