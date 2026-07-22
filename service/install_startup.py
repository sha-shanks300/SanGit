"""Registers SanGit to run at login (HKCU Run key — no admin needed).

    python install_startup.py            # register dist/SanGit.exe (or this python + main.py)
    python install_startup.py --remove   # unregister
"""

import sys
import winreg
from pathlib import Path

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
NAME = "SanGit"


def command() -> str:
    # When frozen (packaged .exe), sys.executable IS SanGit.exe — the thing to
    # launch at login. From source, launch pythonw main.py.
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'
    exe = Path(__file__).parent / "dist" / "SanGit.exe"
    if exe.exists():
        return f'"{exe}"'
    py = Path(sys.executable).parent / "pythonw.exe"
    interp = py if py.exists() else Path(sys.executable)
    return f'"{interp}" "{Path(__file__).parent / "main.py"}"'


def ensure_registered() -> bool:
    """Idempotently point the login Run key at the current binary, self-healing
    if the .exe was moved. Returns True when it wrote a new/changed value.
    Called on every packaged startup so first run 'just works'."""
    cmd = command()
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0,
                        winreg.KEY_READ | winreg.KEY_SET_VALUE) as key:
        try:
            existing, _ = winreg.QueryValueEx(key, NAME)
        except FileNotFoundError:
            existing = None
        if existing == cmd:
            return False
        winreg.SetValueEx(key, NAME, 0, winreg.REG_SZ, cmd)
        return True


def main() -> None:
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0,
                        winreg.KEY_SET_VALUE) as key:
        if "--remove" in sys.argv:
            try:
                winreg.DeleteValue(key, NAME)
                print("SanGit removed from startup.")
            except FileNotFoundError:
                print("SanGit was not registered.")
        else:
            cmd = command()
            winreg.SetValueEx(key, NAME, 0, winreg.REG_SZ, cmd)
            print(f"SanGit will start at login: {cmd}")


if __name__ == "__main__":
    main()
