"""Upload splash: a frameless, screen-centered, always-on-top window shown
while SanGit exports + uploads a version. A looping WebP of the mark (played
natively via QMovie — no QtMultimedia backend), the 'SanGit' wordmark in the
web app's display face, reassurance copy (including the FL-reopen heads-up),
and a thin indeterminate sweep bar under the logo.

Standalone for now: it exposes show_centered() and set_state(); wiring it into
the real commit -> export -> upload lifecycle is a separate step. Preview it
with `python main.py --preview-upload` (add `fail` to preview the failure).
"""

import logging

from PySide6.QtCore import (QEasingCurve, QPropertyAnimation, QSize, QTimer,
                            QVariantAnimation, Qt)
from PySide6.QtGui import QCursor, QGuiApplication, QImageReader, QMovie
from PySide6.QtWidgets import (QFrame, QLabel, QVBoxLayout, QWidget)

import theme

log = logging.getLogger("sangit.upload_window")

WIDTH = 360
PAD = 34
BAR_W = WIDTH - 2 * PAD          # sweep-bar track width (content width)
SEG_W = 100                      # bright sweeping segment
LOOP_MS = 1600                   # one sweep cycle
LOGO_H = 214                     # displayed logo height (loop is downscaled to it)


def _fit_height(size: QSize, target_h: int) -> QSize:
    """Scale `size` to `target_h`, preserving aspect. Falls back to a sane
    portrait box if the source size is unreadable."""
    if size.isEmpty():
        return QSize(round(target_h * 0.86), target_h)
    return QSize(round(size.width() * target_h / size.height()), target_h)


class UploadSplash(QWidget):
    def __init__(self):
        super().__init__(None, Qt.WindowType.FramelessWindowHint
                         | Qt.WindowType.WindowStaysOnTopHint
                         | Qt.WindowType.Tool)
        self._closing = False
        self._phase = "uploading"  # 'uploading' | 'exporting' — for done/failed copy
        self.setFixedWidth(WIDTH)
        self.setStyleSheet(
            f"UploadSplash {{ background: {theme.CANVAS};"
            f" border: 1px solid {theme.HAIRLINE_STRONG}; }}")

        lay = QVBoxLayout(self)
        lay.setContentsMargins(PAD, PAD, PAD, PAD)
        lay.setSpacing(0)

        # looping mark (WebP baked on #181818 — blends into the canvas).
        # We scale each frame ourselves with a *smooth* transform, at device-
        # pixel resolution: QMovie's built-in setScaledSize scaler is not
        # smooth (that's what made it look pixelated), whereas Qt.SmoothTrans-
        # formation from the native-res source looks like the source video.
        # A fixed logo size also keeps the layout deterministic for centering.
        self._movie = QMovie(str(theme.LOOP_WEBP))
        self._movie.setCacheMode(QMovie.CacheMode.CacheAll)
        self._disp = _fit_height(QImageReader(str(theme.LOOP_WEBP)).size(), LOGO_H)
        self._logo = QLabel(self)
        self._logo.setFixedSize(self._disp)
        self._logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._movie.frameChanged.connect(self._render_frame)
        self._movie.jumpToFrame(0)
        self._render_frame()
        lay.addWidget(self._logo, 0, Qt.AlignmentFlag.AlignHCenter)

        lay.addSpacing(10)
        wordmark = QLabel("SanGit", self)
        wordmark.setFont(theme.wordmark_font(19))
        wordmark.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(wordmark)

        lay.addSpacing(18)
        self._headline = QLabel("Uploading your version…", self)
        self._headline.setObjectName("headline")
        self._headline.setFont(theme.font("display", 13))
        self._headline.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(self._headline)

        lay.addSpacing(4)
        self._sub = QLabel(
            "Hang tight — this is normal and only takes a moment.", self)
        self._sub.setObjectName("sub")
        self._sub.setFont(theme.font("body", 10))
        self._sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._sub.setWordWrap(True)
        lay.addWidget(self._sub)

        lay.addSpacing(8)
        self._flnote = QLabel(
            "FL Studio may open briefly to export your audio. Don't close it.",
            self)
        self._flnote.setFont(theme.font("body", 9))
        self._flnote.setStyleSheet(f"color: {theme.INK_TERTIARY};")
        self._flnote.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._flnote.setWordWrap(True)
        lay.addWidget(self._flnote)

        lay.addSpacing(26)
        # indeterminate sweep bar: a bright segment gliding across a hairline
        # track (same visual family as the toast's draining countdown).
        self._track = QFrame(self)
        self._track.setFixedSize(BAR_W, 2)
        self._track.setStyleSheet(f"background: {theme.SURFACE_2};")
        self._seg = QFrame(self._track)
        self._seg.setFixedSize(SEG_W, 2)
        self._seg.setStyleSheet(f"background: {theme.PRIMARY};")
        self._seg.move(-SEG_W, 0)
        lay.addWidget(self._track, 0, Qt.AlignmentFlag.AlignHCenter)

        self._sweep = QVariantAnimation(self)
        self._sweep.setStartValue(0.0)
        self._sweep.setEndValue(1.0)
        self._sweep.setDuration(LOOP_MS)
        self._sweep.setLoopCount(-1)
        self._sweep.setEasingCurve(QEasingCurve.Type.InOutSine)
        self._sweep.valueChanged.connect(self._on_sweep)

        self._fade = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade.setDuration(160)
        self._fade.setEasingCurve(QEasingCurve.Type.OutCubic)

    # ---- logo frame scaling (smooth, HiDPI-aware) ----
    def _render_frame(self, *_):
        pm = self._movie.currentPixmap()
        if pm.isNull():
            return
        dpr = self.devicePixelRatioF() or 1.0
        tgt = QSize(round(self._disp.width() * dpr),
                    round(self._disp.height() * dpr))
        scaled = pm.scaled(tgt, Qt.AspectRatioMode.KeepAspectRatio,
                           Qt.TransformationMode.SmoothTransformation)
        scaled.setDevicePixelRatio(dpr)
        self._logo.setPixmap(scaled)

    # ---- sweep bar ----
    def _on_sweep(self, phase: float):
        # travel from just off the left edge to just off the right edge; the
        # InOutSine ease happens while the segment is off-screen, so the
        # visible pass reads as a smooth swoosh with a brief rest between.
        x = int(phase * (BAR_W + SEG_W) - SEG_W)
        self._seg.move(x, 0)

    # ---- lifecycle ----
    def show_centered(self):
        self._closing = False  # allow reuse after a previous done/failed close
        self.adjustSize()  # deterministic: fixed width + fixed logo/label sizes
        screen = (QGuiApplication.screenAt(QCursor.pos())
                  or QGuiApplication.primaryScreen())
        geo = screen.availableGeometry()
        self.move(geo.center().x() - self.width() // 2,
                  geo.center().y() - self.height() // 2)
        self.setWindowOpacity(0.0)
        self.show()
        self.raise_()
        self.activateWindow()
        self._movie.start()
        self._sweep.start()
        self._fade.stop()
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.start()

    def set_state(self, state: str):
        """'uploading' | 'exporting' | 'done' | 'failed'. The two active states
        fully restore the look (so the window is reusable across commits and
        renders); done/failed stop the sweep and auto-close. The FL heads-up
        only shows while exporting — the one moment FL actually reopens."""
        if state in ("uploading", "exporting"):
            self._phase = state
            self._headline.setStyleSheet("")  # fall back to the qss #headline rule
            if state == "uploading":
                self._headline.setText("Uploading your version…")
                self._sub.setText(
                    "Hang tight — this is normal and only takes a moment.")
                self._flnote.hide()
            else:  # exporting — FL is about to relaunch to render
                self._headline.setText("Exporting your audio…")
                self._sub.setText(
                    "FL Studio will open briefly to render — this is normal.")
                self._flnote.setText(
                    "Don't close FL — it closes itself when finished.")
                self._flnote.show()
            self._seg.show()
            self._sweep.start()
            return
        self._sweep.stop()
        self._seg.hide()
        self._flnote.hide()
        if state == "done":
            self._headline.setText("Done ✓")
            self._headline.setStyleSheet(f"color: {theme.SUCCESS};")
            self._sub.setText("Your audio is ready." if self._phase == "exporting"
                              else "Your version is saved.")
            QTimer.singleShot(900, self.close)
        elif state == "failed":
            self._headline.setText("Export failed" if self._phase == "exporting"
                                   else "Upload failed")
            self._headline.setStyleSheet(f"color: {theme.WARNING};")
            self._sub.setText("We'll keep retrying in the background.")
            QTimer.singleShot(1800, self.close)

    def closeEvent(self, event):
        if not self._closing:
            self._closing = True
            self._movie.stop()
            self._sweep.stop()
        super().closeEvent(event)
