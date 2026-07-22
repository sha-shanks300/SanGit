"""Checks GitHub Releases for a newer SanGit version.

Free + no auth: the public releases API allows 60 requests/hour per IP, far
more than a startup + daily check needs. Any failure (offline, rate-limited,
no release yet, unparseable tag) returns None so the app never nags.
"""

import logging

import requests

log = logging.getLogger("sangit.updater")

REPO = "sha-shanks300/SanGit"
LATEST_URL = f"https://api.github.com/repos/{REPO}/releases/latest"


def _parse(v: str) -> tuple[int, ...]:
    """'v0.2.1' / '0.2.1-beta' -> (0, 2, 1). Raises on anything unparseable."""
    core = v.strip().lstrip("vV").split("-")[0].split("+")[0]
    return tuple(int(part) for part in core.split("."))


def check_for_update(current: str) -> str | None:
    """Return the latest release version (e.g. '0.2.0') when it is newer than
    `current`, else None. Silent on every error path."""
    try:
        resp = requests.get(
            LATEST_URL,
            headers={"Accept": "application/vnd.github+json",
                     "User-Agent": "SanGit-Service"},
            timeout=10,
        )
        if resp.status_code != 200:
            log.debug("update check: HTTP %s", resp.status_code)
            return None
        tag = resp.json().get("tag_name", "")
        remote, local = _parse(tag), _parse(current)
    except (requests.RequestException, ValueError, KeyError) as e:
        log.debug("update check skipped: %s", e)
        return None
    if remote > local:
        latest = tag.strip().lstrip("vV")
        log.info("update available: %s (current %s)", latest, current)
        return latest
    return None
