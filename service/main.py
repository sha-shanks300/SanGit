"""SanGit local service — tray entrypoint (PySide6).

Wires together: folder watcher (save detection) -> commit toast -> snapshot/
upload pipeline -> render queue. Run with `python main.py`.

One Qt event loop on the main thread owns all UI (tray icon, menu, toasts,
settings dialog). Worker threads (watchdog, uploader, renderer) talk to the
UI only through Qt signals, which are thread-safe by design.
"""

import ctypes
import ctypes.wintypes
import logging
import sys
import threading
import time
import webbrowser

from PySide6.QtCore import QMetaObject, Qt, QTimer, Signal, QObject
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QApplication, QMenu, QSystemTrayIcon

import committer
import config
import pairing
import store
import theme
import updater
import version
from api_client import ApiClient, ApiError
from popup import PopupManager
from render_queue import RenderWorker
from status_window import StatusWindow
from uploader import UploadWorker
from watcher import FolderWatcher

log = logging.getLogger("sangit")

HEARTBEAT_SECS = 300  # idle revocation check cadence (5 min)


def _setup_logging():
    config.ensure_dirs()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(config.LOG_PATH, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def _already_running() -> bool:
    """Single-instance guard via a named mutex. A second copy means two
    tray icons, two commit popups per save and double uploads — refuse."""
    ctypes.windll.kernel32.CreateMutexW(None, False, "SanGit.Service.Mutex")
    return ctypes.windll.kernel32.GetLastError() == 183  # ERROR_ALREADY_EXISTS


def _set_app_identity():
    """Give the process its own taskbar identity so windows show the
    SanGit mark instead of grouping under python.exe's icon."""
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "SanGit.Service")
    except Exception:
        pass


class App(QObject):
    # emitted from worker threads; slots run on the Qt main thread
    save_detected = Signal(str)
    auth_error = Signal()
    heartbeat_ok = Signal(object)  # carries the username from a good ping
    update_available = Signal(str)  # carries the newer version string

    def __init__(self, cfg: dict, qapp: QApplication):
        super().__init__()
        self.cfg = cfg
        self.qapp = qapp
        self.client = ApiClient(cfg["api_url"], cfg["device_token"])
        self.uploader = UploadWorker(self.client, on_auth_error=self._on_auth_error)
        self.renderer = RenderWorker(self.client, cfg, on_auth_error=self._on_auth_error)
        self.popups = PopupManager(self._do_commit,
                                   timeout_secs=cfg["popup_timeout_secs"])
        self.watcher = FolderWatcher(cfg["watch_folders"], self._on_save,
                                     debounce_secs=cfg["debounce_secs"])
        self.watching = True
        self.tray: QSystemTrayIcon | None = None
        self.status_window: StatusWindow | None = None
        self._watch_action: QAction | None = None
        self._auth_alerted = False
        self._revoked = False
        self._update_version = ""
        self._last_update_check = 0.0

        self.save_detected.connect(self.popups.ask)
        self.auth_error.connect(self._handle_auth_error)
        self.heartbeat_ok.connect(self._on_heartbeat_ok)
        self.update_available.connect(self._handle_update_available)

    # watcher thread -> Qt main thread via signal
    def _on_save(self, flp_path: str):
        if self.watching:
            self.save_detected.emit(flp_path)

    # toast (main thread) hands off to a worker thread inside PopupManager
    def _do_commit(self, flp_path: str, display_name: str | None):
        committer.commit(flp_path, display_name)

    # ---- reconfiguration ----
    def _apply_config(self, cfg: dict):
        """Hot-apply new settings: swap token/URL and restart the watcher."""
        self.cfg = cfg
        self.client.api_url = cfg["api_url"].rstrip("/")
        self.client.device_token = cfg["device_token"]
        was_started = self.watcher.started
        self.watcher.stop()
        self.watcher = FolderWatcher(cfg["watch_folders"], self._on_save,
                                     debounce_secs=cfg["debounce_secs"])
        if was_started:
            self.watcher.start()  # otherwise run() starts it
        store.requeue_errored_commits()
        self._auth_alerted = False
        self._revoked = False  # reconnected — leave the revoked state
        self._update_tray_icon()
        if self.status_window:  # refresh the open window in place (folders may
            self.status_window.update_config(cfg)  # have changed) — don't destroy
            self.status_window.set_revoked(False)
        log.info("settings applied; watching %s", cfg["watch_folders"])

    def _on_settings_saved(self):
        """The in-window settings form saved: reload from disk and hot-apply."""
        self._apply_config(config.load())

    # ---- watch toggle (single source of truth) ----
    def set_watching(self, on: bool):
        """Flip the soft-pause flag and mirror it everywhere: tray menu
        checkbox, status window toggle, tray icon (dimmed while paused).
        Always resets to ON at launch — a forgotten pause must not silently
        eat saves."""
        if self.watching == on:
            return
        self.watching = on
        if self._watch_action and self._watch_action.isChecked() != on:
            self._watch_action.blockSignals(True)
            self._watch_action.setChecked(on)
            self._watch_action.blockSignals(False)
        if self.status_window:
            self.status_window.sync_state(on)
        self._update_tray_icon()
        log.info("watching %s", "resumed" if on else "paused")

    def open_status(self):
        """Left-click on the tray icon (or 'Open SanGit') — the status
        window with the watch toggle."""
        if self.status_window is None:
            self.status_window = StatusWindow(
                is_watching=lambda: self.watching,
                set_watching=self.set_watching,
                status_text=self._status_text,
                get_config=lambda: self.cfg,
                is_revoked=lambda: self._revoked,
                get_update_version=lambda: self._update_version,
                on_settings_saved=self._on_settings_saved)
        self.status_window.show()
        self.status_window.raise_()
        self.status_window.activateWindow()

    # worker/heartbeat thread -> signal -> main thread
    def _on_auth_error(self):
        if self._auth_alerted:
            return
        self._auth_alerted = True
        self.auth_error.emit()

    def _handle_auth_error(self):
        """Token rejected (a worker or the heartbeat got a 401): the device was
        revoked on the web app. Surface it softly — notify, dim the tray icon,
        and show a reconnect banner in the status window — without forcing a
        modal. The watcher keeps running; uploads park and flush on reconnect."""
        log.error("device token rejected — revoked on the web app; reconnect needed")
        self._revoked = True
        self._update_tray_icon()
        if self.tray:
            self.tray.showMessage(
                "SanGit — device revoked",
                "This PC was disconnected on the web app. Open SanGit to reconnect.",
                QSystemTrayIcon.MessageIcon.Warning)
        if self.status_window:
            self.status_window.set_revoked(True)

    def _update_tray_icon(self):
        """Reconcile the tray icon/tooltip: revoked (needs reconnect) takes
        precedence over paused, which takes precedence over the normal mark."""
        if not self.tray:
            return
        if self._revoked:
            self.tray.setIcon(theme.app_icon_dimmed())
            self.tray.setToolTip("SanGit — device revoked")
        elif not self.watching:
            self.tray.setIcon(theme.app_icon_dimmed())
            self.tray.setToolTip("SanGit — paused")
        else:
            self.tray.setIcon(theme.app_icon())
            self.tray.setToolTip("SanGit")

    # ---- heartbeat: catch revocation while idle ----
    def _heartbeat_tick(self):
        """Timer fires on the main thread; do the network calls off-thread so
        the UI never blocks."""
        self._maybe_check_update()  # daily, independent of pairing/revocation
        if self._revoked or not config.is_paired(self.cfg):
            return  # already known-revoked, or nothing to check
        threading.Thread(target=self._heartbeat_probe, daemon=True).start()

    def _heartbeat_probe(self):
        try:
            resp = self.client.ping()
        except ApiError as e:
            if e.status == 401:
                self._on_auth_error()  # thread-safe: emits a queued signal
            else:
                log.debug("heartbeat inconclusive (%s) — assuming offline", e)
            return
        self.heartbeat_ok.emit(resp.get("username"))

    def _on_heartbeat_ok(self, username):
        # Valid token: keep the cached handle (and "Connected as") fresh.
        self._sync_username(username)

    # ---- update check (GitHub Releases; free, no auth) ----
    def _maybe_check_update(self, force: bool = False):
        """Kick off an update check on startup and roughly daily thereafter.
        Independent of pairing — updates aren't auth-gated."""
        if not force and time.time() - self._last_update_check < 86400:
            return
        self._last_update_check = time.time()
        threading.Thread(target=self._update_check_probe, daemon=True).start()

    def _update_check_probe(self):
        newer = updater.check_for_update(version.__version__)
        if newer:
            self.update_available.emit(newer)

    def _handle_update_available(self, new_version: str):
        self._update_version = new_version
        # Toast once per version, even across restarts, so we never nag.
        if self.cfg.get("last_notified_update") != new_version:
            self.cfg["last_notified_update"] = new_version
            cfg = config.load()
            cfg["last_notified_update"] = new_version
            config.save(cfg)
            if self.tray:
                self.tray.showMessage(
                    "SanGit update available",
                    f"Version {new_version} is ready. Open SanGit to update.",
                    QSystemTrayIcon.MessageIcon.Information)
        if self.status_window:
            self.status_window.set_update_available(new_version)

    def validate_token(self) -> bool:
        """Startup check; returns False only when the server says 401.
        Also refreshes the cached username from the ping response."""
        try:
            resp = self.client.ping()
            self._sync_username(resp.get("username"))
            return True
        except ApiError as e:
            if e.status == 401:
                return False
            log.warning("token check inconclusive (%s) — continuing offline", e)
            return True

    def _sync_username(self, username: str | None):
        """Persist the owner's handle when the server reports a new value —
        so a rename on the web app self-heals on the next launch. `ping`
        is authoritative, so an unset handle (null) clears the cache too."""
        new = username or ""
        if new == self.cfg.get("username", ""):
            return
        self.cfg["username"] = new
        cfg = config.load()
        cfg["username"] = new
        config.save(cfg)
        log.info("username refreshed to %s", f"@{new}" if new else "(unset)")

    # ---- tray ----
    def _status_text(self) -> str:
        c = store.counts()
        pending_up = c.get("commits", {}).get("pending", 0)
        pending_rn = c.get("renders", {}).get("pending", 0)
        current = self.renderer.current
        if current:
            return f"Rendering {current}…"
        return f"{pending_up} upload(s), {pending_rn} render(s) queued"

    def _build_tray(self):
        menu = QMenu()
        menu.setFont(theme.font("body", 9))

        menu.addAction("Open SanGit", self.open_status)
        menu.addSeparator()

        self._status_action = QAction("", menu)
        self._status_action.setEnabled(False)
        menu.addAction(self._status_action)
        menu.aboutToShow.connect(
            lambda: self._status_action.setText(self._status_text()))
        menu.addSeparator()

        watch = QAction("Watching for saves", menu)
        watch.setCheckable(True)
        watch.setChecked(True)
        watch.toggled.connect(self.set_watching)
        menu.addAction(watch)
        self._watch_action = watch

        menu.addAction("Render queue now",
                       lambda: self.renderer.render_now())
        menu.addAction("Open dashboard",
                       lambda: webbrowser.open(f"{self.cfg['api_url']}/dashboard"))
        menu.addSeparator()
        menu.addAction("Quit SanGit", self.qapp.quit)

        self.tray = QSystemTrayIcon(theme.app_icon())
        self.tray.setToolTip("SanGit")
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self._menu = menu  # keep alive
        self.tray.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.Trigger:  # left-click
            self.open_status()

    def _install_ctrl_handler(self):
        """Make Ctrl+C (and closing the terminal) stop the service: a
        native console handler runs on its own thread and queues a quit
        into the Qt loop."""
        if sys.platform != "win32":
            return
        routine = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL,
                                     ctypes.wintypes.DWORD)

        def handler(event):
            if event in (0, 1, 2):  # CTRL_C, CTRL_BREAK, CTRL_CLOSE
                log.info("console interrupt — shutting down")
                QMetaObject.invokeMethod(self.qapp, "quit",
                                         Qt.ConnectionType.QueuedConnection)
                return True
            return False

        self._ctrl_handler = routine(handler)  # keep a ref: GC would unhook it
        ctypes.windll.kernel32.SetConsoleCtrlHandler(self._ctrl_handler, True)

    def run(self):
        self.uploader.start()
        self.renderer.start()
        self.watcher.start()
        self._build_tray()
        self._install_ctrl_handler()
        self._heartbeat = QTimer(self)
        self._heartbeat.setInterval(HEARTBEAT_SECS * 1000)
        self._heartbeat.timeout.connect(self._heartbeat_tick)
        self._heartbeat.start()
        self._maybe_check_update(force=True)  # check once at launch
        log.info("service running; watching %s (Ctrl+C or tray menu to quit)",
                 self.cfg["watch_folders"])
        self.qapp.exec()  # blocks until quit (tray menu or Ctrl+C)
        self.watcher.stop()
        self.uploader.stop()
        self.renderer.stop()
        log.info("service stopped")


def main():
    _set_app_identity()
    _setup_logging()
    log.info("SanGit v%s starting", version.__version__)
    if _already_running():
        log.error("SanGit service is already running (check the tray, next "
                  "to the clock) — not starting a second copy.")
        return
    # Startup-at-login is owned by the Inno Setup installer's checkbox (which
    # writes the HKCU Run entry), so the app no longer self-registers. See
    # install_startup.py for the manual/dev path.
    store.init()

    qapp = QApplication(sys.argv)
    qapp.setQuitOnLastWindowClosed(False)  # tray app: dialogs close, we stay
    qapp.setWindowIcon(theme.app_icon())
    qapp.setStyleSheet(theme.qss())

    cfg = config.load()

    # `python main.py --setup` forces the settings window even when paired
    # (change watch folder, re-pair after revoking, fix the URL, ...).
    force_setup = "--setup" in sys.argv

    if force_setup or not config.is_paired(cfg) or not cfg.get("watch_folders"):
        if not pairing.run_setup(cfg) and not config.is_paired(cfg):
            log.info("setup cancelled")
            return
        cfg = config.load()

    app = App(cfg, qapp)

    # If the device was revoked on the web app while we were offline, ask to
    # re-pair before starting the watchers.
    if not app.validate_token():
        log.warning("device token revoked — opening settings")
        if not pairing.run_setup(config.load()):
            log.info("re-pairing cancelled; uploads will stay queued")
        else:
            app._apply_config(config.load())

    app.run()


if __name__ == "__main__":
    main()
