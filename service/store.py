"""SQLite-backed queues: pending commits (uploads) and pending renders.

Both survive restarts and offline periods; workers poll and retry with
backoff. sqlite3 connections are per-call (check_same_thread-safe by
construction) since traffic is tiny.
"""

import sqlite3
import time
from contextlib import contextmanager

from config import DB_PATH

SCHEMA = """
create table if not exists commits (
  id integer primary key autoincrement,
  snapshot_path text not null,
  file_name text not null,
  project_id text not null,
  project_title text not null,
  display_name text,
  sha256 text not null,
  status text not null default 'pending',  -- pending | done | duplicate | error
  attempts integer not null default 0,
  next_attempt_at real not null default 0,
  version_id text,
  error text,
  created_at real not null
);
create table if not exists renders (
  id integer primary key autoincrement,
  version_id text unique not null,
  snapshot_path text not null,
  status text not null default 'pending',  -- pending | rendering | done | failed
  attempts integer not null default 0,
  next_attempt_at real not null default 0,
  error text,
  created_at real not null
);
"""


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    with _conn() as c:
        c.executescript(SCHEMA)


def add_commit(snapshot_path: str, file_name: str, project_id: str,
               project_title: str, display_name: str | None, sha256: str) -> int:
    with _conn() as c:
        cur = c.execute(
            "insert into commits (snapshot_path, file_name, project_id, project_title,"
            " display_name, sha256, created_at) values (?,?,?,?,?,?,?)",
            (snapshot_path, file_name, project_id, project_title, display_name,
             sha256, time.time()),
        )
        return cur.lastrowid


def next_pending_commit() -> sqlite3.Row | None:
    with _conn() as c:
        return c.execute(
            "select * from commits where status='pending' and next_attempt_at<=?"
            " order by id limit 1", (time.time(),)
        ).fetchone()


def commit_done(commit_id: int, version_id: str | None, duplicate: bool) -> None:
    with _conn() as c:
        c.execute(
            "update commits set status=?, version_id=? where id=?",
            ("duplicate" if duplicate else "done", version_id, commit_id),
        )


def commit_retry(commit_id: int, error: str, max_attempts: int = 50) -> None:
    with _conn() as c:
        row = c.execute("select attempts from commits where id=?", (commit_id,)).fetchone()
        attempts = (row["attempts"] if row else 0) + 1
        if attempts >= max_attempts:
            c.execute("update commits set status='error', error=?, attempts=? where id=?",
                      (error[:500], attempts, commit_id))
        else:
            delay = min(600, 5 * 2 ** min(attempts, 7))
            c.execute(
                "update commits set attempts=?, next_attempt_at=?, error=? where id=?",
                (attempts, time.time() + delay, error[:500], commit_id),
            )


def add_render(version_id: str, snapshot_path: str) -> None:
    with _conn() as c:
        c.execute(
            "insert or ignore into renders (version_id, snapshot_path, created_at)"
            " values (?,?,?)",
            (version_id, snapshot_path, time.time()),
        )


def next_pending_render() -> sqlite3.Row | None:
    with _conn() as c:
        return c.execute(
            "select * from renders where status='pending' and next_attempt_at<=?"
            " order by id limit 1", (time.time(),)
        ).fetchone()


def render_status(render_id: int, status: str, error: str | None = None) -> None:
    with _conn() as c:
        c.execute("update renders set status=?, error=? where id=?",
                  (status, (error or "")[:500] or None, render_id))


def render_retry(render_id: int, error: str, max_attempts: int = 3) -> bool:
    """Returns True if permanently failed."""
    with _conn() as c:
        row = c.execute("select attempts from renders where id=?", (render_id,)).fetchone()
        attempts = (row["attempts"] if row else 0) + 1
        if attempts >= max_attempts:
            c.execute("update renders set status='failed', error=?, attempts=? where id=?",
                      (error[:500], attempts, render_id))
            return True
        c.execute(
            "update renders set status='pending', attempts=?, next_attempt_at=?, error=? where id=?",
            (attempts, time.time() + 60, error[:500], render_id),
        )
        return False


def defer_commit(commit_id: int, delay_secs: float = 60) -> None:
    """Push a commit back without burning a retry attempt (e.g. revoked token)."""
    with _conn() as c:
        c.execute("update commits set next_attempt_at=? where id=?",
                  (time.time() + delay_secs, commit_id))


def defer_render(render_id: int, delay_secs: float = 60) -> None:
    """Requeue a render without burning an attempt (e.g. revoked token)."""
    with _conn() as c:
        c.execute("update renders set status='pending', next_attempt_at=? where id=?",
                  (time.time() + delay_secs, render_id))


def requeue_errored_commits() -> None:
    """After re-pairing, give commits that errored out another life."""
    with _conn() as c:
        c.execute("update commits set status='pending', attempts=0,"
                  " next_attempt_at=0, error=null where status='error'")


def counts() -> dict:
    with _conn() as c:
        out = {}
        for table in ("commits", "renders"):
            rows = c.execute(
                f"select status, count(*) n from {table} group by status"
            ).fetchall()
            out[table] = {r["status"]: r["n"] for r in rows}
        return out
