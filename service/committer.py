"""Commit pipeline: snapshot the saved .flp, resolve project identity from
the folder's .sangit.json marker, hash, and enqueue for upload."""

import hashlib
import json
import logging
import shutil
import uuid
from pathlib import Path

import store
from config import MARKER_FILENAME, STAGING_DIR

log = logging.getLogger("sangit.committer")


def _project_identity(folder: Path) -> tuple[str, str]:
    """Read or create the .sangit.json marker. Returns (project_id, title)."""
    marker = folder / MARKER_FILENAME
    if marker.exists():
        try:
            data = json.loads(marker.read_text(encoding="utf-8"))
            if data.get("project_id"):
                return data["project_id"], data.get("title") or folder.name
        except (json.JSONDecodeError, OSError):
            log.warning("unreadable %s, recreating", marker)
    project_id = str(uuid.uuid4())
    marker.write_text(
        json.dumps({"project_id": project_id, "title": folder.name}, indent=2),
        encoding="utf-8",
    )
    return project_id, folder.name


def read_project_id(flp_path: str) -> str | None:
    """Read the project UUID from the folder's marker without creating one —
    used to fetch a project's branches for the commit popup's dropdown."""
    marker = Path(flp_path).parent / MARKER_FILENAME
    if not marker.exists():
        return None
    try:
        return json.loads(marker.read_text(encoding="utf-8")).get("project_id")
    except (json.JSONDecodeError, OSError):
        return None


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def commit(flp_path: str, display_name: str | None,
           new_branch_name: str | None = None,
           target_branch_id: str | None = None) -> int | None:
    """Snapshot + enqueue. Returns the commit queue id, or None on failure.
    `new_branch_name` => "Commit to branch": create it (fork) or append if it
    already exists (server decides). `target_branch_id` => commit onto a
    specific existing branch picked from the dropdown. Neither => the file's
    current home branch."""
    src = Path(flp_path)
    if not src.exists():
        log.error("commit requested but file vanished: %s", src)
        return None

    project_id, title = _project_identity(src.parent)

    # Snapshot first so continued edits in FL can't drift this version.
    snapshot = STAGING_DIR / f"{uuid.uuid4().hex}_{src.name}"
    try:
        shutil.copy2(src, snapshot)
    except OSError as e:
        log.error("snapshot failed: %s", e)
        return None

    digest = sha256_of(snapshot)
    commit_id = store.add_commit(
        snapshot_path=str(snapshot),
        file_name=src.name,
        project_id=project_id,
        project_title=title,
        display_name=display_name or None,
        sha256=digest,
        flp_path=str(src),
        # a picked existing branch overrides the file's home; else the home is
        # both the commit target and the base for a new fork.
        branch_id=(target_branch_id or store.file_branch_get(str(src))),
        new_branch_name=(new_branch_name or None),
    )
    # Remember this content as committed for this path so a later FL-close
    # won't prompt again unless the file actually changes.
    store.record_committed(str(src), digest)
    log.info("queued commit #%s %s (%s)%s", commit_id, src.name, digest[:12],
             f" -> new branch '{new_branch_name}'" if new_branch_name else "")
    return commit_id
