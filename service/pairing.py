"""Setup/settings form: API URL, pairing code, watch folder, FL path.
Styled after apps/web/DESIGN.md — canvas bg, hairline-bordered inputs,
Rosso Corsa primary CTA, inline validation (no native message boxes).

`SettingsForm` is a reusable QWidget holding the form + validation + the
threaded network calls; it is embedded two ways:
  - `SettingsDialog` / `run_setup()` — a standalone modal used before the
    tray window exists (first-run pairing, `--setup`, revoked-device re-pair).
  - the tray status window's settings view (cogwheel), which embeds the same
    widget so both surfaces share one form.

Entering a *new* pairing code is a two-step commit: the form first previews
the code (resolving the owner's @username without claiming it), then swaps
its button row inline to "Pair this PC with @username?" so the user confirms
the account before the device is created. Blank code (keep current pairing)
skips the confirm. Network calls run on worker threads so the UI never
freezes.
"""

import logging
import threading

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (QDialog, QFileDialog, QHBoxLayout, QLabel,
                               QLineEdit, QPushButton, QVBoxLayout, QWidget)

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


class SettingsForm(QWidget):
    """The pairing/settings form body (headline, fields, confirm, buttons).

    Emits `saved` after the config is persisted and `cancelled` when the
    user backs out. Owns `self.cfg` (mutated in place, then written to disk
    on save). No window chrome of its own — the container supplies the
    eyebrow/back-arrow header.
    """

    saved = Signal()
    cancelled = Signal()
    # (result dict | None, error message) from the worker threads
    _preview_finished = Signal(object, str)
    _pair_finished = Signal(object, str)

    def __init__(self, cfg: dict, *, cancel_label: str = "Cancel",
                 parent: QWidget | None = None):
        super().__init__(parent)
        self.cfg = cfg
        self.saved_ok = False
        self.already_paired = bool(cfg.get("device_token"))
        self._cancel_label = cancel_label
        self._confirming = False
        self._pending_ctx: tuple[str, str, str] | None = None  # (url, folder, code)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

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
        sub.setWordWrap(True)
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
        self.browse = QPushButton("Browse…", self)
        self.browse.setObjectName("outline")
        self.browse.setFont(theme.font("body", 10))
        self.browse.setCursor(Qt.CursorShape.PointingHandCursor)
        self.browse.clicked.connect(self._browse)
        row.addWidget(self.folder_entry, 1)
        row.addSpacing(8)
        row.addWidget(self.browse)
        lay.addLayout(row)

        self.fl_entry = field("FL Studio executable",
                              cfg.get("fl_executable", ""))

        # Inline confirm prompt (hidden until a code is previewed).
        lay.addSpacing(12)
        self.confirm_lbl = QLabel("", self)
        self.confirm_lbl.setObjectName("headline")
        self.confirm_lbl.setFont(theme.font("display", 12))
        self.confirm_lbl.setWordWrap(True)
        self.confirm_lbl.hide()
        lay.addWidget(self.confirm_lbl)

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
        self.cancel_btn = QPushButton(cancel_label, self)
        self.cancel_btn.setObjectName("ghost")
        self.cancel_btn.setFont(theme.font("body", 10))
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.clicked.connect(self._on_cancel)
        self.save_btn = QPushButton(
            "Save" if self.already_paired else "Pair device", self)
        self.save_btn.setObjectName("primary")
        self.save_btn.setFont(theme.font("body", 10))
        self.save_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.save_btn.setDefault(True)
        self.save_btn.clicked.connect(self._on_primary)
        btns.addWidget(self.cancel_btn)
        btns.addSpacing(8)
        btns.addWidget(self.save_btn)
        lay.addLayout(btns)

        self._preview_finished.connect(self._on_preview_finished)
        self._pair_finished.connect(self._on_pair_finished)

    def load(self, cfg: dict):
        """Refresh the fields from a (possibly changed) cfg — used when the
        persistent embedded form is reopened via the status-window cogwheel."""
        self.cfg = dict(cfg)
        self.already_paired = bool(cfg.get("device_token"))
        self._exit_confirm()  # never reopen stuck mid-confirm
        self.api_entry.setText(cfg.get("api_url") or "https://")
        self.code_entry.clear()
        self.folder_entry.setText((cfg.get("watch_folders") or [""])[0])
        self.fl_entry.setText(cfg.get("fl_executable", ""))
        self.error_lbl.clear()

    def _browse(self):
        folder = QFileDialog.getExistingDirectory(
            self, "Choose the FL Studio projects folder",
            self.folder_entry.text() or "")
        if folder:
            self.folder_entry.setText(folder)

    # ---- button routing (one handler each, branch on confirm state) ----
    def _on_primary(self):
        if self._confirming:
            self._commit()
        else:
            self._submit()

    def _on_cancel(self):
        if self._confirming:
            self.error_lbl.clear()
            self._exit_confirm()  # back to the editable form, nothing paired
        else:
            self.cancelled.emit()

    # ---- step 1: validate + preview the code ----
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

        if keep_pairing:  # no new account involved → no confirm
            self._save(api_url, folder)
            return

        self._pending_ctx = (api_url, folder, code)
        self.save_btn.setEnabled(False)
        self.save_btn.setText("Checking…")

        def work():
            try:
                result = ApiClient(api_url).preview(code)
                self._preview_finished.emit(result, "")
            except ApiError as e:
                self._preview_finished.emit(None, str(e))

        threading.Thread(target=work, daemon=True).start()

    def _on_preview_finished(self, result, error: str):
        self.save_btn.setEnabled(True)
        if result is None:
            self.save_btn.setText(
                "Save" if self.already_paired else "Pair device")
            self.error_lbl.setText(f"Couldn't check code: {error}")
            return
        self._enter_confirm(result.get("username"))

    # ---- inline confirm state ----
    def _enter_confirm(self, username):
        self._confirming = True
        handle = (username or "").strip()
        if handle:
            self.confirm_lbl.setText(f"Pair this PC with @{handle}?")
        else:
            self.confirm_lbl.setText(
                "Pair this PC with this account?\n"
                "(no username set on the web app yet)")
        self.confirm_lbl.show()
        self._lock_fields(True)
        self.save_btn.setEnabled(True)
        self.save_btn.setText("Pair")
        self.cancel_btn.setText("Back")

    def _exit_confirm(self):
        self._confirming = False
        self._pending_ctx = None
        self.confirm_lbl.hide()
        self.confirm_lbl.clear()
        self._lock_fields(False)
        self.save_btn.setEnabled(True)
        self.save_btn.setText("Save" if self.already_paired else "Pair device")
        self.cancel_btn.setText(self._cancel_label)

    def _lock_fields(self, locked: bool):
        for w in (self.api_entry, self.code_entry, self.folder_entry,
                  self.fl_entry, self.browse):
            w.setDisabled(locked)

    # ---- step 2: commit the pairing ----
    def _commit(self):
        if not self._pending_ctx:
            return
        url, _folder, code = self._pending_ctx
        self.save_btn.setEnabled(False)
        self.save_btn.setText("Pairing…")

        def work():
            try:
                result = ApiClient(url).pair(
                    code, self.cfg.get("device_name", "Studio PC"))
                self._pair_finished.emit(result, "")
            except ApiError as e:
                self._pair_finished.emit(None, str(e))

        threading.Thread(target=work, daemon=True).start()

    def _on_pair_finished(self, result, error: str):
        if not self._pending_ctx:
            return
        url, folder, _code = self._pending_ctx
        if result is None:
            self.error_lbl.setText(f"Pairing failed: {error}")
            self._exit_confirm()  # unlock so they can retry
            return
        self.cfg["device_token"] = result["device_token"]
        self.cfg["username"] = result.get("username") or ""
        self._save(url, folder)

    def _save(self, api_url: str, folder: str):
        self.cfg["api_url"] = api_url
        self.cfg["watch_folders"] = [folder]
        self.cfg["fl_executable"] = (self.fl_entry.text().strip()
                                     or self.cfg["fl_executable"])
        config.save(self.cfg)
        self.saved_ok = True
        self.saved.emit()


class SettingsDialog(QDialog):
    """Standalone modal wrapper around `SettingsForm` for the flows that run
    before the tray window exists (first-run, `--setup`, revoked re-pair)."""

    def __init__(self, cfg: dict):
        super().__init__()
        self.saved = False
        already_paired = bool(cfg.get("device_token"))

        self.setWindowTitle("SanGit — Settings" if already_paired
                            else "SanGit — Pair device")
        self.setFixedWidth(480)
        theme.dark_titlebar(self)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(PAD, PAD - 2, PAD, PAD)
        lay.setSpacing(0)
        lay.addWidget(theme.eyebrow_row("SanGit device", self))
        lay.addSpacing(8)

        self.form = SettingsForm(cfg, cancel_label="Cancel", parent=self)
        self.form.saved.connect(self._on_saved)
        self.form.cancelled.connect(self.reject)
        lay.addWidget(self.form)

    def _on_saved(self):
        self.saved = True
        self.accept()


def run_setup(cfg: dict) -> bool:
    """Shows the setup/settings modal; returns True when saved.

    When the device is already paired, the code field may be left blank to
    keep the existing pairing and only change the folder/paths. Requires a
    QApplication to exist.
    """
    dialog = SettingsDialog(cfg)
    dialog.exec()
    if not dialog.saved:
        log.info("settings window dismissed")
    return dialog.saved
