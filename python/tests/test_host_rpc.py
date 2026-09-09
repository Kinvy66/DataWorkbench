from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]


def _popen(extra_env: dict[str, str] | None = None) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONPATH"] = str(PYTHON_ROOT)
    if extra_env:
        env.update(extra_env)
    return subprocess.Popen(
        [sys.executable, "-u", "-m", "dw_host"],
        cwd=str(PYTHON_ROOT),
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )


def _send(proc: subprocess.Popen[str], obj: dict) -> None:
    assert proc.stdin is not None
    proc.stdin.write(json.dumps(obj) + "\n")
    proc.stdin.flush()


def _readline(proc: subprocess.Popen[str]) -> str:
    assert proc.stdout is not None
    line = proc.stdout.readline()
    if line.endswith("\n"):
        line = line[:-1]
    if line.endswith("\r"):
        line = line[:-1]
    return line


def test_ready_hello_shutdown() -> None:
    proc = _popen()
    try:
        ready = json.loads(_readline(proc))
        assert ready["jsonrpc"] == "2.0"
        assert ready["method"] == "host.ready"
        assert "id" not in ready
        assert isinstance(ready["params"]["pid"], int)

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "host.hello",
                "params": {"appVersion": "0.1.0", "workspaceRoot": "/tmp"},
            },
        )
        hello = json.loads(_readline(proc))
        assert hello["id"] == 1
        assert hello["result"]["ok"] is True
        assert hello["result"]["appVersion"] == "0.1.0"
        assert hello["result"]["workspaceRoot"] == "/tmp"
        assert "pythonVersion" in hello["result"]

        _send(proc, {"jsonrpc": "2.0", "id": 2, "method": "host.shutdown", "params": {}})
        shutdown = json.loads(_readline(proc))
        assert shutdown["result"]["ok"] is True
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_stdout_pollution_after_ready() -> None:
    proc = _popen({"DW_POLLUTE_AFTER_READY": "1"})
    try:
        ready = json.loads(_readline(proc))
        assert ready["method"] == "host.ready"
        polluted = _readline(proc)
        assert polluted == "oops"

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "host.hello",
                "params": {"appVersion": "0.1.0", "workspaceRoot": "x"},
            },
        )
        hello = json.loads(_readline(proc))
        assert hello["result"]["ok"] is True

        _send(proc, {"jsonrpc": "2.0", "id": 2, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
