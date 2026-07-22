"""Builds SanGitSetup.exe — the packaged onefile exe wrapped in an Inno Setup
installer.

    .venv\\Scripts\\python build_installer.py

Steps: (1) run build_exe.py to produce dist/SanGit.exe, (2) compile
installer/SanGit.iss with Inno Setup, stamping the version from version.py.

Requires Inno Setup 6 installed (provides ISCC.exe) — a free download:
https://jrsoftware.org/isdl.php
"""

import shutil
import subprocess
import sys
from pathlib import Path

import version

HERE = Path(__file__).resolve().parent
ISS = HERE / "installer" / "SanGit.iss"


def find_iscc() -> str | None:
    exe = shutil.which("ISCC")
    if exe:
        return exe
    for base in (r"C:\Program Files (x86)\Inno Setup 6",
                 r"C:\Program Files\Inno Setup 6"):
        candidate = Path(base) / "ISCC.exe"
        if candidate.exists():
            return str(candidate)
    return None


def main() -> None:
    # 1. build the onefile exe (paths in build_exe.py are relative to service/)
    subprocess.run([sys.executable, str(HERE / "build_exe.py")],
                   check=True, cwd=HERE)

    # 2. compile the installer
    iscc = find_iscc()
    if not iscc:
        print("\nERROR: Inno Setup (ISCC.exe) not found. Install the free "
              "Inno Setup 6 from https://jrsoftware.org/isdl.php, then re-run.")
        sys.exit(1)

    subprocess.run(
        [iscc, f"/DAppVersion={version.__version__}", str(ISS)], check=True)

    out = HERE / "dist" / "SanGitSetup.exe"
    print(f"\nBuilt {out}")
    print("Publish it:")
    print(f'  gh release create v{version.__version__} "{out}" '
          f'--title "SanGit v{version.__version__}"')


if __name__ == "__main__":
    main()
