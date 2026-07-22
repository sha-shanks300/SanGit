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
        "--icon", "assets/logoapp.ico",  # branded exe + shortcut icon
        # the toast/settings/tray UI is PySide6; ship the logo asset and
        # skip the heavy Qt modules the service never imports
        "--add-data", "assets;assets",
        "--exclude-module", "PySide6.QtWebEngineCore",
        "--exclude-module", "PySide6.QtWebEngineWidgets",
        "--exclude-module", "PySide6.QtQml",
        "--exclude-module", "PySide6.QtQuick",
        "--exclude-module", "PySide6.QtPdf",
        "--exclude-module", "PySide6.Qt3DCore",
        "main.py",
    ],
    check=True,
)
print("\nBuilt dist/SanGit.exe")
print("To start with Windows, run: python install_startup.py")
