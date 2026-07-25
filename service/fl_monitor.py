"""FL session monitor: polls whether FL Studio is running and fires a
callback the moment it goes from running -> closed. That transition is the
"the user is done — commit this session" signal for the commit-on-close flow.

Render-aware: while SanGit itself relaunches FL to export an mp3, FL is
"running" again and will close again when the render finishes. The App pauses
the monitor around renders (pause() on render start, resume() shortly after
render end); resume() re-baselines to the current FL state so that render's
own close is never mistaken for a user close.
"""

import logging
import threading

from render_queue import fl_running

log = logging.getLogger("sangit.fl_monitor")


class FLMonitor:
    def __init__(self, process_names: list[str], on_fl_closed, poll_secs: float = 2.0):
        self._names = process_names
        self._on_closed = on_fl_closed
        self._poll = poll_secs
        self._stop = threading.Event()
        self._paused = threading.Event()
        self._was_running = False
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self._was_running = fl_running(self._names)  # baseline: don't fire on startup
        self._thread.start()

    def stop(self):
        self._stop.set()

    def pause(self):
        """Ignore FL activity (used while our own render has FL open)."""
        self._paused.set()

    def resume(self):
        """Resume, re-baselining to the current FL state so a close that
        happened while paused (the render's FL) isn't seen as a transition."""
        self._was_running = fl_running(self._names)
        self._paused.clear()

    def _run(self):
        while not self._stop.wait(self._poll):
            if self._paused.is_set():
                continue
            running = fl_running(self._names)
            if self._was_running and not running:
                log.info("FL closed — session ended")
                try:
                    self._on_closed()
                except Exception:
                    log.exception("on_fl_closed callback failed")
            self._was_running = running
