import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveShareLink, versionInScope } from "@/lib/share-token";
import { isUuid } from "@/lib/ingest-auth";
import type { Comment } from "@/lib/database.types";

type CommentWithAuthor = Comment & {
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

/**
 * Reactions + comments for a version reached through a share link. Reads go
 * through the admin client (the token grants read access even on private
 * projects); the viewer identity comes from the cookie session, if any.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; versionId: string }> }
) {
  const { token, versionId } = await params;
  if (!isUuid(versionId)) {
    return NextResponse.json({ error: "invalid version" }, { status: 400 });
  }

  const resolved = await resolveShareLink(token);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link, admin } = resolved;

  if (!(await versionInScope(admin, link, versionId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  const [{ data: reactions }, { data: comments }] = await Promise.all([
    admin.from("reactions").select("user_id, kind").eq("version_id", versionId),
    admin
      .from("comments")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("version_id", versionId)
      .order("created_at", { ascending: false })
      .returns<CommentWithAuthor[]>(),
  ]);

  const likes = (reactions ?? []).filter((r) => r.kind === "like");
  return NextResponse.json({
    viewerId: user?.id ?? null,
    likes: likes.length,
    mine: user != null && likes.some((r) => r.user_id === user.id),
    comments: comments ?? [],
  });
}
