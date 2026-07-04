"""Folder watcher: watchdog events on *.flp, debounced into single save
events; FL autosaves and backup folders are ignored."""

import logging
import threading
import time
from pathlib import Path
from typing import Callable

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

log = logging.getLogger("sangit.watcher")

IGNORED_DIR_NAMES = {"backup", "backups", "autosave"}
IGNORED_NAME_HINTS = ("autosave", "(autosaved)", "overwritten")


def _is_ignored(path: Path) -> bool:
    if path.suffix.lower() != ".flp":
        return True
    lowered = path.name.lower()
    if any(hint in lowered for hint in IGNORED_NAME_HINTS):
        return True
    return any(part.lower() in IGNORED_DIR_NAMES for part in path.parent.parts)


class _DebouncedHandler(FileSystemEventHandler):
    """Coalesces the burst of events FL emits per save (temp write + rename)
    into one callback fired `debounce_secs` after the last event."""

    def __init__(self, on_save: Callable[[str], None], debounce_secs: float):
        self.on_save = on_save
        self.debounce_secs = debounce_secs
        self._timers: dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    def _schedule(self, path_str: str):
        path = Path(path_str)
        if _is_ignored(path):
            return
        with self._lock:
            timer = self._timers.pop(path_str, None)
            if timer:
                timer.cancel()
            t = threading.Timer(self.debounce_secs, self._fire, args=(path_str,))
            t.daemon = True
            self._timers[path_str] = t
            t.start()

    def _fire(self, path_str: str):
        with self._lock:
            self._timers.pop(path_str, None)
        if Path(path_str).exists():
            log.info("save detected: %s", path_str)
            self.on_save(path_str)

    def on_created(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)

    def on_moved(self, event):
        # FL saves via temp file + rename; the destination is the real .flp.
        if not event.is_directory:
            self._schedule(event.dest_path)


class FolderWatcher:
    def __init__(self, folders: list[str], on_save: Callable[[str], None],
                 debounce_secs: float = 2.5):
        self._handler = _DebouncedHandler(on_save, debounce_secs)
        self._observer = Observer()
        self._folders = folders
        self.paused = False
        self._last_popup_at: dict[str, float] = {}

    def start(self):
        scheduled = 0
        for folder in self._folders:
            p = Path(folder)
            if p.is_dir():
                self._observer.schedule(self._handler, str(p), recursive=True)
                scheduled += 1
            else:
                log.warning("watch folder missing: %s", folder)
        self._observer.start()
        log.info("watching %d folder(s)", scheduled)

    def stop(self):
        self._observer.stop()
        self._observer.join(timeout=5)
