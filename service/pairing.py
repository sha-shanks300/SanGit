"""First-run setup dialog: API URL, pairing code, watch folder, FL path.
Styled after apps/web/DESIGN.md — canvas bg, hairline-bordered inputs,
Rosso Corsa primary CTA, inline validation (no native message boxes).

Qt dialog on the main thread; the pairing network call runs on a worker
thread so the window never freezes while talking to the server.
"""

import logging
import threading

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (QDialog, QFileDialog, QHBoxLayout, QLabel,
                               QLineEdit, QPushButton, QVBoxLayout)

import config
import theme
from api_client import ApiClient, ApiError

log = logging.getLogger("sangit.pairing")

PAD = 24  # panel interior padding (sm token)


def _normalize_url(url: str) -> str:
    """Local dev servers are plain HTTP — a https://localhost URL fails with
    SSL WRONG_VERSION_NUMBER, so quietly fix that footgun."""
    url = url.strip().rstrip("/")
    for host in ("localhost", "127.0.0.1"):
        if url.startswith(f"https://{host}"):
            url = "http://" + url[len("https://"):]
    return url


class SettingsDialog(QDialog):
    # (result dict | None, error message) from the pairing worker thread
    _pair_finished = Signal(object, str)

    def __init__(self, cfg: dict):
        super().__init__()
        self.cfg = cfg
        self.saved = False
        self.already_paired = bool(cfg.get("device_token"))

        self.setWindowTitle("SanGit — Settings" if self.already_paired
                            else "SanGit — Pair device")
        self.setFixedWidth(480)
        theme.dark_titlebar(self)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(PAD, PAD - 2, PAD, PAD)
        lay.setSpacing(0)

        lay.addWidget(theme.eyebrow_row("SanGit — device", self))
        lay.addSpacing(8)
        headline = QLabel("Settings" if self.already_paired
                          else "Pair this computer", self)
        headline.setObjectName("headline")
        headline.setFont(theme.font("display", 15))
        lay.addWidget(headline)
        lay.addSpacing(2)
        sub = QLabel("Generate a code on the web app under Settings → Devices.",
                     self)
        sub.setObjectName("sub")
        sub.setFont(theme.font("body", 9))
        lay.addWidget(sub)
        lay.addSpacing(12)
        rule = QLabel(self)
        rule.setFixedHeight(1)
        rule.setStyleSheet(f"background: {theme.HAIRLINE};")
        lay.addWidget(rule)

        def field(label: str, initial: str = "") -> QLineEdit:
            lay.addSpacing(14)
            lay.addWidget(theme.field_label(label, self))
            lay.addSpacing(3)
            edit = QLineEdit(initial, self)
            edit.setFont(theme.font("body", 10))
            lay.addWidget(edit)
            return edit

        self.api_entry = field("Web app URL", cfg.get("api_url") or "https://")
        self.code_entry = field(
            "Pairing code — blank keeps current pairing"
            if self.already_paired else "Pairing code (e.g. 7KFM-2XQ9)")

        lay.addSpacing(14)
        lay.addWidget(theme.field_label("FL Studio projects folder to watch",
                                        self))
        lay.addSpacing(3)
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        self.folder_entry = QLineEdit((cfg.get("watch_folders") or [""])[0],
                                      self)
        self.folder_entry.setFont(theme.font("body", 10))
        browse = QPushButton("Browse…", self)
        browse.setObjectName("outline")
        browse.setFont(theme.font("body", 10))
        browse.setCursor(Qt.CursorShape.PointingHandCursor)
        browse.clicked.connect(self._browse)
        row.addWidget(self.folder_entry, 1)
        row.addSpacing(8)
        row.addWidget(browse)
        lay.addLayout(row)

        self.fl_entry = field("FL Studio executable",
                              cfg.get("fl_executable", ""))

        lay.addSpacing(10)
        self.error_lbl = QLabel("", self)
        self.error_lbl.setObjectName("error")
        self.error_lbl.setFont(theme.font("body", 9))
        self.error_lbl.setWordWrap(True)
        lay.addWidget(self.error_lbl)

        lay.addSpacing(10)
        btns = QHBoxLayout()
        btns.setContentsMargins(0, 0, 0, 0)
        btns.addStretch(1)
        cancel = QPushButton("Cancel", self)
        cancel.setObjectName("ghost")
        cancel.setFont(theme.font("body", 10))
        cancel.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel.clicked.connect(self.reject)
        self.save_btn = QPushButton(
            "Save" if self.already_paired else "Pair device", self)
        self.save_btn.setObjectName("primary")
        self.save_btn.setFont(theme.font("body", 10))
        self.save_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.save_btn.setDefault(True)
        self.save_btn.clicked.connect(self._submit)
        btns.addWidget(cancel)
        btns.addSpacing(8)
        btns.addWidget(self.save_btn)
        lay.addLayout(btns)

        self._pair_finished.connect(self._on_pair_finished)

    def _browse(self):
        folder = QFileDialog.getExistingDirectory(
            self, "Choose the FL Studio projects folder",
            self.folder_entry.text() or "")
        if folder:
            self.folder_entry.setText(folder)

    def _submit(self):
        self.error_lbl.setText("")
        api_url = _normalize_url(self.api_entry.text())
        code = self.code_entry.text().strip()
        folder = self.folder_entry.text().strip()
        keep_pairing = self.already_paired and not code
        if not api_url or not folder or (not code and not keep_pairing):
            self.error_lbl.setText(
                "URL, pairing code and folder are required.")
            return
        if keep_pairing and api_url != self.cfg.get("api_url"):
            self.error_lbl.setText(
                "The web app URL changed — the old pairing won't work "
                "there. Enter a new pairing code from that server.")
            return

        if keep_pairing:
            self._save(api_url, folder)
            return

        # network call off the UI thread; button shows a busy state
        self.save_btn.setEnabled(False)
        self.save_btn.setText("Pairing…")

        def pair():
            try:
                client = ApiClient(api_url)
                result = client.pair(code,
                                     self.cfg.get("device_name", "Studio PC"))
                self._pair_finished.emit(result, "")
            except ApiError as e:
                self._pair_finished.emit(None, str(e))

        self._pending_url, self._pending_folder = api_url, folder
        threading.Thread(target=pair, daemon=True).start()

    def _on_pair_finished(self, result, error: str):
        self.save_btn.setEnabled(True)
        self.save_btn.setText("Save" if self.already_paired else "Pair device")
        if result is None:
            self.error_lbl.setText(f"Pairing failed: {error}")
            return
        self.cfg["device_token"] = result["device_token"]
        self._save(self._pending_url, self._pending_folder)

    def _save(self, api_url: str, folder: str):
        self.cfg["api_url"] = api_url
        self.cfg["watch_folders"] = [folder]
        self.cfg["fl_executable"] = (self.fl_entry.text().strip()
                                     or self.cfg["fl_executable"])
        config.save(self.cfg)
        self.saved = True
        self.accept()


def run_setup(cfg: dict) -> bool:
    """Shows the setup/settings window; returns True when saved.

    When the device is already paired, the code field may be left blank to
    keep the existing pairing and only change the folder/paths. Requires a
    QApplication to exist.
    """
    dialog = SettingsDialog(cfg)
    dialog.exec()
    if not dialog.saved:
        log.info("settings window dismissed")
    return dialog.saved
