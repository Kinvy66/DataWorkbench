from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from dw_host.arrow_block import decode_ipc_rows

PYTHON_ROOT = Path(__file__).resolve().parents[1]


def popen(extra_env: dict[str, str] | None = None) -> subprocess.Popen[bytes]:
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
    )


def send(proc: subprocess.Popen[bytes], obj: dict[str, Any]) -> None:
    assert proc.stdin is not None
    proc.stdin.write((json.dumps(obj) + "\n").encode("utf-8"))
    proc.stdin.flush()


def _readline_bytes(proc: subprocess.Popen[bytes]) -> bytes:
    assert proc.stdout is not None
    buf = bytearray()
    while True:
        ch = proc.stdout.read(1)
        if not ch:
            raise EOFError("sidecar stdout closed")
        if ch == b"\n":
            break
        buf.extend(ch)
    if buf.endswith(b"\r"):
        del buf[-1]
    return bytes(buf)


def readline(proc: subprocess.Popen[bytes]) -> str:
    return _readline_bytes(proc).decode("utf-8")


def readexact(proc: subprocess.Popen[bytes], n: int) -> bytes:
    assert proc.stdout is not None
    buf = bytearray()
    while len(buf) < n:
        chunk = proc.stdout.read(n - len(buf))
        if not chunk:
            raise EOFError("sidecar stdout closed while reading Arrow payload")
        buf.extend(chunk)
    return bytes(buf)


def read_rpc(proc: subprocess.Popen[bytes]) -> dict[str, Any]:
    msg = json.loads(readline(proc))
    result = msg.get("result")
    if isinstance(result, dict) and result.get("encoding") == "arrow-v1":
        payload = readexact(proc, int(result["bytes"]))
        meta = result.get("meta") or {}
        msg["result"] = {
            "startRow": meta.get("startRow", 0),
            "rows": decode_ipc_rows(payload),
        }
    return msg
