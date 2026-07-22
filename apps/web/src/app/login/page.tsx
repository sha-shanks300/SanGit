"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-card-title font-medium text-ink">Sign in</h1>
      <p className="mt-1 text-body-sm text-ink-subtle">
        Your studio, your versions.
      </p>

      <Button className="mt-6 w-full" variant="secondary" onClick={signInWithGoogle}>
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-caption text-ink-tertiary">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {status === "sent" ? (
        <div>
          <p className="text-body-sm text-success">
            Check your email for a sign-in link.
          </p>
          <p className="mt-1 text-caption text-ink-tertiary">
            Not seeing it? Check your spam folder.
          </p>
        </div>
      ) : (
        <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Email me a link"}
          </Button>
        </form>
      )}

      {error && <p className="mt-3 text-caption text-ink-muted">{error}</p>}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
