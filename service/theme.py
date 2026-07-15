"""Shared visual tokens + Qt helpers for the tray service UI.

Mirrors apps/web/DESIGN.md (Ferrari-derived dark editorial system): canvas
#181818, brightness-step surfaces with 1px hairlines, sharp 0px corners,
Rosso Corsa #da291c reserved for the primary CTA and the mark, yellow focus
ring, display/body/mono type tiers at weight 400 (never bold).
"""

import ctypes
import logging
import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont, QFontDatabase, QIcon, QPainter, QPen, QPixmap
from PySide6.QtWidgets import QLabel, QWidget

log = logging.getLogger("sangit.theme")

LOGO_PNG = Path(__file__).resolve().parent / "assets" / "logoapp.png"

# ---- color tokens (DESIGN.md) ----
CANVAS = "#181818"
SURFACE_1 = "#202020"
SURFACE_2 = "#303030"
SURFACE_3 = "#3c3c3c"
SURFACE_4 = "#484848"
HAIRLINE = "#303030"
HAIRLINE_STRONG = "#3c3c3c"
HAIRLINE_TERTIARY = "#4a4a4a"
INK = "#ffffff"
INK_MUTED = "#969696"
INK_SUBTLE = "#8f8f8f"
INK_TERTIARY = "#666666"
PRIMARY = "#da291c"
PRIMARY_HOVER = "#9d2211"
PRIMARY_ACTIVE = "#b01e0a"
FOCUS = "#f6e500"
WARNING = "#f13a2c"

_families: dict | None = None


def families() -> dict:
    """Preferred font families per type tier: the brand faces when
    installed (Space Grotesk / Inter / JetBrains Mono), stock Windows
    fallbacks otherwise. Requires a QApplication."""
    global _families
    if _families is None:
        installed = set(QFontDatabase.families())

        def pick(*names: str) -> str:
            return next((n for n in names if n in installed), names[-1])

        _families = {
            "display": pick("Space Grotesk", "Segoe UI"),
            "body": pick("Inter", "Segoe UI"),
            "mono": pick("JetBrains Mono", "Cascadia Mono", "Consolas"),
        }
    return _families


def font(tier: str, size_pt: int, letter_spacing: float = 0.0) -> QFont:
    f = QFont(families()[tier], size_pt)
    f.setWeight(QFont.Weight.Normal)  # the brand never bolds
    if letter_spacing:
        f.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, letter_spacing)
    return f


def qss() -> str:
    """Global stylesheet: sharp corners everywhere, hairline borders,
    Rosso Corsa only on the primary CTA, yellow focus ring on inputs."""
    b, m = families()["body"], families()["mono"]
    return f"""
/* color/font only on the generic selector — a background here would make
   every child widget repaint over its parent surface */
QWidget {{ color: {INK}; font-family: "{b}"; }}
QDialog {{ background: {CANVAS}; }}
QLabel#title {{ color: {INK}; }}
QLabel#headline {{ color: {INK}; }}
QLabel#sub {{ color: {INK_MUTED}; }}
QLabel#filename {{ color: {INK_MUTED}; font-family: "{m}"; }}
QLabel#eyebrow {{ color: {INK_SUBTLE}; font-family: "{m}"; }}
QLabel#markdot {{ color: {PRIMARY}; }}
QLabel#error {{ color: {WARNING}; }}

QLineEdit {{
    background: {CANVAS}; color: {INK};
    border: 1px solid {HAIRLINE_STRONG}; border-radius: 0;
    padding: 8px 10px; selection-background-color: {SURFACE_4};
}}
QLineEdit:focus {{ border: 1px solid {FOCUS}; }}

QPushButton {{ border-radius: 0; padding: 8px 20px; border: none; }}
QPushButton#primary {{ background: {PRIMARY}; color: {INK}; font-weight: 500; }}
QPushButton#primary:hover {{ background: {PRIMARY_HOVER}; }}
QPushButton#primary:pressed {{ background: {PRIMARY_ACTIVE}; }}
QPushButton#primary:disabled {{ background: {SURFACE_3}; color: {INK_SUBTLE}; }}
QPushButton#ghost {{ background: transparent; color: {INK_MUTED}; padding: 8px 14px; }}
QPushButton#ghost:hover {{ background: {SURFACE_2}; color: {INK}; }}
QPushButton#outline {{
    background: transparent; color: {INK};
    border: 1px solid {INK}; padding: 7px 14px;
}}
QPushButton#outline:hover {{ background: {SURFACE_1}; }}

QMenu {{ background: {SURFACE_3}; color: {INK}; border: 1px solid {HAIRLINE_TERTIARY}; padding: 4px 0; }}
QMenu::item {{ padding: 7px 24px; background: transparent; }}
QMenu::item:selected {{ background: {SURFACE_4}; }}
QMenu::item:disabled {{ color: {INK_SUBTLE}; }}
QMenu::separator {{ height: 1px; background: {HAIRLINE_TERTIARY}; margin: 4px 0; }}
QMenu::indicator:checked {{ background: {PRIMARY}; width: 6px; height: 6px; margin-left: 9px; }}

QToolTip {{ background: {SURFACE_3}; color: {INK}; border: 1px solid {HAIRLINE_TERTIARY}; }}
"""


def eyebrow_row(text: str, parent: QWidget | None = None) -> QWidget:
    """Mono uppercase eyebrow with the Rosso Corsa mark-dot — the dialog
    equivalent of the wordmark glyph."""
    from PySide6.QtWidgets import QHBoxLayout

    row = QWidget(parent)
    lay = QHBoxLayout(row)
    lay.setContentsMargins(0, 0, 0, 0)
    lay.setSpacing(6)
    dot = QLabel("●", row)
    dot.setObjectName("markdot")
    dot.setFont(font("mono", 6))
    label = QLabel(text.upper(), row)
    label.setObjectName("eyebrow")
    label.setFont(font("mono", 8, letter_spacing=0.28))
    lay.addWidget(dot)
    lay.addWidget(label)
    lay.addStretch(1)
    return row


def field_label(text: str, parent: QWidget | None = None) -> QLabel:
    """Field caption: mono uppercase, ink-subtle (eyebrow treatment)."""
    label = QLabel(text.upper(), parent)
    label.setObjectName("eyebrow")
    label.setFont(font("mono", 8, letter_spacing=0.28))
    return label


def app_icon() -> QIcon:
    """The SanGit mark (assets/logoapp.png) for the tray, title bars and
    taskbar; falls back to a QPainter redraw of the mark if the asset is
    gone."""
    if LOGO_PNG.exists():
        pm = QPixmap(str(LOGO_PNG))
        if not pm.isNull():
            side = max(pm.width(), pm.height())
            square = QPixmap(side, side)
            square.fill(Qt.GlobalColor.transparent)
            p = QPainter(square)
            p.drawPixmap((side - pm.width()) // 2, (side - pm.height()) // 2, pm)
            p.end()
            return QIcon(square)
    log.warning("logoapp.png missing — using drawn mark")
    return QIcon(_drawn_mark(256))


def app_icon_dimmed() -> QIcon:
    """Faded variant of the mark for the tray while watching is paused."""
    pm = app_icon().pixmap(256, 256)
    out = QPixmap(pm.size())
    out.fill(Qt.GlobalColor.transparent)
    p = QPainter(out)
    p.setOpacity(0.35)
    p.drawPixmap(0, 0, pm)
    p.end()
    return QIcon(out)


def _drawn_mark(size: int) -> QPixmap:
    """Vector fallback of the mark — the beamed double eighth-note commit
    graph (same geometry as the web app's LogoMark)."""
    pm = QPixmap(size, size)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    s = size / 110.0
    ink = QColor(242, 242, 242)
    p.setPen(QPen(ink, 5 * s, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
    edges = [
        ((26, 19), (98, 6)), ((26, 19), (61, 33)), ((61, 33), (89, 28)),
        ((89, 28), (98, 6)), ((70, 21), (61, 33)), ((70, 21), (89, 28)),
        ((26, 19), (26, 79)), ((35, 38), (61, 33)), ((35, 38), (35, 57)),
        ((35, 57), (26, 71)),
        ((98, 6), (97, 76)), ((89, 28), (90, 43)), ((90, 43), (97, 52)),
    ]
    for (x1, y1), (x2, y2) in edges:
        p.drawLine(int(x1 * s), int(y1 * s), int(x2 * s), int(y2 * s))
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(ink)
    for cx, cy, r in [(19, 91, 15), (83, 88, 14), (26, 19, 4.5), (98, 6, 4.5),
                      (61, 33, 4), (89, 28, 4), (35, 38, 3.5), (35, 57, 3),
                      (26, 71, 3), (90, 43, 3), (97, 52, 3)]:
        p.drawEllipse(int((cx - r) * s), int((cy - r) * s),
                      int(2 * r * s), int(2 * r * s))
    p.setBrush(QColor(218, 41, 28))
    cx, cy, r = 70, 21, 5.5  # accent node on the beam
    p.drawEllipse(int((cx - r) * s), int((cy - r) * s),
                  int(2 * r * s), int(2 * r * s))
    p.end()
    return pm


def dark_titlebar(widget: QWidget):
    """Ask DWM for a dark title bar so the window chrome matches the canvas
    (Windows 10 1809+; silently no-ops elsewhere)."""
    if sys.platform != "win32":
        return
    try:
        hwnd = int(widget.winId())
        value = ctypes.c_int(1)
        for attr in (20, 19):  # DWMWA_USE_IMMERSIVE_DARK_MODE (19 pre-20H1)
            if ctypes.windll.dwmapi.DwmSetWindowAttribute(
                    hwnd, attr, ctypes.byref(value), ctypes.sizeof(value)) == 0:
                break
    except Exception:
        pass
