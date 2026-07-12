import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveShareLink, versionInScope } from "@/lib/share-token";
import { isUuid } from "@/lib/ingest-auth";

/**
 * Post a comment on a version reached through a share link. Requires a
 * signed-in session (comment is attributed to the real user); the token
 * authorizes access to the (possibly private) project.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in to comment" }, { status: 401 });
  }

  let body: { version_id?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const text = body.body?.trim() ?? "";
  if (!isUuid(body.version_id) || text.length < 1 || text.length > 2000) {
    return NextResponse.json(
      { error: "version_id and a 1–2000 char body required" },
      { status: 400 }
    );
  }

  const resolved = await resolveShareLink(token);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link, admin } = resolved;

  if (!(await versionInScope(admin, link, body.version_id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("comments")
    .insert({ version_id: body.version_id, user_id: user.id, body: text });
  if (error) {
    return NextResponse.json({ error: "failed to comment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
