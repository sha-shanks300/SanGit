"use client";

import { use, useEffect, useState } from "react";
import {
  SharedVersionPlayer,
  type SharedVersionPayload,
} from "@/components/shared-version-player";
import {
  SharedProjectView,
  type SharedProjectPayload,
} from "@/components/shared-project-view";

type Payload =
  | ({ scope: "version" } & SharedVersionPayload)
  | ({ scope: "project" } & SharedProjectPayload);

/**
 * Share-link landing page. The token-gated payload decides what renders:
 * a single-track private player (version-scoped links) or the read-only
 * project view with every version (project-scoped links).
 */
export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/listen/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "unavailable");
        setData(body);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-8">
          <h1 className="text-card-title font-medium text-ink">
            This link isn&apos;t available
          </h1>
          <p className="mt-2 text-body-sm text-ink-subtle">
            It may have expired, hit its view limit, or been revoked by the
            artist.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <p className="text-body-sm text-ink-subtle">Loading…</p>
      </main>
    );
  }

  return data.scope === "project" ? (
    <SharedProjectView token={token} payload={data} />
  ) : (
    <SharedVersionPlayer token={token} data={data} />
  );
}
