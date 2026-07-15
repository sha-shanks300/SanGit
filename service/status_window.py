"""Tray status window: a big slide toggle over live watcher state.

Opened by left-clicking the tray icon (or the "Open SanGit" menu item).
Modeless; closing hides it back to the tray. The toggle drives the App's
soft-pause `watching` flag through callbacks — this module knows nothing
about the watcher itself.
"""

from pathlib import Path
from typing import Callable

from PySide6.QtCore import (Property, QEasingCurve, QPropertyAnimation, Qt,
                            QTimer, Signal)
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import QDialog, QFrame, QLabel, QVBoxLayout, QWidget

import theme


def _lerp_color(a: str, b: str, t: float) -> QColor:
    ca, cb = QColor(a), QColor(b)
    return QColor(
        round(ca.red() + (cb.red() - ca.red()) * t),
        round(ca.green() + (cb.green() - ca.green()) * t),
        round(ca.blue() + (cb.blue() - ca.blue()) * t),
    )


class ToggleSwitch(QWidget):
    """Custom-painted slide toggle: Rosso Corsa pill when on, surface gray
    when off, knob eases across in 150 ms. (The pill is a sanctioned
    exception to the sharp-corner rule — switches are inherently pills.)"""

    toggled = Signal(bool)  # emitted only for user-initiated flips

    W, H, PAD = 96, 48, 5

    def __init__(self, checked: bool = True, parent: QWidget | None = None):
        super().__init__(parent)
        self._checked = checked
        self._pos = 1.0 if checked else 0.0  # knob travel 0..1
        self.setFixedSize(self.W, self.H)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self._anim = QPropertyAnimation(self, b"knobPos", self)
        self._anim.setDuration(150)
        self._anim.setEasingCurve(QEasingCurve.Type.OutCubic)

    # animated property
    def _get_pos(self) -> float:
        return self._pos

    def _set_pos(self, v: float):
        self._pos = v
        self.update()

    knobPos = Property(float, _get_pos, _set_pos)

    def isChecked(self) -> bool:
        return self._checked

    def setChecked(self, on: bool):
        """Programmatic sync (e.g. from the tray menu) — animates, no emit."""
        if on == self._checked:
            return
        self._checked = on
        self._anim.stop()
        self._anim.setStartValue(self._pos)
        self._anim.setEndValue(1.0 if on else 0.0)
        self._anim.start()

    def _flip(self):
        self.setChecked(not self._checked)
        self.toggled.emit(self._checked)

    def mouseReleaseEvent(self, e):
        if (e.button() == Qt.MouseButton.LeftButton
                and self.rect().contains(e.position().toPoint())):
            self._flip()

    def keyPressEvent(self, e):
        if e.key() in (Qt.Key.Key_Space, Qt.Key.Key_Return):
            self._flip()
        else:
            super().keyPressEvent(e)

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        radius = self.height() / 2
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(_lerp_color(theme.SURFACE_3, theme.PRIMARY, self._pos))
        p.drawRoundedRect(self.rect(), radius, radius)
        if self.hasFocus():  # yellow focus ring per the design system
            pen = p.pen()
            p.setPen(QColor(theme.FOCUS))
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), radius, radius)
            p.setPen(pen)
        d = self.height() - 2 * self.PAD
        x = self.PAD + self._pos * (self.width() - self.height())
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(theme.INK))
        p.drawEllipse(int(x), self.PAD, d, d)
        p.end()


class StatusWindow(QDialog):
    """Glanceable state: toggle, "Watching…"/"Paused", queue line, and the
    watched folder names (so a wrong folder is caught at a glance)."""

    def __init__(self, *, is_watching: Callable[[], bool],
                 set_watching: Callable[[bool], None],
                 status_text: Callable[[], str],
                 folders: list[str]):
        super().__init__(None)
        self._is_watching = is_watching
        self._set_watching = set_watching
        self._status_text = status_text

        self.setWindowTitle("SanGit")
        self.setWindowIcon(theme.app_icon())
        self.setFixedWidth(340)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(28, 24, 28, 24)
        lay.setSpacing(0)
        lay.addWidget(theme.eyebrow_row("SanGit service", self))
        lay.addSpacing(28)

        self._toggle = ToggleSwitch(is_watching(), self)
        self._toggle.toggled.connect(self._on_toggled)
        lay.addWidget(self._toggle, alignment=Qt.AlignmentFlag.AlignHCenter)
        lay.addSpacing(18)

        self._state = QLabel("", self)
        self._state.setObjectName("headline")
        self._state.setFont(theme.font("display", 17))
        self._state.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        lay.addWidget(self._state)
        lay.addSpacing(6)

        self._queue = QLabel("", self)
        self._queue.setObjectName("sub")
        self._queue.setFont(theme.font("body", 9))
        self._queue.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        lay.addWidget(self._queue)
        lay.addSpacing(24)

        rule = QFrame(self)
        rule.setFrameShape(QFrame.Shape.HLine)
        rule.setStyleSheet(f"background: {theme.HAIRLINE_TERTIARY}; border: none;")
        rule.setFixedHeight(1)
        lay.addWidget(rule)
        lay.addSpacing(14)

        lay.addWidget(theme.field_label(
            "Watching folder" + ("s" if len(folders) != 1 else ""), self))
        lay.addSpacing(6)
        for folder in folders:
            p = Path(folder)
            name = QLabel(p.name or str(p), self)
            name.setFont(theme.font("body", 10))
            lay.addWidget(name)
            full = QLabel(str(p), self)
            full.setObjectName("filename")
            full.setFont(theme.font("mono", 7))
            full.setWordWrap(True)
            lay.addWidget(full)
            lay.addSpacing(8)

        # Queue counts move while the window is open (uploads finish,
        # renders start) — poll gently, only while visible.
        self._timer = QTimer(self)
        self._timer.setInterval(2000)
        self._timer.timeout.connect(self._refresh)
        self._refresh()
        theme.dark_titlebar(self)

    def _on_toggled(self, on: bool):
        self._set_watching(on)
        self._refresh()

    def sync_state(self, on: bool):
        """Called by the app when the tray menu (or anything else) flips
        the flag — mirror it without re-emitting."""
        self._toggle.setChecked(on)
        self._refresh()

    def _refresh(self):
        watching = self._is_watching()
        self._state.setText("Watching…" if watching else "Paused")
        self._queue.setText(self._status_text() if watching
                            else "Saves are ignored until you turn this back on")

    def showEvent(self, e):
        self._refresh()
        self._timer.start()
        super().showEvent(e)

    def hideEvent(self, e):
        self._timer.stop()
        super().hideEvent(e)
