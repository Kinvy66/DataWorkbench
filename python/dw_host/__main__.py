from __future__ import annotations

import json
import logging
import os
import sys
import threading
import traceback
from typing import Any

from pydantic import BaseModel, ValidationError

from dw_host.arrow_block import ArrowBlock
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_host.rpc_chart import dispatch as dispatch_chart
from dw_host.rpc_data import dispatch as dispatch_data
from dw_host.rpc_project import dispatch as dispatch_project
from dw_host.rpc_workflow import dispatch as dispatch_workflow
from dw_host.workflow_runtime import DeferredStart, WorkflowRuntime

log = logging.getLogger("dw_host")
_emit_lock = threading.Lock()


class HostHelloParams(BaseModel):
    appVersion: str
    workspaceRoot: str


class HostHelloResult(BaseModel):
    ok: bool = True
    pythonVersion: str
    appVersion: str
    workspaceRoot: str
    pandasAvailable: bool


class HostReadyParams(BaseModel):
    pid: int
    pandasAvailable: bool


def _configure_stdio() -> None:
    """JSON lines use LF; Arrow payloads must not be translated on Windows."""
    if sys.platform == "win32":
        try:
            import msvcrt

            msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
            msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
        except Exception:
            log.info("could not set stdio to binary mode")


def _read_stdin_line() -> str | None:
    """Read one UTF-8 RPC line. None means stdin EOF (Electron closed the pipe)."""
    raw = sys.stdin.buffer.readline()
    if not raw:
        return None
    line = raw.decode("utf-8")
    if line.endswith("\n"):
        line = line[:-1]
    if line.endswith("\r"):
        line = line[:-1]
    return line


def _emit(obj: dict[str, Any]) -> None:
    payload = (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")
    with _emit_lock:
        sys.stdout.buffer.write(payload)
        sys.stdout.buffer.flush()


def _notify(method: str, params: dict[str, Any]) -> None:
    _emit({"jsonrpc": "2.0", "method": method, "params": params})


def _emit_arrow(req_id: Any, block: ArrowBlock) -> None:
    header = (
        json.dumps(
            {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "encoding": "arrow-v1",
                    "bytes": len(block.payload),
                    "meta": {"rows": block.rows, "startRow": block.start_row},
                },
            },
            ensure_ascii=False,
        )
        + "\n"
    ).encode("utf-8")
    with _emit_lock:
        sys.stdout.buffer.write(header)
        sys.stdout.buffer.write(block.payload)
        sys.stdout.buffer.flush()


def _error(req_id: Any, code: int, message: str, i18n_key: str | None = None) -> None:
    err: dict[str, Any] = {"code": code, "message": message}
    if i18n_key:
        err["data"] = {"i18nKey": i18n_key}
    _emit({"jsonrpc": "2.0", "id": req_id, "error": err})


def _pandas_available() -> bool:
    try:
        import pandas  # noqa: F401

        return True
    except Exception:
        log.info("pandas is not installed; host.ready will report pandasAvailable=false")
        return False


def _handle(req: dict[str, Any], pandas_ok: bool, manager: DataManager, runtime: WorkflowRuntime) -> bool:
    """Return False to stop the process after the response is written."""
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params") or {}
    if not isinstance(method, str):
        _error(req_id, ErrorCode.InvalidRequest, "Invalid Request")
        return True
    if not isinstance(params, dict):
        _error(req_id, ErrorCode.InvalidParams, "params must be an object", "rpc.invalidParams")
        return True
    if method == "host.hello":
        try:
            parsed = HostHelloParams.model_validate(params)
        except ValidationError as exc:
            _error(req_id, ErrorCode.InvalidParams, str(exc), "rpc.invalidParams")
            return True
        result = HostHelloResult(
            pythonVersion=sys.version.split()[0],
            appVersion=parsed.appVersion,
            workspaceRoot=parsed.workspaceRoot,
            pandasAvailable=pandas_ok,
        )
        _emit({"jsonrpc": "2.0", "id": req_id, "result": result.model_dump()})
        return True
    if method == "host.shutdown":
        _emit({"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}})
        return False
    if method.startswith("data."):
        try:
            result = dispatch_data(method, params, manager, pandas_ok)
        except ValidationError as exc:
            _error(req_id, ErrorCode.InvalidParams, str(exc), "rpc.invalidParams")
            return True
        except HostError as exc:
            _error(req_id, exc.code, str(exc), exc.i18n_key)
            return True
        if isinstance(result, ArrowBlock):
            _emit_arrow(req_id, result)
        else:
            _emit({"jsonrpc": "2.0", "id": req_id, "result": result})
        return True
    if method.startswith("chart."):
        try:
            result = dispatch_chart(method, params, manager, pandas_ok)
        except ValidationError as exc:
            _error(req_id, ErrorCode.InvalidParams, str(exc), "rpc.invalidParams")
            return True
        except HostError as exc:
            _error(req_id, exc.code, str(exc), exc.i18n_key)
            return True
        _emit({"jsonrpc": "2.0", "id": req_id, "result": result})
        return True
    if method.startswith("workflow."):
        try:
            result = dispatch_workflow(method, params, runtime)
        except ValidationError as exc:
            _error(req_id, ErrorCode.InvalidParams, str(exc), "rpc.invalidParams")
            return True
        except HostError as exc:
            _error(req_id, exc.code, str(exc), exc.i18n_key)
            return True
        if isinstance(result, DeferredStart):
            _emit({"jsonrpc": "2.0", "id": req_id, "result": result.result})
            result.start()
        else:
            _emit({"jsonrpc": "2.0", "id": req_id, "result": result})
        return True
    if method.startswith("project."):
        try:
            result = dispatch_project(method, params, manager, runtime)
        except ValidationError as exc:
            _error(req_id, ErrorCode.InvalidParams, str(exc), "rpc.invalidParams")
            return True
        except HostError as exc:
            _error(req_id, exc.code, str(exc), exc.i18n_key)
            return True
        _emit({"jsonrpc": "2.0", "id": req_id, "result": result})
        return True
    _error(req_id, ErrorCode.MethodNotFound, f"Method not found: {method}")
    return True


def main() -> int:
    logging.basicConfig(
        stream=sys.stderr,
        level=logging.INFO,
        format="%(asctime)s dw_host %(levelname)s %(message)s",
    )
    _configure_stdio()
    pandas_ok = _pandas_available()
    ready = HostReadyParams(pid=os.getpid(), pandasAvailable=pandas_ok)
    _emit({"jsonrpc": "2.0", "method": "host.ready", "params": ready.model_dump()})
    log.info("host.ready pid=%s pandasAvailable=%s", ready.pid, pandas_ok)

    if os.environ.get("DW_POLLUTE_AFTER_READY") == "1":
        # Intentional protocol violation for tests. Never enable in production.
        sys.stdout.buffer.write(b"oops\n")
        sys.stdout.buffer.flush()

    manager = DataManager()
    from dw_host.api import bind_data_manager

    bind_data_manager(manager)
    runtime = WorkflowRuntime(notify=_notify)
    while True:
        line = _read_stdin_line()
        if line is None:
            log.info("stdin closed; exiting")
            return 0
        if not line.strip():
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            _error(None, ErrorCode.ParseError, "Parse error")
            continue
        if not isinstance(req, dict) or req.get("jsonrpc") != "2.0":
            _error(req.get("id") if isinstance(req, dict) else None, ErrorCode.InvalidRequest, "Invalid Request")
            continue
        try:
            keep = _handle(req, pandas_ok, manager, runtime)
        except Exception:
            log.exception("unhandled error in RPC handler")
            _error(req.get("id"), ErrorCode.Internal, traceback.format_exc().splitlines()[-1])
            keep = True
        if not keep:
            log.info("host.shutdown; exiting")
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
