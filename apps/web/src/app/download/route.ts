import { NextResponse } from "next/server";

/**
 * Stable, version-agnostic download link. Redirects to the latest GitHub
 * Release asset so `/download` never changes across versions — bump the
 * release and this keeps pointing at the newest installer.
 */
const LATEST_INSTALLER =
  "https://github.com/sha-shanks300/SanGit/releases/latest/download/SanGitSetup.exe";

export function GET() {
  return NextResponse.redirect(LATEST_INSTALLER, { status: 302 });
}
