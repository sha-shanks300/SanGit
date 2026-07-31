"""Commit prompt: a frameless topmost toast (bottom-right, near the tray).

Two pages in one fixed-size window:
  1. Commit — a version-name field and Skip / Commit to branch / Commit.
     Plain Commit lands on the file's current branch; if ignored the draining
     countdown auto-commits there (a finished session is never silently lost).
  2. Branch — reached via "Commit to branch": a click-to-open dropdown of the
     project's existing branches (loaded while the window was already open) and
     a separate "new branch" field. Typed name wins; a Back button returns.

The App shows one toast at a time and decides what the outcome does. All UI
lives on the Qt main thread.
"""

import logging
from pathlib import Path
from typing import Callable

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, Qt, QTimer
from PySide6.QtGui import QColor, QGuiApplication, QPainter, QPen
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFrame, QHBoxLayout, QLabel,
                               QLineEdit, QPushButton, QStackedWidget, QVBoxLayout,
                               QWidget)

import theme

log = logging.getLogger("sangit.popup")

WIDTH = 400
PAD = 20  # card interior padding


class _BranchCombo(QComboBox):
    """Non-editable branch picker — a real click-to-open list. Creating a new
    branch is a separate field on the branch page, so this control does exactly
    one thing (pick an existing branch), which is what makes it read as a list
    rather than the autofill box it used to."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMaxVisibleItems(8)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def paintEvent(self, event):
        super().paintEvent(event)
        # hairline chevron on the trailing edge — the affordance that says
        # "this is a list", drawn to the design system's stroke weight.
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        # dim the chevron in step with the greyed text when the picker is off
        stroke = theme.INK_SUBTLE if self.isEnabled() else theme.INK_TERTIARY
        p.setPen(QPen(QColor(stroke), 1.4))
        cx = self.width() - 15
        cy = self.height() / 2 - 1
        p.drawLine(cx - 4, cy - 1, cx, cy + 3)
        p.drawLine(cx, cy + 3, cx + 4, cy - 1)
        p.end()


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
        self._has_branches = False  # set once set_branches lands a real list
        self._closed = False
        self.setFixedWidth(WIDTH)
        # the toast itself holds focus, so no input starts out ringed (see open)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)

        field = (f"background: {theme.CANVAS}; color: {theme.INK};"
                 f" border: 1px solid {theme.HAIRLINE_STRONG}; border-radius: 0;"
                 f" padding: 7px 10px; min-height: 17px;")
        self.setStyleSheet(
            f"CommitToast {{ background: {theme.SURFACE_1};"
            f" border: 1px solid {theme.HAIRLINE_STRONG}; }}"
            f"QLineEdit {{ {field} }}"
            f"QComboBox {{ {field} padding-right: 26px; }}"
            f"QComboBox:hover {{ border: 1px solid {theme.HAIRLINE_TERTIARY}; }}"
            f"QComboBox:disabled {{ color: {theme.INK_TERTIARY}; }}"
            # the chevron is painted in _BranchCombo.paintEvent
            f"QComboBox::drop-down {{ border: none; width: 0; }}"
            f"QComboBox QAbstractItemView {{ background: {theme.SURFACE_3};"
            f" color: {theme.INK}; border: 1px solid {theme.HAIRLINE_TERTIARY};"
            f" outline: none; padding: 3px;"
            f" selection-background-color: {theme.SURFACE_4}; }}"
            f"QComboBox QAbstractItemView::item {{ min-height: 24px;"
            f" padding: 2px 8px; }}"
            # page-1 destination cue: subtle mono, so a plain Commit's target
            # branch is never a guess (the accent arrow is the only splash).
            f"QLabel#target {{ color: {theme.INK_SUBTLE}; }}"
            f"QLabel#targetArrow {{ color: {theme.PRIMARY}; }}"
            # "+ New branch" gate: a sharp hairline box that fills Rosso Corsa
            # when armed (mirrors theme.py's QMenu checked-indicator). The label
            # brightens to ink white while checked so the active mode reads at a
            # glance; muted otherwise.
            f"QCheckBox {{ color: {theme.INK_MUTED}; spacing: 9px; }}"
            f"QCheckBox:checked {{ color: {theme.INK}; }}"
            f"QCheckBox::indicator {{ width: 13px; height: 13px;"
            f" background: {theme.CANVAS};"
            f" border: 1px solid {theme.HAIRLINE_TERTIARY}; }}"
            f"QCheckBox::indicator:hover {{ border-color: {theme.INK}; }}"
            f"QCheckBox::indicator:checked {{ background: {theme.PRIMARY};"
            f" border-color: {theme.PRIMARY}; }}"
            f"QPushButton#outline {{ padding: 8px 16px; border-color:"
            f" {theme.HAIRLINE_TERTIARY}; color: {theme.INK_MUTED}; }}"
            f"QPushButton#outline:hover {{ border-color: {theme.INK};"
            f" color: {theme.INK}; background: transparent; }}"
            f"QPushButton#primary {{ padding: 8px 18px; }}"
            f"QPushButton#ghost {{ padding: 8px 10px; }}")

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self._stack = QStackedWidget(self)
        self._stack.addWidget(self._build_commit_page())  # index 0
        self._stack.addWidget(self._build_branch_page())  # index 1
        outer.addWidget(self._stack)

        # draining countdown hairline along the very bottom edge (page 1 only)
        self._track = QFrame(self)
        self._track.setFixedHeight(2)
        self._track.setStyleSheet(f"background: {theme.SURFACE_2};")
        self._bar = QFrame(self._track)
        self._bar.setFixedHeight(2)
        self._bar.setStyleSheet(f"background: {theme.HAIRLINE_TERTIARY};")
        outer.addWidget(self._track)

        self._paused = False
        self._remaining_ms = timeout_secs * 1000
        self._total_ms = self._remaining_ms
        self._ticker = QTimer(self)
        self._ticker.setInterval(100)
        self._ticker.timeout.connect(self._tick)

        self._fade = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade.setDuration(160)
        self._fade.setEasingCurve(QEasingCurve.Type.OutCubic)

    # ---- pages ----
    def _header(self, lay: QVBoxLayout, title_text: str):
        lay.addWidget(theme.eyebrow_row("SanGit — FL closed"))
        lay.addSpacing(8)
        title = QLabel(title_text)
        title.setObjectName("title")
        title.setFont(theme.font("display", 12))
        lay.addWidget(title)
        lay.addSpacing(2)
        fname = QLabel(Path(self._flp_path).name)
        fname.setObjectName("filename")
        fname.setFont(theme.font("mono", 9))
        lay.addWidget(fname)

    def _button(self, text: str, obj: str, slot) -> QPushButton:
        b = QPushButton(text)
        b.setObjectName(obj)
        b.setFont(theme.font("body", 10))
        b.setCursor(Qt.CursorShape.PointingHandCursor)
        b.clicked.connect(slot)
        return b

    def _build_commit_page(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(PAD, PAD - 4, PAD, PAD)
        lay.setSpacing(0)
        self._header(lay, "Commit this version?")

        # where a plain Commit lands — the file's current branch (trunk shows
        # "main"). Resolved from the fetched branches in set_branches; until then
        # it shows the filename stem, which is the branch a first commit creates.
        lay.addSpacing(7)
        row = QWidget()
        trow = QHBoxLayout(row)
        trow.setContentsMargins(0, 0, 0, 0)
        trow.setSpacing(6)
        arrow = QLabel("→")
        arrow.setObjectName("targetArrow")
        arrow.setFont(theme.font("mono", 9))
        self._target = QLabel(Path(self._flp_path).stem)
        self._target.setObjectName("target")
        self._target.setFont(theme.font("mono", 9))
        trow.addWidget(arrow)
        trow.addWidget(self._target)
        trow.addStretch(1)
        lay.addWidget(row)

        lay.addSpacing(16)
        lay.addWidget(theme.field_label("Version name · optional"))
        lay.addSpacing(5)
        self.entry = QLineEdit()
        self.entry.setFont(theme.font("body", 10))
        self.entry.returnPressed.connect(self._commit)
        self.entry.textEdited.connect(self._pause_countdown)
        lay.addWidget(self.entry)

        lay.addStretch(1)
        btns = QHBoxLayout()
        btns.setContentsMargins(0, 0, 0, 0)
        btns.addWidget(self._button("Skip", "ghost", self._skip))
        btns.addStretch(1)
        btns.addWidget(self._button("Commit to branch", "outline", self._go_branch))
        btns.addSpacing(8)
        btns.addWidget(self._button("Commit", "primary", self._commit))
        lay.addLayout(btns)
        return page

    def _build_branch_page(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(PAD, PAD - 4, PAD, PAD)
        lay.setSpacing(0)
        self._header(lay, "Commit to a branch")

        lay.addSpacing(16)
        lay.addWidget(theme.field_label("Existing branch"))
        lay.addSpacing(5)
        self._existing = _BranchCombo()
        self._existing.setFont(theme.font("body", 10))
        self._existing.addItem("Loading your branches…")  # replaced by set_branches
        self._existing.setEnabled(False)
        lay.addWidget(self._existing)

        # "+ New branch" gate: off by default, so the dropdown above stays the
        # active control. Checking it hands the field below the focus and greys
        # the dropdown — exactly one of the two is ever live.
        lay.addSpacing(14)
        self._new_check = QCheckBox("+ New branch")
        self._new_check.setFont(theme.font("body", 10))
        self._new_check.setCursor(Qt.CursorShape.PointingHandCursor)
        self._new_check.toggled.connect(self._toggle_new_branch)
        lay.addWidget(self._new_check)

        lay.addSpacing(7)
        self._new_branch = QLineEdit()
        self._new_branch.setFont(theme.font("body", 10))
        self._new_branch.setPlaceholderText("name your new branch")
        self._new_branch.setEnabled(False)  # armed by the checkbox
        self._new_branch.returnPressed.connect(self._commit_branch)
        lay.addWidget(self._new_branch)

        lay.addSpacing(18)  # breathing room above the action row
        lay.addStretch(1)
        btns = QHBoxLayout()
        btns.setContentsMargins(0, 0, 0, 0)
        btns.addWidget(self._button("Back", "ghost", self._back))
        btns.addStretch(1)
        btns.addWidget(self._button("Commit", "primary", self._commit_branch))
        lay.addLayout(btns)
        return page

    # ---- lifecycle ----
    def open(self):
        self.adjustSize()
        self.setFixedHeight(self.height())  # lock size so page swaps don't jump
        geo = QGuiApplication.primaryScreen().availableGeometry()
        self.move(geo.right() - WIDTH - 24, geo.bottom() - self.height() - 24)
        self.setWindowOpacity(0.0)
        self.show()
        self.raise_()
        self.activateWindow()
        # focus the window, not a field — an auto-focused empty input wears the
        # yellow ring, which reads as an error state before you've typed.
        self.setFocus(Qt.FocusReason.OtherFocusReason)
        self._fade.stop()
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.start()
        self._ticker.start()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._update_bar()

    # ---- page navigation ----
    def _go_branch(self):
        self._pause_countdown()  # actively choosing — don't auto-commit under them
        self._stack.setCurrentIndex(1)
        # focus whichever control is live: the combo by default (no text ring),
        # the new-branch field if the gate is already armed.
        if self._new_check.isChecked():
            self._new_branch.setFocus()
        else:
            self._existing.setFocus()

    def _back(self):
        self._stack.setCurrentIndex(0)

    def _toggle_new_branch(self, checked: bool):
        """Mode switch between the two branch controls — only one is ever live.
        Armed: enable + focus the new-branch field, grey the dropdown. Off:
        return the dropdown to active (when it has branches), grey the field."""
        self._new_branch.setEnabled(checked)
        self._existing.setEnabled(self._has_branches and not checked)
        if checked:
            self._new_branch.setFocus()
        elif self._has_branches:
            self._existing.setFocus()

    # ---- countdown (page 1) ----
    def _tick(self):
        if self._paused or self._closed:
            return
        self._remaining_ms -= 100
        if self._remaining_ms <= 0:
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
        if not self._paused:
            self._paused = True
            self._track.hide()

    # ---- branch loading ----
    def request_branches(self):
        """Ask the app to load this project's branches (called as the toast
        opens, so the list is ready by the time the branch page is reached)."""
        if self._on_request_branches:
            self._on_request_branches(self._flp_path)

    def set_branches(self, branches: list[dict] | None,
                     current_branch_id: str | None = None):
        """Populate the Existing-branch dropdown. `None` = the fetch failed;
        `[]` = the project has no branches yet. Either way the new-branch gate
        still works. Pre-selects the file's current branch when present."""
        self._existing.clear()
        if not branches:  # None (fetch failed) or [] (no branches yet)
            self._has_branches = False
            self._existing.addItem("Couldn't load — use + New branch"
                                   if branches is None else
                                   "No branches yet — use + New branch")
            self._existing.setEnabled(False)
            # nothing to pick, so arm the new-branch gate and lock it there
            self._new_check.setChecked(True)
            self._new_check.setEnabled(False)
            return
        self._has_branches = True
        current = 0
        for i, b in enumerate(branches):
            self._existing.addItem(self._branch_label(b), b["id"])
            if b["id"] == current_branch_id:
                current = i
        self._existing.setCurrentIndex(current)
        # a real list arrived: the dropdown leads unless the gate is armed
        self._existing.setEnabled(not self._new_check.isChecked())
        # reflect where a plain Commit on page 1 would land
        target = next((self._branch_label(b) for b in branches
                       if b["id"] == current_branch_id), None)
        self._target.setText(target or Path(self._flp_path).stem)

    @staticmethod
    def _branch_label(b: dict) -> str:
        """Display name for a branch — the trunk (no parent) reads 'main',
        mirroring the web tree; forks show their own name."""
        return "main" if b.get("parent_branch_id") is None else b["name"]

    # ---- outcomes ----
    def _commit(self):
        # new version on the branch this file is already on
        self._close_with({"name": self.entry.text().strip()})

    def _commit_branch(self):
        # the gate decides: armed -> fork a new branch, off -> the picked one
        version = self.entry.text().strip()
        if self._new_check.isChecked():
            new = self._new_branch.text().strip()
            if not new:  # nothing typed — nudge them to name it
                self._new_branch.setFocus()
                return
            self._close_with({"name": version or new, "new_branch": new})
        elif self._existing.currentData():
            self._close_with({"name": version,
                              "branch_id": self._existing.currentData()})
        else:
            # no existing branch to land on — arm the gate so they can name one
            self._new_check.setChecked(True)

    def _skip(self):
        self._close_with(None)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            self._back() if self._stack.currentIndex() == 1 else self._skip()
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
