"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Device, DevicePairing } from "@/lib/database.types";
import { Button, Card, Eyebrow, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

function generatePairingCode() {
  // 8 chars, unambiguous alphabet, e.g. "7KFM-2XQ9"
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairing, setPairing] = useState<DevicePairing | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("devices")
      .select("*")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setDevices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state lands after await
    refresh();
  }, [refresh]);

  // While a pairing code is displayed, poll for the service claiming it.
  useEffect(() => {
    if (!pairing) return;
    const interval = setInterval(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("device_pairings")
        .select("claimed_at")
        .eq("id", pairing.id)
        .single();
      if (data?.claimed_at) {
        setPairing(null);
        refresh();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pairing, refresh]);

  async function createPairingCode() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const code = generatePairingCode();
    const { data, error } = await supabase
      .from("device_pairings")
      .insert({
        user_id: user.id,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (!error) setPairing(data);
  }

  async function revokeDevice(id: string) {
    const supabase = createClient();
    await supabase
      .from("devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    refresh();
  }

  return (
    <div className="max-w-2xl">
      <Eyebrow>Settings</Eyebrow>
      <h1 className="mt-1 text-headline font-semibold tracking-tight text-ink">
        Devices
      </h1>
      <p className="mt-2 text-body-sm text-ink-subtle">
        Pair the SanGit local service on your studio machine so it can upload
        committed versions to your account.
      </p>

      <Card className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-body font-medium text-ink">Pair a new device</h2>
            <p className="mt-1 text-body-sm text-ink-subtle">
              Generate a code, then enter it in the SanGit tray app on your PC.
            </p>
          </div>
          <Button onClick={createPairingCode}>Generate code</Button>
        </div>
        {pairing && (
          <div className="mt-5 rounded-md border border-hairline bg-surface-2 p-4 text-center">
            <p className="font-mono text-[28px] tracking-[6px] text-ink">
              {pairing.code}
            </p>
            <p className="mt-2 text-caption text-ink-subtle">
              Expires in 10 minutes. Waiting for the device to connect…
            </p>
          </div>
        )}
      </Card>

      <div className="mt-8">
        <h2 className="text-body font-medium text-ink">Paired devices</h2>
        {loading ? (
          <p className="mt-3 text-body-sm text-ink-subtle">Loading…</p>
        ) : devices.length === 0 ? (
          <p className="mt-3 text-body-sm text-ink-subtle">
            No devices paired yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-hairline bg-surface-1 px-4 py-3"
              >
                <div>
                  <p className="text-body-sm text-ink">{d.name}</p>
                  <p className="mt-0.5 text-caption text-ink-subtle">
                    Paired {formatDate(d.created_at)}
                    {d.last_seen_at && ` · last seen ${formatDate(d.last_seen_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge tone="success">active</StatusBadge>
                  <Button variant="secondary" onClick={() => revokeDevice(d.id)}>
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
