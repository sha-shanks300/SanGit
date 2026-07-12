import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShareLink } from "@/lib/database.types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ShareTokenResult =
  | { ok: true; link: ShareLink; admin: AdminClient }
  | { ok: false; status: 404 | 410; error: string };

/**
 * Resolve a raw share token to its link row via the service-role client (the
 * token IS the credential; RLS can't see it). Enforces revocation and expiry;
 * max-views accounting stays with the payload route — sub-resource fetches
 * (audio, interactions) must not burn views.
 */
export async function resolveShareLink(token: string): Promise<ShareTokenResult> {
  if (!token || token.length < 16 || token.length > 128) {
    return { ok: false, status: 404, error: "invalid link" };
  }

  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: link } = await admin
    .from("share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link || link.revoked_at) {
    return { ok: false, status: 404, error: "link revoked or unknown" };
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, status: 410, error: "link expired" };
  }
  return { ok: true, link, admin };
}

/**
 * A share link grants access to exactly one version (version-scoped) or every
 * version of one project (project-scoped). Never trust a client version id
 * without this check.
 */
export async function versionInScope(
  admin: AdminClient,
  link: ShareLink,
  versionId: string
): Promise<boolean> {
  if (link.version_id) return versionId === link.version_id;
  if (!link.project_id) return false;
  const { data } = await admin
    .from("versions")
    .select("id")
    .eq("id", versionId)
    .eq("project_id", link.project_id)
    .maybeSingle();
  return data != null;
}
