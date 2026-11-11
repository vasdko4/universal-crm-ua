#!/usr/bin/env python3
"""Tiny internal-only HTTP sidecar that lets the admin panel trigger a
self-update ("docker compose pull && up -d app") without ever giving the
main `app` container access to the Docker socket.

Runs as its own docker-compose service (see docker-compose.yml, service
`updater`) with the Docker socket mounted read-write and this repo's
docker-compose.yml mounted read-only. Not published to the host — only
reachable from other containers on the compose network, and only accepts
requests carrying the shared UPDATER_SECRET.

Endpoints:
  GET  /health  -> 200 "ok"                      (no auth, for healthchecks)
  POST /update  -> 202 {"status":"started"}      (requires X-Updater-Secret)
                   kicks off `docker compose pull app && up -d app` in a
                   background thread and returns immediately; the caller
                   (admin panel) doesn't wait for the pull/restart to finish.
"""

import hmac
import os
import subprocess
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("UPDATER_SECRET", "")
PORT = int(os.environ.get("PORT", "8787"))
# Default to loopback so CodeQL BindToAllInterfaces is clean. Docker Compose
# overrides BIND_HOST=0.0.0.0 so the sidecar is reachable on the compose network.
BIND_HOST = os.environ.get("BIND_HOST", "127.0.0.1")
COMPOSE_FILE = os.environ.get("COMPOSE_FILE", "/workspace/docker-compose.yml")
PROJECT_DIR = os.environ.get("COMPOSE_PROJECT_DIR", "/workspace")
SERVICE = os.environ.get("APP_SERVICE", "app")

COMPOSE_BASE = ["docker", "compose", "-f", COMPOSE_FILE, "--project-directory", PROJECT_DIR]

_lock = threading.Lock()
_running = False


def run_update() -> None:
    global _running
    with _lock:
        if _running:
            return
        _running = True
    try:
        print("[updater] pulling latest image...", flush=True)
        pull = subprocess.run(COMPOSE_BASE + ["pull", SERVICE], check=False)
        print(f"[updater] pull exit={pull.returncode}", flush=True)
        print("[updater] recreating service...", flush=True)
        up = subprocess.run(COMPOSE_BASE + ["up", "-d", SERVICE], check=False)
        print(f"[updater] up exit={up.returncode}", flush=True)
        if pull.returncode == 0 and up.returncode == 0:
            print("[updater] done: success", flush=True)
        else:
            print("[updater] done: failure", flush=True)
    finally:
        with _lock:
            _running = False


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, body: bytes) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(200, b'{"status":"ok"}')
        else:
            self._json(404, b'{"error":"not_found"}')

    def _log_update(self, result: str) -> None:
        # Audit log for every update request (audit F3, 3.4.95): timestamp +
        # source + result. stdout is the sidecar's only log sink.
        ts = datetime.now(timezone.utc).isoformat()
        print(f"[updater] {ts} update {result} from {self.client_address[0]}", flush=True)

    def do_POST(self) -> None:
        if self.path != "/update":
            self._json(404, b'{"error":"not_found"}')
            return
        if not SECRET:
            self._log_update("rejected: not_configured")
            self._json(503, b'{"error":"not_configured"}')
            return
        # Constant-time compare (audit F3, 3.4.95) — plain != leaks the
        # secret through timing.
        if not hmac.compare_digest(self.headers.get("X-Updater-Secret") or "", SECRET):
            self._log_update("rejected: unauthorized")
            self._json(401, b'{"error":"unauthorized"}')
            return
        self._log_update("accepted")
        threading.Thread(target=run_update, daemon=True).start()
        self._json(202, b'{"status":"started"}')

    def log_message(self, fmt: str, *args) -> None:  # noqa: A002
        print("[updater] " + (fmt % args), flush=True)


if __name__ == "__main__":
    print(f"[updater] listening on {BIND_HOST}:{PORT}", flush=True)
    # HTTP on the internal compose network only — the port is not published
    # to the host. TLS would add nothing between two containers.
    ThreadingHTTPServer((BIND_HOST, PORT), Handler).serve_forever()  # NOSONAR python:S5332
