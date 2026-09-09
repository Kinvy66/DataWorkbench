from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dw_host.errors import ErrorCode, HostError

log = logging.getLogger("dw_host")

BLOCK_DEFAULT = 512
BLOCK_MAX = 2048

try:
    import numpy as np
    import pandas as pd
except ImportError:  # pragma: no cover - exercised when pandas is absent
    np = None  # type: ignore[assignment]
    pd = None  # type: ignore[assignment]


def _require_pandas() -> None:
    if pd is None:
        raise HostError(
            ErrorCode.FileIo,
            "pandas is not installed in the Python sidecar",
            "data.pandasRequired",
        )


@dataclass
class Dataset:
    id: str
    name: str
    df: Any


def _unique_display_name(existing: set[str], base: str) -> str:
    if base not in existing:
        return base
    n = 2
    while f"{base} ({n})" in existing:
        n += 1
    return f"{base} ({n})"


def _column_schema(df: Any) -> list[dict[str, str]]:
    columns: list[dict[str, str]] = []
    for name, dtype in zip(list(df.columns), list(df.dtypes)):
        columns.append({"name": str(name), "dtype": str(dtype)})
    return columns


def _meta(ds: Dataset) -> dict[str, Any]:
    df = ds.df
    return {
        "id": ds.id,
        "name": ds.name,
        "rows": int(len(df)),
        "cols": int(df.shape[1]),
        "columns": _column_schema(df),
    }


def json_cell(value: Any) -> Any:
    """Convert a pandas/numpy scalar into a JSON-safe value."""
    if value is None:
        return None
    if pd is not None:
        try:
            if value is pd.NA or value is pd.NaT:
                return None
        except Exception:
            pass
        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, bool):
        return value
    if hasattr(value, "isoformat") and callable(getattr(value, "isoformat")):
        try:
            return value.isoformat()
        except Exception:
            pass
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if np is not None:
        if isinstance(value, np.bool_):
            return bool(value)
        if isinstance(value, np.integer):
            return int(value)
        if isinstance(value, np.floating):
            if np.isnan(value):
                return None
            return float(value)
        if isinstance(value, np.datetime64):
            if np.isnat(value):
                return None
            return str(value)
    if isinstance(value, (str, int, float)):
        return value
    return str(value)


def _detect_encoding(path: str) -> str:
    try:
        from charset_normalizer import from_path

        best = from_path(path).best()
        if best and best.encoding:
            return str(best.encoding)
    except Exception:
        log.info("charset-normalizer unavailable or failed; using utf-8")
    return "utf-8"


def _detect_sep(sample: str) -> str:
    candidates = [",", "\t", ";"]
    counts = {sep: sample.count(sep) for sep in candidates}
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


def _resolve_format(path: str, fmt: str | None) -> str:
    if fmt:
        return fmt.lower().lstrip(".")
    ext = Path(path).suffix.lower().lstrip(".")
    if ext in ("csv", "txt"):
        return "csv"
    if ext == "tsv":
        return "tsv"
    if ext in ("xlsx", "xls"):
        return ext
    if ext in ("parquet", "pq"):
        return "parquet"
    if ext in ("pkl", "pickle"):
        return "pickle"
    return ext or "csv"


def _parse_cell(series: Any, raw: Any) -> Any:
    dtype = series.dtype
    if raw is None or raw == "":
        if pd.api.types.is_string_dtype(dtype) or dtype == object:
            return ""
        return pd.NA
    text = raw if isinstance(raw, str) else str(raw)
    try:
        if pd.api.types.is_bool_dtype(dtype):
            lowered = text.strip().lower()
            if lowered in ("true", "1", "yes"):
                return True
            if lowered in ("false", "0", "no"):
                return False
            raise ValueError("not a boolean")
        if pd.api.types.is_integer_dtype(dtype):
            number = float(text)
            if not number.is_integer():
                raise ValueError("not an integer")
            return int(number)
        if pd.api.types.is_float_dtype(dtype):
            return float(text)
        if pd.api.types.is_datetime64_any_dtype(dtype):
            return pd.to_datetime(text)
    except (TypeError, ValueError) as exc:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            f"Invalid value {raw!r} for column dtype {dtype}",
            "data.invalidValue",
        ) from exc
    return text


class DataManager:
    """In-memory id → DataFrame store. DataFrames never leave this process."""

    def __init__(self) -> None:
        self._items: dict[str, Dataset] = {}

    def _names(self) -> set[str]:
        return {ds.name for ds in self._items.values()}

    def _insert(self, name: str, df: Any) -> Dataset:
        ds = Dataset(id=str(uuid.uuid4()), name=name, df=df)
        self._items[ds.id] = ds
        return ds

    def get(self, dataset_id: str) -> Dataset:
        ds = self._items.get(dataset_id)
        if ds is None:
            raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
        return ds

    def list_datasets(self) -> list[dict[str, Any]]:
        return [
            {"id": ds.id, "name": ds.name, "rows": int(len(ds.df)), "cols": int(ds.df.shape[1])}
            for ds in self._items.values()
        ]

    def get_schema(self, dataset_id: str) -> dict[str, Any]:
        ds = self.get(dataset_id)
        return {"columns": _column_schema(ds.df), "rowCount": int(len(ds.df))}

    def publish_dataframe(self, name: str, df: Any) -> str:
        """Node-facing API: same display name overwrites the existing frame."""
        _require_pandas()
        for ds in self._items.values():
            if ds.name == name:
                ds.df = df
                return ds.id
        return self._insert(name, df).id

    def import_path(self, path: str, fmt: str | None = None) -> dict[str, Any]:
        _require_pandas()
        file_path = Path(path)
        if not file_path.is_file():
            raise HostError(ErrorCode.FileIo, f"File not found: {file_path.name}", "data.fileMissing")
        kind = _resolve_format(path, fmt)
        if kind == "pickle":
            raise HostError(
                ErrorCode.FileIo,
                "Pickle import is disabled",
                "data.pickleDisabled",
            )
        try:
            df = _read_frame(str(file_path), kind)
        except HostError:
            raise
        except Exception as exc:
            log.info("data.import failed: %s", type(exc).__name__)
            raise HostError(ErrorCode.FileIo, f"Failed to import {file_path.name}", "data.ioError") from exc
        name = _unique_display_name(self._names(), file_path.stem)
        ds = self._insert(name, df)
        log.info("data.import name=%s rows=%s cols=%s", ds.name, len(df), df.shape[1])
        return _meta(ds)

    def fetch_block(self, dataset_id: str, start_row: int, row_count: int | None) -> dict[str, Any]:
        _require_pandas()
        ds = self.get(dataset_id)
        start = max(0, int(start_row))
        count = BLOCK_DEFAULT if row_count is None else int(row_count)
        count = max(0, min(count, BLOCK_MAX))
        n = int(len(ds.df))
        if start >= n or count == 0:
            return {"startRow": start, "rows": []}
        end = min(n, start + count)
        chunk = ds.df.iloc[start:end]
        values = chunk.to_numpy(dtype=object)
        rows: list[list[Any]] = []
        for i in range(values.shape[0]):
            rows.append([json_cell(values[i, j]) for j in range(values.shape[1])])
        return {"startRow": start, "rows": rows}

    def patch_cells(self, dataset_id: str, patches: list[dict[str, Any]]) -> None:
        _require_pandas()
        ds = self.get(dataset_id)
        df = ds.df
        n_rows, n_cols = int(len(df)), int(df.shape[1])
        work = df.copy(deep=True)
        for patch in patches:
            row = int(patch["row"])
            col = int(patch["col"])
            if row < 0 or row >= n_rows or col < 0 or col >= n_cols:
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    f"Cell out of range: row={row} col={col}",
                    "data.columnNotFound",
                )
            parsed = _parse_cell(work.iloc[:, col], patch.get("value"))
            work.iat[row, col] = parsed
        ds.df = work

    def rename(self, dataset_id: str, name: str) -> None:
        ds = self.get(dataset_id)
        new_name = name.strip()
        if not new_name:
            raise HostError(ErrorCode.ColumnOrValidation, "Name must not be empty", "data.invalidValue")
        others = {item.name for item in self._items.values() if item.id != dataset_id}
        ds.name = _unique_display_name(others, new_name)

    def remove(self, dataset_id: str) -> None:
        self.get(dataset_id)
        del self._items[dataset_id]

    def export_path(self, dataset_id: str, path: str, fmt: str | None = None) -> None:
        _require_pandas()
        ds = self.get(dataset_id)
        kind = _resolve_format(path, fmt)
        file_path = Path(path)
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            _write_frame(ds.df, str(file_path), kind)
        except HostError:
            raise
        except Exception as exc:
            log.info("data.export failed: %s", type(exc).__name__)
            raise HostError(ErrorCode.FileIo, f"Failed to export {file_path.name}", "data.ioError") from exc
        log.info("data.export name=%s format=%s", ds.name, kind)


def _read_frame(path: str, kind: str) -> Any:
    if kind == "csv":
        encoding = _detect_encoding(path)
        sample = Path(path).read_bytes()[:8192].decode(encoding, errors="replace")
        sep = _detect_sep(sample)
        return pd.read_csv(path, encoding=encoding, sep=sep)
    if kind == "tsv":
        encoding = _detect_encoding(path)
        return pd.read_csv(path, encoding=encoding, sep="\t")
    if kind == "xlsx":
        return pd.read_excel(path, sheet_name=0, engine="openpyxl")
    if kind == "xls":
        raise HostError(ErrorCode.FileIo, "xls is not supported; save as xlsx", "data.unsupportedFormat")
    if kind == "parquet":
        return pd.read_parquet(path)
    raise HostError(ErrorCode.FileIo, f"Unsupported format: {kind}", "data.unsupportedFormat")


def _write_frame(df: Any, path: str, kind: str) -> None:
    if kind in ("csv", "txt", "tsv"):
        sep = "\t" if kind == "tsv" else ","
        df.to_csv(path, index=False, encoding="utf-8-sig", sep=sep)
        return
    if kind in ("xlsx", "xls"):
        df.to_excel(path, index=False, engine="openpyxl")
        return
    if kind == "parquet":
        df.to_parquet(path, index=False)
        return
    if kind == "pickle":
        raise HostError(ErrorCode.FileIo, "Pickle export is disabled", "data.pickleDisabled")
    raise HostError(ErrorCode.FileIo, f"Unsupported format: {kind}", "data.unsupportedFormat")
