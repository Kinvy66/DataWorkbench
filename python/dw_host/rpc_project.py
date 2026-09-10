from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_host.workflow_runtime import WorkflowRuntime

log = logging.getLogger("dw_host")

PROJECT_MAGIC = "DataWorkbenchProject"
PROJECT_FORMAT = 1
_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")
_EMPTY_WORKFLOW = {"name": "untitle", "version": "1.0", "nodes": [], "connections": []}


class DirParams(BaseModel):
    dir: str


def _require_dir(directory: str) -> Path:
    root = Path(directory)
    if not root.is_dir():
        raise HostError(ErrorCode.FileIo, "Project directory is missing", "project.dirMissing")
    return root


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HostError(ErrorCode.FileIo, f"{path.name} is not valid JSON", "project.invalid") from exc
    except OSError as exc:
        raise HostError(ErrorCode.FileIo, f"Failed to read {path.name}", "data.ioError") from exc


def pack_logic(directory: str, manager: DataManager) -> dict[str, Any]:
    root = _require_dir(directory)
    datas = root / "datas"
    datas.mkdir(parents=True, exist_ok=True)
    for old in datas.glob("*.parquet"):
        try:
            old.unlink()
        except OSError:
            pass
    meta: list[dict[str, str]] = []
    for item in manager.list_datasets():
        dataset_id = str(item["id"])
        if not _SAFE_ID.match(dataset_id):
            raise HostError(ErrorCode.FileIo, f"Unsafe dataset id {dataset_id!r}", "project.invalid")
        parquet = datas / f"{dataset_id}.parquet"
        manager.export_path(dataset_id, str(parquet), "parquet")
        meta.append({"id": dataset_id, "name": str(item["name"]), "store": "inline-parquet"})
    (root / "data-manager.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    log.info("project.packLogic datasets=%s", len(meta))
    return {"ok": True, "count": len(meta)}


def _load_datasets(root: Path) -> list[tuple[str, str, Any]]:
    meta_path = root / "data-manager.json"
    if not meta_path.is_file():
        return []
    raw = _read_json(meta_path)
    if not isinstance(raw, list):
        raise HostError(ErrorCode.FileIo, "data-manager.json must be an array", "project.invalid")
    try:
        import pandas as pd
    except Exception as exc:
        raise HostError(
            ErrorCode.Internal,
            "pandas is not installed in the Python sidecar",
            "data.pandasRequired",
        ) from exc
    frames: list[tuple[str, str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise HostError(ErrorCode.FileIo, "data-manager.json entries must be objects", "project.invalid")
        dataset_id = str(item.get("id") or "")
        name = str(item.get("name") or "")
        if not _SAFE_ID.match(dataset_id) or not name:
            raise HostError(ErrorCode.FileIo, "data-manager.json has an invalid dataset", "project.invalid")
        parquet = root / "datas" / f"{dataset_id}.parquet"
        if not parquet.is_file():
            raise HostError(ErrorCode.FileIo, f"Missing dataset file {dataset_id}", "project.invalid")
        try:
            df = pd.read_parquet(parquet)
        except Exception as exc:
            raise HostError(ErrorCode.FileIo, f"Failed to read {parquet.name}", "data.ioError") from exc
        frames.append((dataset_id, name, df))
    return frames


def _load_workflow(root: Path, runtime: WorkflowRuntime) -> Any:
    path = root / "workflow-logic.json"
    if not path.is_file():
        return runtime.parse_logic(_EMPTY_WORKFLOW)
    payload = _read_json(path)
    if not isinstance(payload, dict):
        raise HostError(ErrorCode.FileIo, "workflow-logic.json must be an object", "project.invalid")
    return runtime.parse_logic(payload)


def unpack_logic(directory: str, manager: DataManager, runtime: WorkflowRuntime) -> dict[str, Any]:
    root = _require_dir(directory)
    frames = _load_datasets(root)
    workflow = _load_workflow(root, runtime)
    manager.replace_all(frames)
    workflow_id = runtime.replace_with(workflow)
    log.info("project.unpackLogic datasets=%s workflowId=%s", len(frames), workflow_id)
    return {"workflowId": workflow_id, "datasets": manager.list_datasets()}


def clear_logic(manager: DataManager, runtime: WorkflowRuntime) -> dict[str, Any]:
    manager.clear()
    runtime.discard_all()
    log.info("project.clearLogic")
    return {"ok": True}


def dispatch(method: str, params: dict[str, Any], manager: DataManager, runtime: WorkflowRuntime) -> dict[str, Any]:
    if method == "project.packLogic":
        parsed = DirParams.model_validate(params)
        return pack_logic(parsed.dir, manager)
    if method == "project.unpackLogic":
        parsed = DirParams.model_validate(params)
        return unpack_logic(parsed.dir, manager, runtime)
    if method == "project.clearLogic":
        return clear_logic(manager, runtime)
    raise HostError(ErrorCode.MethodNotFound, f"Method not found: {method}")
