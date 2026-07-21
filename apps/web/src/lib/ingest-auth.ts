import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Device } from "@/lib/database.types";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateDeviceToken() {
  return `sgd_${randomBytes(32).toString("hex")}`;
}

/**
 * Validates the `Authorization: Bearer <device token>` header on ingest
 * routes. Returns the device row (with user_id) and the owner's username
 * (null if the profile has no handle set yet), or a 401 response.
 */
export async function authenticateDevice(
  request: Request
): Promise<{ device: Device; username: string | null } | { error: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return {
      error: NextResponse.json({ error: "missing device token" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("*")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .single();

  if (!device) {
    return {
      error: NextResponse.json({ error: "invalid device token" }, { status: 401 }),
    };
  }

  // Fire-and-forget last_seen update.
  void admin
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id)
    .then(() => {});

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", device.user_id)
    .single();

  return { device, username: profile?.username ?? null };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
