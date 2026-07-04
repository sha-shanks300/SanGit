"""Simulates a local-service commit against the ingest API, end to end.

Proves API + storage + device auth before/without the tray service:

    python scripts/test_ingest.py --api http://localhost:3000 --pair CODE1234
    python scripts/test_ingest.py --api http://localhost:3000 --token sgd_... path/to/test.flp

With --pair it exchanges a dashboard pairing code for a device token and
prints it. With --token it runs a full commit: init-upload -> PUT .flp ->
complete (and optionally the audio phases with --mp3).
"""

import argparse
import hashlib
import json
import sys
import urllib.request
import uuid
from pathlib import Path


def post_json(url: str, payload: dict, token: str | None = None) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def put_file(url: str, path: Path, content_type: str) -> None:
    req = urllib.request.Request(
        url,
        data=path.read_bytes(),
        headers={"Content-Type": content_type, "x-upsert": "true"},
        method="PUT",
    )
    with urllib.request.urlopen(req) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f"upload failed: {resp.status}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", required=True, help="web app origin, e.g. http://localhost:3000")
    ap.add_argument("--pair", help="pairing code from /settings/devices")
    ap.add_argument("--token", help="device token (sgd_...)")
    ap.add_argument("--project-id", help="project UUID (defaults to a fresh one)")
    ap.add_argument("--mp3", help="optional mp3 to attach after the flp commit")
    ap.add_argument("flp", nargs="?", help="path to a .flp file to commit")
    args = ap.parse_args()

    if args.pair:
        out = post_json(
            f"{args.api}/api/devices/pair",
            {"code": args.pair, "device_name": "test-script"},
        )
        print("device_token:", out["device_token"])
        return

    if not args.token or not args.flp:
        ap.error("--token and a .flp path are required (or use --pair)")

    flp = Path(args.flp)
    sha256 = hashlib.sha256(flp.read_bytes()).hexdigest()
    project_id = args.project_id or str(uuid.uuid4())

    init = post_json(
        f"{args.api}/api/ingest/init-upload",
        {
            "project_id": project_id,
            "project_title": flp.parent.name or "Test Project",
            "file_name": flp.name,
            "sha256": sha256,
            "size": flp.stat().st_size,
        },
        token=args.token,
    )
    print("init-upload:", json.dumps(init, indent=2))
    if init.get("duplicate"):
        print("no change since branch tip — nothing uploaded")
        return

    put_file(init["upload_url"], flp, "application/octet-stream")
    print("flp uploaded")

    done = post_json(
        f"{args.api}/api/ingest/complete",
        {
            "version_id": init["version_id"],
            "project_id": project_id,
            "branch_id": init["branch_id"],
            "file_name": flp.name,
            "sha256": sha256,
            "storage_path": init["storage_path"],
        },
        token=args.token,
    )
    print("complete:", done)

    if args.mp3:
        mp3 = Path(args.mp3)
        audio_url = f"{args.api}/api/ingest/audio/{init['version_id']}"
        a = post_json(audio_url, {"phase": "init"}, token=args.token)
        put_file(a["upload_url"], mp3, "audio/mpeg")
        print("mp3 uploaded")
        print("audio complete:", post_json(audio_url, {"phase": "complete", "duration_secs": 0}, token=args.token))

    print(f"\nproject_id for repeat runs: {project_id}")


if __name__ == "__main__":
    sys.exit(main())
