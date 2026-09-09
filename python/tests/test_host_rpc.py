from __future__ import annotations

import json

from rpc_client import popen, read_rpc, readline, send


def test_ready_hello_shutdown() -> None:
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["jsonrpc"] == "2.0"
        assert ready["method"] == "host.ready"
        assert "id" not in ready
        assert isinstance(ready["params"]["pid"], int)

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "host.hello",
                "params": {"appVersion": "0.1.0", "workspaceRoot": "/tmp"},
            },
        )
        hello = read_rpc(proc)
        assert hello["id"] == 1
        assert hello["result"]["ok"] is True
        assert hello["result"]["appVersion"] == "0.1.0"
        assert hello["result"]["workspaceRoot"] == "/tmp"
        assert "pythonVersion" in hello["result"]

        send(proc, {"jsonrpc": "2.0", "id": 2, "method": "host.shutdown", "params": {}})
        shutdown = read_rpc(proc)
        assert shutdown["result"]["ok"] is True
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_stdout_pollution_after_ready() -> None:
    proc = popen({"DW_POLLUTE_AFTER_READY": "1"})
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        polluted = readline(proc)
        assert polluted == "oops"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "host.hello",
                "params": {"appVersion": "0.1.0", "workspaceRoot": "x"},
            },
        )
        hello = read_rpc(proc)
        assert hello["result"]["ok"] is True

        send(proc, {"jsonrpc": "2.0", "id": 2, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
