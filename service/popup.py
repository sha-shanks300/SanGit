"""Commit prompt: a topmost tkinter dialog with an optional version-name
field. Auto-dismisses (= skip) after a timeout. One popup at a time —
additional saves queue behind it."""

import logging
import queue
import threading
import tkinter as tk
from pathlib import Path
from typing import Callable

log = logging.getLogger("sangit.popup")

BG = "#08090a"
BG2 = "#0f1011"
INK = "#f7f8f8"
SUBTLE = "#8a8f98"
PRIMARY = "#5e6ad2"
HAIRLINE = "#23252a"


class PopupManager:
    """Runs a worker thread that shows one dialog at a time."""

    def __init__(self, on_commit: Callable[[str, str | None], None],
                 timeout_secs: int = 30):
        self._on_commit = on_commit
        self._timeout = timeout_secs
        self._queue: queue.Queue[str] = queue.Queue()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def ask(self, flp_path: str):
        self._queue.put(flp_path)

    def _worker(self):
        while True:
            flp_path = self._queue.get()
            try:
                result = self._show_dialog(flp_path)
            except Exception:
                log.exception("popup failed for %s", flp_path)
                continue
            if result is not None:
                self._on_commit(flp_path, result or None)

    def _show_dialog(self, flp_path: str) -> str | None:
        """Returns the (possibly empty) version name on commit, None on skip."""
        outcome: dict = {"result": None}
        root = tk.Tk()
        root.title("SanGit")
        root.configure(bg=BG)
        root.attributes("-topmost", True)
        root.resizable(False, False)

        # Bottom-right placement, near the tray.
        w, h = 380, 190
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{w}x{h}+{sw - w - 24}+{sh - h - 80}")

        name = Path(flp_path).name
        tk.Label(root, text="Commit new version?", bg=BG, fg=INK,
                 font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=18, pady=(16, 2))
        tk.Label(root, text=name, bg=BG, fg=SUBTLE,
                 font=("Consolas", 10)).pack(anchor="w", padx=18)

        entry = tk.Entry(root, bg=BG2, fg=INK, insertbackground=INK,
                         relief="flat", font=("Segoe UI", 10),
                         highlightthickness=1, highlightbackground=HAIRLINE,
                         highlightcolor=PRIMARY)
        entry.pack(fill="x", padx=18, pady=(14, 0), ipady=6)
        entry.insert(0, "")
        placeholder = tk.Label(root, text="Version name (optional)", bg=BG, fg=SUBTLE,
                               font=("Segoe UI", 8))
        placeholder.pack(anchor="w", padx=18)

        def commit(_=None):
            outcome["result"] = entry.get().strip()
            root.destroy()

        def skip(_=None):
            outcome["result"] = None
            root.destroy()

        btns = tk.Frame(root, bg=BG)
        btns.pack(fill="x", padx=18, pady=(10, 14))
        tk.Button(btns, text="Skip", command=skip, bg=BG2, fg=INK,
                  activebackground=HAIRLINE, activeforeground=INK,
                  relief="flat", font=("Segoe UI", 10), padx=14, pady=4
                  ).pack(side="right", padx=(8, 0))
        tk.Button(btns, text="Commit", command=commit, bg=PRIMARY, fg="white",
                  activebackground="#828fff", activeforeground="white",
                  relief="flat", font=("Segoe UI", 10, "bold"), padx=14, pady=4
                  ).pack(side="right")

        root.bind("<Return>", commit)
        root.bind("<Escape>", skip)
        root.after(self._timeout * 1000, skip)
        entry.focus_force()
        root.mainloop()
        return outcome["result"]
