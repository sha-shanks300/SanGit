"""Upload worker: drains the commit queue (init-upload -> PUT .flp ->
complete), then hands the version to the render queue. Offline-safe via
SQLite-backed retry with backoff."""

import logging
import threading
import time
from pathlib import Path

import store
from api_client import ApiClient, ApiError

log = logging.getLogger("sangit.uploader")


class UploadWorker:
    def __init__(self, client: ApiClient, poll_secs: float = 3.0):
        self._client = client
        self._poll = poll_secs
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()

    def _run(self):
        while not self._stop.wait(self._poll):
            row = store.next_pending_commit()
            if row is None:
                continue
            try:
                self._process(row)
            except ApiError as e:
                if e.retryable:
                    log.warning("commit #%s retrying: %s", row["id"], e)
                    store.commit_retry(row["id"], str(e))
                else:
                    log.error("commit #%s rejected: %s", row["id"], e)
                    store.commit_retry(row["id"], str(e), max_attempts=1)
            except Exception as e:
                log.exception("commit #%s unexpected error", row["id"])
                store.commit_retry(row["id"], str(e))

    def _process(self, row):
        snapshot = Path(row["snapshot_path"])
        if not snapshot.exists():
            store.commit_retry(row["id"], "snapshot missing", max_attempts=1)
            return

        init = self._client.init_upload(
            project_id=row["project_id"],
            project_title=row["project_title"],
            file_name=row["file_name"],
            sha256=row["sha256"],
            size=snapshot.stat().st_size,
        )

        if init.get("duplicate"):
            log.info("commit #%s deduplicated (no change since tip)", row["id"])
            store.commit_done(row["id"], init.get("version_id"), duplicate=True)
            snapshot.unlink(missing_ok=True)
            return

        self._client.upload_file(init["upload_url"], str(snapshot),
                                 "application/octet-stream")
        self._client.complete(
            version_id=init["version_id"],
            project_id=row["project_id"],
            branch_id=init["branch_id"],
            file_name=row["file_name"],
            sha256=row["sha256"],
            storage_path=init["storage_path"],
            display_name=row["display_name"],
        )
        store.commit_done(row["id"], init["version_id"], duplicate=False)
        store.add_render(init["version_id"], str(snapshot))
        log.info("commit #%s uploaded as version %s; render queued",
                 row["id"], init["version_id"])
