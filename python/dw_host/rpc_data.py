from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from dw_host.arrow_block import maybe_arrow
from dw_host.data_manager import BLOCK_DEFAULT, DataManager
from dw_host.errors import ErrorCode, HostError


class DataImportParams(BaseModel):
    path: str
    format: str | None = None


class ColumnSchema(BaseModel):
    name: str
    dtype: str


class DatasetListItem(BaseModel):
    id: str
    name: str
    rows: int
    cols: int


class DataIdParams(BaseModel):
    id: str


class FetchBlockParams(BaseModel):
    id: str
    startRow: int = 0
    rowCount: int = BLOCK_DEFAULT


class CellPatch(BaseModel):
    row: int
    col: int
    value: Any = None


class PatchCellsParams(BaseModel):
    id: str
    patches: list[CellPatch] = Field(default_factory=list)


class RenameParams(BaseModel):
    id: str
    name: str


class ExportParams(BaseModel):
    id: str
    path: str
    format: str | None = None


class RegisterParams(BaseModel):
    name: str
    handle: Any | None = None


def dispatch(method: str, params: dict[str, Any], manager: DataManager, pandas_ok: bool) -> Any:
    if method.startswith("data.") and method != "data.list" and not pandas_ok:
        raise HostError(
            ErrorCode.FileIo,
            "pandas is not installed in the Python sidecar",
            "data.pandasRequired",
        )
    if method == "data.import":
        parsed = DataImportParams.model_validate(params)
        return manager.import_path(parsed.path, parsed.format)
    if method == "data.list":
        return {"datasets": manager.list_datasets()}
    if method == "data.getSchema":
        parsed = DataIdParams.model_validate(params)
        return manager.get_schema(parsed.id)
    if method == "data.fetchBlock":
        parsed = FetchBlockParams.model_validate(params)
        return maybe_arrow(manager.fetch_block(parsed.id, parsed.startRow, parsed.rowCount))
    if method == "data.patchCells":
        parsed = PatchCellsParams.model_validate(params)
        manager.patch_cells(parsed.id, [p.model_dump() for p in parsed.patches])
        return {"ok": True}
    if method == "data.rename":
        parsed = RenameParams.model_validate(params)
        manager.rename(parsed.id, parsed.name)
        return {"ok": True}
    if method == "data.remove":
        parsed = DataIdParams.model_validate(params)
        manager.remove(parsed.id)
        return {"ok": True}
    if method == "data.export":
        parsed = ExportParams.model_validate(params)
        manager.export_path(parsed.id, parsed.path, parsed.format)
        return {"ok": True}
    if method == "data.register":
        parsed = RegisterParams.model_validate(params)
        import pandas as pd

        dataset_id = manager.publish_dataframe(parsed.name, pd.DataFrame())
        return {"id": dataset_id}
    raise HostError(ErrorCode.MethodNotFound, f"Method not found: {method}")
