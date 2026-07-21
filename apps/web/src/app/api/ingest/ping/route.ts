import { NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/ingest-auth";

/**
 * Token validity check for the local service: 200 while the device is
 * paired, 401 once revoked. Also bumps the device's last_seen_at and
 * returns the owner's username so the service can show/refresh it.
 */
export async function GET(request: Request) {
  const auth = await authenticateDevice(request);
  if ("error" in auth) return auth.error;
  return NextResponse.json({
    ok: true,
    device_id: auth.device.id,
    username: auth.username,
  });
}
