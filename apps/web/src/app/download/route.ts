import { NextResponse } from "next/server";

/**
 * Stable, version-agnostic download link. Redirects to the latest GitHub
 * Release asset so `/download` never changes across versions — bump the
 * release and this keeps pointing at the newest SanGit.exe.
 */
const LATEST_EXE =
  "https://github.com/sha-shanks300/SanGit/releases/latest/download/SanGit.exe";

export function GET() {
  return NextResponse.redirect(LATEST_EXE, { status: 302 });
}
