"""SanGit local service — tray entrypoint.

Wires together: folder watcher (save detection) -> commit popup -> snapshot/
upload pipeline -> render queue. Run with `python main.py`.
"""

import logging
import sys
import threading
import webbrowser

import pystray
from PIL import Image, ImageDraw

import committer
import config
import pairing
import store
from api_client import ApiClient, ApiError
from popup import PopupManager
from render_queue import RenderWorker
from uploader import UploadWorker
from watcher import FolderWatcher

log = logging.getLogger("sangit")


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


def _tray_icon_image() -> Image.Image:
    """Three lavender nodes + fork lines on transparent bg."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lavender = (94, 106, 210, 255)
    d.line([(18, 32), (44, 14)], fill=lavender, width=5)
    d.line([(18, 32), (44, 50)], fill=lavender, width=5)
    for cx, cy in ((14, 32), (48, 12), (48, 52)):
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=lavender)
    return img


class App:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.client = ApiClient(cfg["api_url"], cfg["device_token"])
        self.uploader = UploadWorker(self.client, on_auth_error=self._on_auth_error)
        self.renderer = RenderWorker(self.client, cfg, on_auth_error=self._on_auth_error)
        self.popups = PopupManager(self._do_commit,
                                   timeout_secs=cfg["popup_timeout_secs"])
        self.watcher = FolderWatcher(cfg["watch_folders"], self._on_save,
                                     debounce_secs=cfg["debounce_secs"])
        self.watching = True
        self.icon: pystray.Icon | None = None
        self._settings_lock = threading.Lock()
        self._auth_alerted = False

    # watcher thread -> popup queue
    def _on_save(self, flp_path: str):
        if self.watching:
            self.popups.ask(flp_path)

    # popup thread -> commit pipeline
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
        log.info("settings applied; watching %s", cfg["watch_folders"])

    def open_settings(self, icon=None, item=None):
        """Tray 'Settings…' — change folder, URL, FL path, or re-pair."""
        if not self._settings_lock.acquire(blocking=False):
            return  # dialog already open
        try:
            cfg = config.load()
            if pairing.run_setup(cfg):
                self._apply_config(config.load())
        except Exception:
            log.exception("settings dialog failed")
        finally:
            self._settings_lock.release()

    def _on_auth_error(self):
        """Worker got a 401: the device was revoked on the web app."""
        if self._auth_alerted:
            return
        self._auth_alerted = True
        log.error("device token rejected — it was likely revoked; re-pair via Settings")
        if self.icon:
            try:
                self.icon.notify(
                    "This device was revoked. Open Settings to re-pair.", "SanGit")
            except Exception:
                pass
        threading.Thread(target=self.open_settings, daemon=True).start()

    def validate_token(self) -> bool:
        """Startup check; returns False only when the server says 401."""
        try:
            self.client.ping()
            return True
        except ApiError as e:
            if e.status == 401:
                return False
            log.warning("token check inconclusive (%s) — continuing offline", e)
            return True

    # ---- tray menu actions ----
    def _toggle_watch(self, icon, item):
        self.watching = not self.watching

    def _render_now(self, icon, item):
        self.renderer.render_now()

    def _open_dashboard(self, icon, item):
        webbrowser.open(f"{self.cfg['api_url']}/dashboard")

    def _status_text(self, item) -> str:
        c = store.counts()
        pending_up = c.get("commits", {}).get("pending", 0)
        pending_rn = c.get("renders", {}).get("pending", 0)
        current = self.renderer.current
        if current:
            return f"Rendering {current}…"
        return f"{pending_up} upload(s), {pending_rn} render(s) queued"

    def _quit(self, icon, item):
        self.watcher.stop()
        self.uploader.stop()
        self.renderer.stop()
        icon.stop()

    def run(self):
        self.uploader.start()
        self.renderer.start()
        self.watcher.start()

        menu = pystray.Menu(
            pystray.MenuItem(self._status_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Watching for saves",
                self._toggle_watch,
                checked=lambda item: self.watching,
            ),
            pystray.MenuItem("Render queue now", self._render_now),
            pystray.MenuItem("Open dashboard", self._open_dashboard),
            pystray.MenuItem("Settings…", self.open_settings),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit SanGit", self._quit),
        )
        self.icon = pystray.Icon("SanGit", _tray_icon_image(), "SanGit", menu)
        log.info("service running; watching %s", self.cfg["watch_folders"])
        self.icon.run()  # blocks the main thread


def main():
    _setup_logging()
    store.init()
    cfg = config.load()

    # `python main.py --setup` forces the settings window even when paired
    # (change watch folder, re-pair after revoking, fix the URL, ...).
    force_setup = "--setup" in sys.argv

    if force_setup or not config.is_paired(cfg) or not cfg.get("watch_folders"):
        if not pairing.run_setup(cfg) and not config.is_paired(cfg):
            log.info("setup cancelled")
            return
        cfg = config.load()

    app = App(cfg)

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
