import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Read-only preview of a pairing code: resolves the owner's username WITHOUT
 * claiming the code or creating a device. Lets the local service confirm
 * "Pair this PC with @username?" before committing — the anti-phishing gate.
 * Distinct statuses so the client can show a precise message:
 *   404 not_found · 409 claimed · 410 expired · 200 { username }
 */
export async function POST(request: Request) {
  let body: { code?: string };
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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pairing) {
    return NextResponse.json(
      { error: "invalid pairing code", reason: "not_found" },
      { status: 404 }
    );
  }
  if (pairing.claimed_at) {
    return NextResponse.json(
      { error: "pairing code already used", reason: "claimed" },
      { status: 409 }
    );
  }
  if (new Date(pairing.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "pairing code expired", reason: "expired" },
      { status: 410 }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", pairing.user_id)
    .single();

  return NextResponse.json({ username: profile?.username ?? null });
}
