"""Config + paths for the SanGit local service (%APPDATA%/SanGit)."""

import json
import os
from pathlib import Path

APP_NAME = "SanGit"
MARKER_FILENAME = ".sangit.json"

CONFIG_DIR = Path(os.environ.get("APPDATA", Path.home())) / APP_NAME
CONFIG_PATH = CONFIG_DIR / "config.json"
STAGING_DIR = CONFIG_DIR / "staging"
DB_PATH = CONFIG_DIR / "queue.db"
LOG_PATH = CONFIG_DIR / "service.log"

DEFAULTS = {
    "api_url": "",
    "device_token": "",
    "username": "",  # owner's web handle, refreshed from pair/ping responses
    "device_name": os.environ.get("COMPUTERNAME", "Studio PC"),
    "watch_folders": [],
    "fl_executable": r"C:\Program Files\Image-Line\FL Studio 21\FL64.exe",
    "fl_process_names": ["FL64.exe", "FL.exe", "FL Studio.exe"],
    "popup_timeout_secs": 30,
    "debounce_secs": 2.5,
    "render_timeout_secs": 1800,
}


def load() -> dict:
    cfg = dict(DEFAULTS)
    if CONFIG_PATH.exists():
        try:
            cfg.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            pass
    return cfg


def save(cfg: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def ensure_dirs() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    STAGING_DIR.mkdir(parents=True, exist_ok=True)


def is_paired(cfg: dict) -> bool:
    return bool(cfg.get("api_url") and cfg.get("device_token"))
