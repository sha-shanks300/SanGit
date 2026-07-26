"""Commit prompt: a frameless topmost toast (bottom-right, near the tray)
with an optional version-name field. Fades in/out and shows a draining
countdown hairline. In the commit-on-close flow the countdown AUTO-COMMITS
when it drains (so a finished session is never silently lost); typing pauses
it, and Skip is the only way to discard. The App shows one toast at a time
and decides what happens on the outcome.

All UI lives on the Qt main thread.
"""

import logging
from pathlib import Path
from typing import Callable

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, Qt, QTimer, Signal
from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import (QComboBox, QFrame, QHBoxLayout, QLabel, QLineEdit,
                               QPushButton, QVBoxLayout, QWidget)

import theme

log = logging.getLogger("sangit.popup")

WIDTH = 400
PAD = 20  # card interior padding


class _BranchCombo(QComboBox):
    """Editable branch picker that loads its list lazily — emits `first_open`
    the first time the dropdown is shown so the app can fetch branch names."""

    first_open = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._opened = False

    def showPopup(self):
        if not self._opened:
            self._opened = True
            self.first_open.emit()
        super().showPopup()


class CommitToast(QWidget):
    def __init__(self, flp_path: str, timeout_secs: int,
                 on_done: Callable[[str, dict | None], None],
                 timeout_action: str = "commit",
                 on_request_branches: Callable[[str], None] | None = None):
        super().__init__(None, Qt.WindowType.FramelessWindowHint
                         | Qt.WindowType.WindowStaysOnTopHint
                         | Qt.WindowType.Tool)
        self._flp_path = flp_path
        self._on_done = on_done
        self._timeout_action = timeout_action  # 'commit' | 'skip' when countdown drains
        self._on_request_branches = on_request_branches
        self._branch_ids: dict[str, str] = {}  # branch name -> id (existing branches)
        self._closed = False
        self.setFixedWidth(WIDTH)

        # surface-1 plate with a 1px hairline border; keep selectors narrow
        # so the app-level button/label styles still apply
        self.setStyleSheet(
            f"CommitToast {{ background: {theme.SURFACE_1};"
            f" border: 1px solid {theme.HAIRLINE_STRONG}; }}"
            f"QLineEdit {{ background: {theme.CANVAS}; }}"
            f"QComboBox {{ background: {theme.CANVAS}; color: {theme.INK};"
            f" border: 1px solid {theme.HAIRLINE_STRONG}; border-radius: 0;"
            f" padding: 8px 10px; }}"
            f"QComboBox QAbstractItemView {{ background: {theme.SURFACE_3};"
            f" color: {theme.INK}; border: 1px solid {theme.HAIRLINE_TERTIARY};"
            f" selection-background-color: {theme.SURFACE_4}; }}")

        lay = QVBoxLayout(self)
        lay.setContentsMargins(PAD, PAD - 4, PAD, 0)
        lay.setSpacing(0)

        lay.addWidget(theme.eyebrow_row("SanGit — FL closed", self))
        lay.addSpacing(8)
        title = QLabel("Commit this version?", self)
        title.setObjectName("title")
        title.setFont(theme.font("display", 12))
        lay.addWidget(title)
        lay.addSpacing(2)
        fname = QLabel(Path(flp_path).name, self)
        fname.setObjectName("filename")
        fname.setFont(theme.font("mono", 9))
        lay.addWidget(fname)

        lay.addSpacing(12)
        lay.addWidget(theme.field_label("Version name · optional", self))
        lay.addSpacing(3)
        self.entry = QLineEdit(self)
        self.entry.setFont(theme.font("body", 10))
        self.entry.returnPressed.connect(self._commit)
        self.entry.textEdited.connect(self._pause_countdown)
        lay.addWidget(self.entry)

        lay.addSpacing(10)
        lay.addWidget(theme.field_label("Branch · optional", self))
        lay.addSpacing(3)
        self._branch = _BranchCombo(self)
        self._branch.setEditable(True)
        self._branch.setFont(theme.font("body", 10))
        self._branch.lineEdit().setPlaceholderText("new or existing branch name")
        self._branch.lineEdit().returnPressed.connect(self._commit_to_branch)
        self._branch.editTextChanged.connect(lambda _t: self._pause_countdown())
        self._branch.first_open.connect(self._maybe_request_branches)
        lay.addWidget(self._branch)

        lay.addSpacing(14)
        btns = QHBoxLayout()
        btns.setContentsMargins(0, 0, 0, 0)
        skip = QPushButton("Skip", self)
        skip.setObjectName("ghost")
        skip.setFont(theme.font("body", 10))
        skip.setCursor(Qt.CursorShape.PointingHandCursor)
        skip.clicked.connect(self._skip)
        branch_btn = QPushButton("Commit to branch", self)
        branch_btn.setObjectName("outline")
        branch_btn.setFont(theme.font("body", 10))
        branch_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        branch_btn.clicked.connect(self._commit_to_branch)
        commit_btn = QPushButton("Commit", self)
        commit_btn.setObjectName("primary")
        commit_btn.setFont(theme.font("body", 10))
        commit_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        commit_btn.clicked.connect(self._commit)
        btns.addWidget(skip)
        btns.addStretch(1)
        btns.addWidget(branch_btn)
        btns.addSpacing(8)
        btns.addWidget(commit_btn)
        lay.addLayout(btns)
        lay.addSpacing(PAD - 4)

        # Auto-dismiss countdown: a draining hairline along the bottom edge.
        track = QFrame(self)
        track.setFixedHeight(2)
        track.setStyleSheet(f"background: {theme.SURFACE_2};")
        self._bar = QFrame(track)
        self._bar.setFixedHeight(2)
        self._bar.setStyleSheet(f"background: {theme.HAIRLINE_TERTIARY};")
        lay.addWidget(track)

        self._paused = False
        self._remaining_ms = timeout_secs * 1000
        self._total_ms = self._remaining_ms
        self._ticker = QTimer(self)
        self._ticker.setInterval(100)
        self._ticker.timeout.connect(self._tick)

        self._fade = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade.setDuration(160)
        self._fade.setEasingCurve(QEasingCurve.Type.OutCubic)

    def open(self):
        self.adjustSize()
        geo = QGuiApplication.primaryScreen().availableGeometry()
        self.move(geo.right() - WIDTH - 24, geo.bottom() - self.height() - 24)
        self.setWindowOpacity(0.0)
        self.show()
        self.raise_()
        self.activateWindow()
        self.entry.setFocus()
        self._fade.stop()
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.start()
        self._ticker.start()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._update_bar()

    # ---- countdown ----
    def _tick(self):
        if self._paused or self._closed:
            return
        self._remaining_ms -= 100
        if self._remaining_ms <= 0:
            # countdown drained: auto-commit (close flow) or skip (legacy)
            if self._timeout_action == "commit":
                self._commit()
            else:
                self._skip()
            return
        self._update_bar()

    def _update_bar(self):
        frac = max(self._remaining_ms / self._total_ms, 0.0)
        self._bar.setFixedWidth(int(self.width() * frac))

    def _pause_countdown(self):
        # The toast must not vanish mid-thought.
        if not self._paused:
            self._paused = True
            self._bar.hide()

    # ---- branch dropdown ----
    def _maybe_request_branches(self):
        if self._on_request_branches:
            self._on_request_branches(self._flp_path)

    def set_branches(self, branches: list[dict]):
        """Fill the dropdown with the project's existing branches (id + name);
        free typing still works. Called on the main thread after an async fetch."""
        self._branch_ids = {b["name"]: b["id"] for b in branches if b.get("name")}
        current = self._branch.currentText()
        self._branch.blockSignals(True)
        self._branch.clear()
        self._branch.addItem("")
        for name in self._branch_ids:
            self._branch.addItem(name)
        self._branch.setEditText(current)
        self._branch.blockSignals(False)

    # ---- outcomes ----
    def _commit(self):
        # new version on the branch this file is already on
        self._close_with({"name": self.entry.text().strip()})

    def _commit_to_branch(self):
        # commit onto the named branch: existing -> append (branch_id),
        # new -> create (new_branch). A name is required.
        value = self._branch.currentText().strip()
        if not value:
            self._pause_countdown()
            self._branch.setFocus()
            return
        name = self.entry.text().strip()
        bid = self._branch_ids.get(value)
        if bid:
            self._close_with({"name": name or value, "branch_id": bid})
        else:
            self._close_with({"name": name or value, "new_branch": value})

    def _skip(self):
        self._close_with(None)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            self._skip()
        else:
            super().keyPressEvent(event)

    def closeEvent(self, event):
        # window closed externally (e.g. session end) counts as skip
        if not self._closed:
            self._closed = True
            self._ticker.stop()
            self._on_done(self._flp_path, None)
        super().closeEvent(event)

    def _close_with(self, outcome: dict | None):
        if self._closed:
            return
        self._closed = True
        self._ticker.stop()
        self._fade.stop()
        self._fade.setStartValue(self.windowOpacity())
        self._fade.setEndValue(0.0)

        def done():
            self.hide()
            self.deleteLater()
            self._on_done(self._flp_path, outcome)

        self._fade.finished.connect(done)
        self._fade.start()
