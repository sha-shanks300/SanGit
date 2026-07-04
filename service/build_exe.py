"""Builds SanGit.exe with PyInstaller.

    .venv\\Scripts\\python -m pip install pyinstaller
    .venv\\Scripts\\python build_exe.py

Output: dist/SanGit.exe (windowless tray app).
"""

import subprocess
import sys

subprocess.run(
    [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--noconsole",
        "--name", "SanGit",
        "--clean",
        # pystray/PIL backends that PyInstaller misses:
        "--hidden-import", "pystray._win32",
        "--hidden-import", "PIL.ImageDraw",
        "main.py",
    ],
    check=True,
)
print("\nBuilt dist/SanGit.exe")
print("To start with Windows, run: python install_startup.py")
