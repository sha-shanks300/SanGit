"""HTTP client for the SanGit ingest API. Raises ApiError on failures so
workers can decide between retry (network/5xx) and give-up (4xx)."""

import requests


class ApiError(Exception):
    def __init__(self, message: str, status: int | None = None, retryable: bool = True):
        super().__init__(message)
        self.status = status
        self.retryable = retryable


class ApiClient:
    def __init__(self, api_url: str, device_token: str = ""):
        self.api_url = api_url.rstrip("/")
        self.device_token = device_token

    def _post(self, path: str, payload: dict, authed: bool = True) -> dict:
        headers = {"Content-Type": "application/json"}
        if authed:
            headers["Authorization"] = f"Bearer {self.device_token}"
        try:
            resp = requests.post(f"{self.api_url}{path}", json=payload,
                                 headers=headers, timeout=30)
        except requests.RequestException as e:
            raise ApiError(f"network error: {e}") from e
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("error", resp.text[:200])
            except ValueError:
                detail = resp.text[:200]
            raise ApiError(f"{resp.status_code}: {detail}", status=resp.status_code,
                           retryable=resp.status_code >= 500)
        return resp.json()

    def ping(self) -> dict:
        """Raises ApiError(status=401) when the device has been revoked."""
        try:
            resp = requests.get(
                f"{self.api_url}/api/ingest/ping",
                headers={"Authorization": f"Bearer {self.device_token}"},
                timeout=10,
            )
        except requests.RequestException as e:
            raise ApiError(f"network error: {e}") from e
        if resp.status_code >= 400:
            raise ApiError(f"ping failed: {resp.status_code}",
                           status=resp.status_code,
                           retryable=resp.status_code >= 500)
        return resp.json()

    def pair(self, code: str, device_name: str) -> dict:
        return self._post("/api/devices/pair",
                          {"code": code, "device_name": device_name}, authed=False)

    def init_upload(self, project_id: str, project_title: str, file_name: str,
                    sha256: str, size: int) -> dict:
        return self._post("/api/ingest/init-upload", {
            "project_id": project_id,
            "project_title": project_title,
            "file_name": file_name,
            "sha256": sha256,
            "size": size,
        })

    def complete(self, version_id: str, project_id: str, branch_id: str,
                 file_name: str, sha256: str, storage_path: str,
                 display_name: str | None) -> dict:
        return self._post("/api/ingest/complete", {
            "version_id": version_id,
            "project_id": project_id,
            "branch_id": branch_id,
            "file_name": file_name,
            "sha256": sha256,
            "storage_path": storage_path,
            "display_name": display_name,
        })

    def audio_init(self, version_id: str) -> dict:
        return self._post(f"/api/ingest/audio/{version_id}", {"phase": "init"})

    def audio_complete(self, version_id: str, duration_secs: float | None) -> dict:
        return self._post(f"/api/ingest/audio/{version_id}",
                          {"phase": "complete", "duration_secs": duration_secs})

    def audio_failed(self, version_id: str, error: str) -> dict:
        return self._post(f"/api/ingest/audio/{version_id}",
                          {"phase": "failed", "error": error})

    @staticmethod
    def upload_file(upload_url: str, file_path: str, content_type: str) -> None:
        with open(file_path, "rb") as f:
            try:
                resp = requests.put(
                    upload_url, data=f,
                    headers={"Content-Type": content_type, "x-upsert": "true"},
                    timeout=600,
                )
            except requests.RequestException as e:
                raise ApiError(f"upload network error: {e}") from e
        if resp.status_code not in (200, 201):
            raise ApiError(f"upload failed: {resp.status_code} {resp.text[:200]}",
                           status=resp.status_code, retryable=True)
