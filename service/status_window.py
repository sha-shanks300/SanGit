"""Tray status window: the watcher toggle plus an in-window settings view.

Opened by left-clicking the tray icon (or the "Open SanGit" menu item).
Modeless; closing hides it back to the tray. The default view shows the
watch toggle over live watcher state; a cogwheel in the header swaps the
window to an embedded settings form (the same `SettingsForm` the standalone
pairing modal uses), with a back arrow to return. The toggle drives the
App's soft-pause `watching` flag through callbacks — this module knows
nothing about the watcher itself.
"""

import webbrowser
from pathlib import Path
from typing import Callable

from PySide6.QtCore import (Property, QEasingCurve, QPropertyAnimation, Qt,
                            QTimer, Signal)
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import (QDialog, QFrame, QHBoxLayout, QLabel,
                               QPushButton, QStackedWidget, QVBoxLayout,
                               QWidget)

import theme
import version
from pairing import SettingsForm

# Both views share one constant window size (widest + tallest view wins) so
# the frame never jumps when the cogwheel/back button swaps between them —
# which also keeps the nav button under the pointer across the swap.
WINDOW_WIDTH = 480


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

    W, H, PAD = 120, 60, 6

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
    """Two views in one window: the glanceable watcher status (toggle,
    "Watching…"/"Paused", queue line, watched folders) and, behind the
    header cogwheel, the embedded settings form."""

    def __init__(self, *, is_watching: Callable[[], bool],
                 set_watching: Callable[[bool], None],
                 status_text: Callable[[], str],
                 get_config: Callable[[], dict],
                 is_revoked: Callable[[], bool],
                 get_update_version: Callable[[], str],
                 on_settings_saved: Callable[[], None]):
        super().__init__(None)
        self._is_watching = is_watching
        self._set_watching = set_watching
        self._status_text = status_text
        self._get_config = get_config
        self._is_revoked = is_revoked
        self._get_update_version = get_update_version
        self._on_settings_saved_cb = on_settings_saved

        self.setWindowTitle("SanGit")
        self.setWindowIcon(theme.app_icon())
        self.setFixedWidth(WINDOW_WIDTH)

        main = QVBoxLayout(self)
        main.setContentsMargins(0, 0, 0, 0)
        main.setSpacing(0)
        self._stack = QStackedWidget(self)
        self._status_page = self._build_status_page()
        self._settings_page = self._build_settings_page()
        self._stack.addWidget(self._status_page)    # index 0
        self._stack.addWidget(self._settings_page)  # index 1
        main.addWidget(self._stack)
        self.set_revoked(self._is_revoked())
        self.set_update_available(self._get_update_version())

        # Queue counts move while the window is open (uploads finish,
        # renders start) — poll gently, only while visible.
        self._timer = QTimer(self)
        self._timer.setInterval(2000)
        self._timer.timeout.connect(self._refresh)
        self._refresh()
        theme.dark_titlebar(self)

    # ---- status view ----
    def _build_status_page(self) -> QWidget:
        page = QWidget(self)
        lay = QVBoxLayout(page)
        lay.setContentsMargins(28, 24, 28, 24)
        lay.setSpacing(0)

        header = QHBoxLayout()
        header.setContentsMargins(0, 0, 0, 0)
        cog = QPushButton("⚙", page)  # gear
        cog.setObjectName("icon")
        cog.setFont(theme.symbol_font(13))
        cog.setCursor(Qt.CursorShape.PointingHandCursor)
        cog.setToolTip("Settings")
        cog.clicked.connect(self._open_settings)
        header.addWidget(cog, 0, Qt.AlignmentFlag.AlignTop)
        header.addWidget(theme.eyebrow_row("SanGit service", page, right=True), 1)
        lay.addLayout(header)

        # Reconnect banner — shown only when the device is revoked on the web
        # app (hidden widgets take no layout space, so no gap when hidden).
        self._banner = self._build_revoked_banner(page)
        lay.addWidget(self._banner)
        # Update banner — shown when a newer release exists.
        self._update_banner = self._build_update_banner(page)
        lay.addWidget(self._update_banner)

        lay.addStretch(1)  # center the toggle block in the space below the header

        self._toggle = ToggleSwitch(self._is_watching(), page)
        self._toggle.toggled.connect(self._on_toggled)
        lay.addWidget(self._toggle, alignment=Qt.AlignmentFlag.AlignHCenter)
        lay.addSpacing(18)

        self._state = QLabel("", page)
        self._state.setObjectName("headline")
        self._state.setFont(theme.font("display", 17))
        self._state.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        lay.addWidget(self._state)
        lay.addSpacing(6)

        self._queue = QLabel("", page)
        self._queue.setObjectName("sub")
        self._queue.setFont(theme.font("body", 9))
        self._queue.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        lay.addWidget(self._queue)
        lay.addStretch(1)  # push the folder footer down to the window's base

        rule = QFrame(page)
        rule.setFrameShape(QFrame.Shape.HLine)
        rule.setStyleSheet(f"background: {theme.HAIRLINE_TERTIARY}; border: none;")
        rule.setFixedHeight(1)
        lay.addWidget(rule)
        lay.addSpacing(14)

        # Account identity — which web handle this PC uploads to. Refreshed
        # via _render_account() (username self-heals on the startup ping).
        lay.addWidget(theme.field_label("Connected as", page))
        lay.addSpacing(4)
        self._account = QLabel("", page)
        self._account.setFont(theme.font("body", 11))
        lay.addWidget(self._account)
        lay.addSpacing(16)

        # Watched-folder list rebuilt in place when settings change.
        self._folders_box = QVBoxLayout()
        self._folders_box.setContentsMargins(0, 0, 0, 0)
        self._folders_box.setSpacing(0)
        lay.addLayout(self._folders_box)
        self._rebuild_folders(self._get_config().get("watch_folders") or [])

        lay.addSpacing(14)
        ver = QLabel(f"SanGit v{version.__version__}", page)
        ver.setObjectName("filename")  # mono, muted
        ver.setFont(theme.font("mono", 7))
        lay.addWidget(ver)
        return page

    def _rebuild_folders(self, folders: list[str]):
        while self._folders_box.count():
            item = self._folders_box.takeAt(0)
            w = item.widget()
            if w is not None:
                w.deleteLater()

        self._folders_box.addWidget(theme.field_label(
            "Watching folder" + ("s" if len(folders) != 1 else ""), self))
        self._folders_box.addSpacing(6)
        for folder in folders:
            p = Path(folder)
            name = QLabel(p.name or str(p), self)
            name.setFont(theme.font("body", 10))
            self._folders_box.addWidget(name)
            full = QLabel(str(p), self)
            full.setObjectName("filename")
            full.setFont(theme.font("mono", 7))
            full.setWordWrap(True)
            self._folders_box.addWidget(full)
            self._folders_box.addSpacing(8)

    def _on_toggled(self, on: bool):
        self._set_watching(on)
        self._refresh()

    def sync_state(self, on: bool):
        """Called by the app when the tray menu (or anything else) flips
        the flag — mirror it without re-emitting."""
        self._toggle.setChecked(on)
        self._refresh()

    def update_config(self, cfg: dict | None = None):
        """Refresh the open window in place after settings are applied —
        the folder list may have changed. Never destroys the window."""
        cfg = cfg or self._get_config()
        self._rebuild_folders(cfg.get("watch_folders") or [])
        self._refresh()

    def _build_revoked_banner(self, page: QWidget) -> QWidget:
        frame = QFrame(page)
        frame.setObjectName("revokedBanner")
        frame.setStyleSheet(
            f"#revokedBanner {{ border: 1px solid {theme.PRIMARY};"
            f" background: {theme.SURFACE_1}; }}")
        box = QVBoxLayout(frame)
        box.setContentsMargins(14, 12, 14, 12)
        box.setSpacing(6)
        title = QLabel("Device revoked", frame)
        title.setObjectName("headline")
        title.setFont(theme.font("display", 12))
        box.addWidget(title)
        msg = QLabel("This PC was disconnected on the web app. Reconnect with "
                     "a new pairing code to keep uploading.", frame)
        msg.setObjectName("sub")
        msg.setFont(theme.font("body", 9))
        msg.setWordWrap(True)
        box.addWidget(msg)
        box.addSpacing(4)
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        row.addStretch(1)
        btn = QPushButton("Reconnect", frame)
        btn.setObjectName("primary")
        btn.setFont(theme.font("body", 10))
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.clicked.connect(self._open_settings)
        row.addWidget(btn)
        box.addLayout(row)
        frame.hide()
        return frame

    def set_revoked(self, on: bool):
        """Show/hide the reconnect banner — called by the app when the device
        is revoked on the web app, or reconnected."""
        self._banner.setVisible(on)

    def _build_update_banner(self, page: QWidget) -> QWidget:
        frame = QFrame(page)
        frame.setObjectName("updateBanner")
        frame.setStyleSheet(
            f"#updateBanner {{ border: 1px solid {theme.HAIRLINE_TERTIARY};"
            f" background: {theme.SURFACE_1}; }}")
        box = QVBoxLayout(frame)
        box.setContentsMargins(14, 12, 14, 12)
        box.setSpacing(6)
        title = QLabel("Update available", frame)
        title.setObjectName("headline")
        title.setFont(theme.font("display", 12))
        title.setStyleSheet(f"color: {theme.SUCCESS};")
        box.addWidget(title)
        self._update_msg = QLabel("", frame)
        self._update_msg.setObjectName("sub")
        self._update_msg.setFont(theme.font("body", 9))
        self._update_msg.setWordWrap(True)
        box.addWidget(self._update_msg)
        box.addSpacing(4)
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        row.addStretch(1)
        btn = QPushButton("Update", frame)
        btn.setObjectName("primary")
        btn.setFont(theme.font("body", 10))
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.clicked.connect(self._open_update)
        row.addWidget(btn)
        box.addLayout(row)
        frame.hide()
        return frame

    def set_update_available(self, version_str: str):
        """Show/hide the update banner. Empty string hides it."""
        v = (version_str or "").strip()
        if not v:
            self._update_banner.hide()
            return
        self._update_msg.setText(f"SanGit v{v} is ready to install.")
        self._update_banner.show()

    def _open_update(self):
        url = (self._get_config().get("api_url") or "").rstrip("/")
        if url:
            webbrowser.open(f"{url}/download")

    def _render_account(self):
        """Show '@handle' when the owner has a web username, else fall back
        to the device name (a profile may not have a handle set yet)."""
        cfg = self._get_config()
        handle = (cfg.get("username") or "").strip()
        if handle:
            self._account.setText(f"@{handle}")
            self._account.setStyleSheet(f"color: {theme.INK};")
        else:
            self._account.setText(cfg.get("device_name") or "This device")
            self._account.setStyleSheet(f"color: {theme.INK_MUTED};")

    def _refresh(self):
        watching = self._is_watching()
        self._state.setText("Watching…" if watching else "Paused")
        self._queue.setText(self._status_text() if watching
                            else "Saves are ignored until you turn this back on")
        self._render_account()

    # ---- settings view ----
    def _build_settings_page(self) -> QWidget:
        page = QWidget(self)
        lay = QVBoxLayout(page)
        lay.setContentsMargins(28, 24, 28, 24)
        lay.setSpacing(0)

        # Back button sits exactly where the cogwheel was (left, top) so the
        # pointer is already on it the instant the view swaps.
        header = QHBoxLayout()
        header.setContentsMargins(0, 0, 0, 0)
        back = QPushButton("‹", page)  # chevron-back
        back.setObjectName("icon")
        back.setFont(theme.symbol_font(15))
        back.setCursor(Qt.CursorShape.PointingHandCursor)
        back.setToolTip("Back")
        back.clicked.connect(self._close_settings)
        header.addWidget(back, 0, Qt.AlignmentFlag.AlignTop)
        header.addWidget(theme.eyebrow_row("SanGit device", page, right=True), 1)
        lay.addLayout(header)
        lay.addSpacing(12)

        # One persistent form; its fields are refreshed from the live cfg
        # each time the view opens (see _open_settings). Nothing is live
        # until it writes to disk and the app reloads via on_settings_saved.
        self._settings_form = SettingsForm(
            dict(self._get_config()), cancel_label="Cancel", parent=page)
        self._settings_form.saved.connect(self._on_settings_saved)
        self._settings_form.cancelled.connect(self._close_settings)
        lay.addWidget(self._settings_form)
        lay.addStretch(1)
        return page

    def _open_settings(self):
        self._settings_form.load(self._get_config())
        self._stack.setCurrentIndex(1)

    def _close_settings(self):
        self._stack.setCurrentIndex(0)
        self._refresh()

    def _on_settings_saved(self):
        # App reloads config from disk and hot-applies it, which calls back
        # into update_config() to refresh this window's folder list.
        self._on_settings_saved_cb()
        self._close_settings()

    def showEvent(self, e):
        self._refresh()
        self.set_revoked(self._is_revoked())
        self.set_update_available(self._get_update_version())
        self._timer.start()
        super().showEvent(e)

    def hideEvent(self, e):
        self._timer.stop()
        super().hideEvent(e)
