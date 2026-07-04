import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDeviceToken, hashToken } from "@/lib/ingest-auth";

/**
 * Exchange a dashboard-issued pairing code for a long-lived device token.
 * Called once by the local service during first-run setup.
 */
export async function POST(request: Request) {
  let body: { code?: string; device_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pairing } = await admin
    .from("device_pairings")
    .select("*")
    .eq("code", code)
    .is("claimed_at", null)
    .single();

  if (!pairing || new Date(pairing.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "invalid or expired pairing code" },
      { status: 404 }
    );
  }

  const token = generateDeviceToken();
  const deviceName = (body.device_name ?? "Studio PC").slice(0, 60);

  const { data: device, error: deviceError } = await admin
    .from("devices")
    .insert({
      user_id: pairing.user_id,
      name: deviceName,
      token_hash: hashToken(token),
    })
    .select()
    .single();

  if (deviceError || !device) {
    return NextResponse.json({ error: "failed to create device" }, { status: 500 });
  }

  await admin
    .from("device_pairings")
    .update({ claimed_at: new Date().toISOString(), device_name: deviceName })
    .eq("id", pairing.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", pairing.user_id)
    .single();

  return NextResponse.json({
    device_token: token,
    device_id: device.id,
    username: profile?.username ?? null,
  });
}
