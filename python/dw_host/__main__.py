from __future__ import annotations

import json
import logging
import os
import sys
import traceback
from typing import Any

from pydantic import BaseModel, ValidationError

from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_host.rpc_data import dispatch as dispatch_data

log = logging.getLogger("dw_host")


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


def _emit(obj: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


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


def _handle(req: dict[str, Any], pandas_ok: bool, manager: DataManager) -> bool:
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
    pandas_ok = _pandas_available()
    ready = HostReadyParams(pid=os.getpid(), pandasAvailable=pandas_ok)
    _emit({"jsonrpc": "2.0", "method": "host.ready", "params": ready.model_dump()})
    log.info("host.ready pid=%s pandasAvailable=%s", ready.pid, pandas_ok)

    if os.environ.get("DW_POLLUTE_AFTER_READY") == "1":
        # Intentional protocol violation for tests. Never enable in production.
        sys.stdout.write("oops\n")
        sys.stdout.flush()

    manager = DataManager()
    for raw in sys.stdin:
        line = raw[:-1] if raw.endswith("\n") else raw
        if line.endswith("\r"):
            line = line[:-1]
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
            keep = _handle(req, pandas_ok, manager)
        except Exception:
            log.exception("unhandled error in RPC handler")
            _error(req.get("id"), ErrorCode.Internal, traceback.format_exc().splitlines()[-1])
            keep = True
        if not keep:
            return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
