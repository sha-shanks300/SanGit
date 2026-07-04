"""First-run setup dialog: API URL, pairing code, watch folder, FL path."""

import logging
import tkinter as tk
from tkinter import filedialog, messagebox

import config
from api_client import ApiClient, ApiError

log = logging.getLogger("sangit.pairing")

BG = "#08090a"
BG2 = "#0f1011"
INK = "#f7f8f8"
SUBTLE = "#8a8f98"
PRIMARY = "#5e6ad2"
HAIRLINE = "#23252a"


def _field(root, label: str, initial: str = "") -> tk.Entry:
    tk.Label(root, text=label, bg=BG, fg=SUBTLE, font=("Segoe UI", 9)
             ).pack(anchor="w", padx=20, pady=(10, 2))
    entry = tk.Entry(root, bg=BG2, fg=INK, insertbackground=INK, relief="flat",
                     font=("Segoe UI", 10), highlightthickness=1,
                     highlightbackground=HAIRLINE, highlightcolor=PRIMARY)
    entry.pack(fill="x", padx=20, ipady=6)
    entry.insert(0, initial)
    return entry


def run_setup(cfg: dict) -> bool:
    """Shows the setup window; returns True once paired + configured."""
    done = {"ok": False}
    root = tk.Tk()
    root.title("SanGit setup")
    root.configure(bg=BG)
    root.attributes("-topmost", True)
    root.geometry("460x430")
    root.resizable(False, False)

    tk.Label(root, text="Pair this computer", bg=BG, fg=INK,
             font=("Segoe UI", 14, "bold")).pack(anchor="w", padx=20, pady=(18, 0))
    tk.Label(root, text="Generate a code on the web app under Settings → Devices.",
             bg=BG, fg=SUBTLE, font=("Segoe UI", 9)).pack(anchor="w", padx=20)

    api_entry = _field(root, "Web app URL", cfg.get("api_url") or "https://")
    code_entry = _field(root, "Pairing code (e.g. 7KFM-2XQ9)")

    folder_var = tk.StringVar(value=(cfg.get("watch_folders") or [""])[0])
    tk.Label(root, text="FL Studio projects folder to watch", bg=BG, fg=SUBTLE,
             font=("Segoe UI", 9)).pack(anchor="w", padx=20, pady=(10, 2))
    row = tk.Frame(root, bg=BG)
    row.pack(fill="x", padx=20)
    folder_entry = tk.Entry(row, textvariable=folder_var, bg=BG2, fg=INK,
                            insertbackground=INK, relief="flat", font=("Segoe UI", 10),
                            highlightthickness=1, highlightbackground=HAIRLINE,
                            highlightcolor=PRIMARY)
    folder_entry.pack(side="left", fill="x", expand=True, ipady=6)
    tk.Button(row, text="Browse…", relief="flat", bg=BG2, fg=INK,
              activebackground=HAIRLINE, activeforeground=INK,
              command=lambda: folder_var.set(
                  filedialog.askdirectory() or folder_var.get())
              ).pack(side="left", padx=(8, 0))

    fl_entry = _field(root, "FL Studio executable", cfg.get("fl_executable", ""))

    def submit():
        api_url = api_entry.get().strip().rstrip("/")
        code = code_entry.get().strip()
        folder = folder_var.get().strip()
        if not api_url or not code or not folder:
            messagebox.showerror("SanGit", "URL, pairing code and folder are required.")
            return
        try:
            client = ApiClient(api_url)
            result = client.pair(code, cfg.get("device_name", "Studio PC"))
        except ApiError as e:
            messagebox.showerror("SanGit", f"Pairing failed:\n{e}")
            return
        cfg["api_url"] = api_url
        cfg["device_token"] = result["device_token"]
        cfg["watch_folders"] = [folder]
        cfg["fl_executable"] = fl_entry.get().strip() or cfg["fl_executable"]
        config.save(cfg)
        done["ok"] = True
        root.destroy()

    tk.Button(root, text="Pair device", command=submit, bg=PRIMARY, fg="white",
              activebackground="#828fff", activeforeground="white", relief="flat",
              font=("Segoe UI", 10, "bold"), padx=18, pady=6
              ).pack(anchor="e", padx=20, pady=18)

    root.mainloop()
    return done["ok"]
