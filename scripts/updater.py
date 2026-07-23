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

import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("UPDATER_SECRET", "")
PORT = int(os.environ.get("PORT", "8787"))
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
        subprocess.run(COMPOSE_BASE + ["pull", SERVICE], check=False)
        print("[updater] recreating service...", flush=True)
        subprocess.run(COMPOSE_BASE + ["up", "-d", SERVICE], check=False)
        print("[updater] done", flush=True)
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

    def do_POST(self) -> None:
        if self.path != "/update":
            self._json(404, b'{"error":"not_found"}')
            return
        if not SECRET:
            self._json(503, b'{"error":"not_configured"}')
            return
        if self.headers.get("X-Updater-Secret") != SECRET:
            self._json(401, b'{"error":"unauthorized"}')
            return
        threading.Thread(target=run_update, daemon=True).start()
        self._json(202, b'{"status":"started"}')

    def log_message(self, fmt: str, *args) -> None:  # noqa: A002
        print("[updater] " + (fmt % args), flush=True)


if __name__ == "__main__":
    print(f"[updater] listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
