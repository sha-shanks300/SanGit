"""Single source of truth for the app version.

Shown in the status window, logged at startup, and used as the GitHub Release
tag (v{__version__}). Bump this and re-cut a Release to ship an update; keep
apps/web/src/lib/app-version.ts in sync so the download popup shows the same
number.
"""

__version__ = "0.1.0"
