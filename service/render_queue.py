"""Render worker: when FL Studio is closed (or on demand), renders each
queued snapshot to mp3 via FL's command-line renderer and uploads it.

FL's renderer is not headless — `FL64.exe /R /Emp3 project.flp` opens the
GUI, renders next to the .flp, and exits. That's why jobs wait for the
user's FL session to end before running.
"""

import logging
import subprocess
import threading
import time
from pathlib import Path

import psutil

import store
from api_client import ApiClient, ApiError

log = logging.getLogger("sangit.render")


def fl_running(process_names: list[str]) -> bool:
    wanted = {n.lower() for n in process_names}
    for proc in psutil.process_iter(["name"]):
        try:
            if (proc.info["name"] or "").lower() in wanted:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return False


def mp3_duration(path: Path) -> float | None:
    try:
        from mutagen.mp3 import MP3
        return float(MP3(str(path)).info.length)
    except Exception:
        return None


class RenderWorker:
    def __init__(self, client: ApiClient, cfg: dict, poll_secs: float = 10.0):
        self._client = client
        self._cfg = cfg
        self._poll = poll_secs
        self._stop = threading.Event()
        self._force = threading.Event()  # tray "Render now" sets this
        self._thread = threading.Thread(target=self._run, daemon=True)
        self.current: str | None = None  # for tray status

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()

    def render_now(self):
        self._force.set()

    def _run(self):
        while not self._stop.wait(self._poll):
            row = store.next_pending_render()
            if row is None:
                self._force.clear()
                continue
            if fl_running(self._cfg["fl_process_names"]) and not self._force.is_set():
                continue  # wait for the FL session to end
            self._process(row)

    def _process(self, row):
        version_id = row["version_id"]
        snapshot = Path(row["snapshot_path"])
        self.current = snapshot.name
        try:
            if not snapshot.exists():
                self._fail(row, "snapshot missing")
                return

            fl_exe = self._cfg["fl_executable"]
            if not Path(fl_exe).exists():
                # Config problem, not a job problem — retry later, don't burn attempts.
                log.error("FL executable not found: %s", fl_exe)
                time.sleep(60)
                return

            store.render_status(row["id"], "rendering")
            mp3_path = snapshot.with_suffix(".mp3")
            log.info("rendering %s", snapshot.name)
            try:
                subprocess.run(
                    [fl_exe, "/R", "/Emp3", str(snapshot)],
                    timeout=self._cfg["render_timeout_secs"],
                    check=False,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
            except subprocess.TimeoutExpired:
                self._retry(row, "render timed out")
                return

            if not mp3_path.exists():
                self._retry(row, "renderer produced no mp3 (missing plugins or crash?)")
                return

            init = self._client.audio_init(version_id)
            self._client.upload_file(init["upload_url"], str(mp3_path), "audio/mpeg")
            self._client.audio_complete(version_id, mp3_duration(mp3_path))
            store.render_status(row["id"], "done")
            log.info("render uploaded for version %s", version_id)
            snapshot.unlink(missing_ok=True)
            mp3_path.unlink(missing_ok=True)
        except ApiError as e:
            log.warning("render upload for %s failed: %s", version_id, e)
            self._retry(row, str(e), report=e.retryable is False)
        except Exception as e:
            log.exception("render for %s unexpected error", version_id)
            self._retry(row, str(e))
        finally:
            self.current = None

    def _retry(self, row, error: str, report: bool = True):
        failed = store.render_retry(row["id"], error)
        if failed and report:
            try:
                self._client.audio_failed(row["version_id"], error)
            except ApiError:
                log.warning("could not report render failure for %s", row["version_id"])

    def _fail(self, row, error: str):
        store.render_status(row["id"], "failed", error)
        try:
            self._client.audio_failed(row["version_id"], error)
        except ApiError:
            pass
