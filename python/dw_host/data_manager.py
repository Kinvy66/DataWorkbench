from __future__ import annotations

import logging
import math
import threading
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


_UTF8_BOM = b"\xef\xbb\xbf"
# Restrict detection to encodings this product actually imports. Unbounded
# charset-normalizer often labels short GB18030 CSVs as cp949/Korean.
_IMPORT_CODEPAGES = ("utf_8", "utf_8_sig", "gb18030", "gbk", "gb2312", "big5")
_KR_MISDETECT = frozenset({"cp949", "euc_kr", "euc-kr", "iso2022_kr", "iso-2022-kr", "iso_2022_kr"})


def _detect_encoding(path: str) -> str:
    sample = Path(path).read_bytes()[:65536]
    if sample.startswith(_UTF8_BOM):
        return "utf-8-sig"
    try:
        sample.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass
    try:
        from charset_normalizer import from_bytes

        best = from_bytes(sample, cp_isolation=list(_IMPORT_CODEPAGES)).best()
        if best and best.encoding:
            encoding = str(best.encoding)
            if encoding.lower().replace("-", "_") in _KR_MISDETECT:
                sample.decode("gb18030")
                return "gb18030"
            return encoding
    except UnicodeDecodeError:
        pass
    except Exception:
        log.info("charset-normalizer unavailable or failed; trying gb18030")
    try:
        sample.decode("gb18030")
        return "gb18030"
    except UnicodeDecodeError:
        log.info("charset detection failed; using utf-8")
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
        self._lock = threading.RLock()

    def _names(self) -> set[str]:
        return {ds.name for ds in self._items.values()}

    def _insert(self, name: str, df: Any) -> Dataset:
        ds = Dataset(id=str(uuid.uuid4()), name=name, df=df)
        self._items[ds.id] = ds
        return ds

    def get(self, dataset_id: str) -> Dataset:
        with self._lock:
            ds = self._items.get(dataset_id)
        if ds is None:
            raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
        return ds

    def find_by_name(self, name: str) -> Dataset:
        with self._lock:
            matches = [ds for ds in self._items.values() if ds.name == name]
        if not matches:
            raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {name}", "data.notFound")
        return matches[0]

    def list_datasets(self) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._items.values())
        return [
            {"id": ds.id, "name": ds.name, "rows": int(len(ds.df)), "cols": int(ds.df.shape[1])}
            for ds in items
        ]

    def get_schema(self, dataset_id: str) -> dict[str, Any]:
        ds = self.get(dataset_id)
        return {"columns": _column_schema(ds.df), "rowCount": int(len(ds.df))}

    def publish_dataframe(self, name: str, df: Any) -> str:
        """Node-facing API: same display name overwrites the existing frame."""
        _require_pandas()
        with self._lock:
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
        with self._lock:
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
        with self._lock:
            ds = self.get(dataset_id)
            new_name = name.strip()
            if not new_name:
                raise HostError(ErrorCode.ColumnOrValidation, "Name must not be empty", "data.invalidValue")
            others = {item.name for item in self._items.values() if item.id != dataset_id}
            ds.name = _unique_display_name(others, new_name)

    def remove(self, dataset_id: str) -> None:
        with self._lock:
            self.get(dataset_id)
            del self._items[dataset_id]

    def dropna(
        self,
        dataset_id: str,
        *,
        how: str = "any",
        subset: list[str] | None = None,
        min_non_na: int = 0,
    ) -> dict[str, Any]:
        """Drop NA rows in place via the shared Core ``dropna_impl``."""
        _require_pandas()
        from dw_nodes_analysis.core.cleaning import dropna_impl

        how_norm = str(how or "any").strip().lower()
        if how_norm not in ("any", "all"):
            raise HostError(ErrorCode.ColumnOrValidation, "how must be 'any' or 'all'", "data.invalidValue")
        try:
            thresh = int(min_non_na)
        except (TypeError, ValueError) as exc:
            raise HostError(ErrorCode.ColumnOrValidation, "minNonNa must be an integer", "data.invalidValue") from exc
        if thresh < 0:
            raise HostError(ErrorCode.ColumnOrValidation, "minNonNa must be >= 0", "data.invalidValue")
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, subset)
            before = int(len(ds.df))
            cleaned = dropna_impl(ds.df, subset=resolved, how=how_norm, min_non_na=thresh, reindex=True)
            ds.df = cleaned
        result = _meta(ds)
        result["removedCount"] = before - int(len(cleaned))
        log.info("data.dropNa name=%s removed=%s rows=%s", ds.name, result["removedCount"], result["rows"])
        return result

    def drop_duplicates(
        self,
        dataset_id: str,
        *,
        keep: object = "first",
        subset: list[str] | None = None,
    ) -> dict[str, Any]:
        """Drop duplicate rows in place via the shared Core ``drop_duplicates_impl``."""
        _require_pandas()
        from dw_nodes_analysis.core.cleaning import drop_duplicates_impl

        keep_norm = _normalize_keep(keep)
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, subset)
            before = int(len(ds.df))
            try:
                cleaned = drop_duplicates_impl(ds.df, subset=resolved, keep=keep_norm, ignore_index=True)
            except Exception as exc:
                log.info("data.dropDuplicates failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to drop duplicates",
                    "data.invalidValue",
                ) from exc
            ds.df = cleaned
        result = _meta(ds)
        result["removedCount"] = before - int(len(cleaned))
        log.info(
            "data.dropDuplicates name=%s keep=%s removed=%s rows=%s",
            ds.name,
            keep_norm,
            result["removedCount"],
            result["rows"],
        )
        return result

    def query(self, dataset_id: str, query_string: str) -> dict[str, Any]:
        """Filter rows in place via the shared Core ``query_dataframe``."""
        _require_pandas()
        from dw_nodes_analysis.core.operations import query_dataframe

        expr = str(query_string or "").strip()
        if not expr:
            raise HostError(ErrorCode.ColumnOrValidation, "queryString must not be empty", "data.queryEmpty")
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            before = int(len(ds.df))
            try:
                filtered = query_dataframe(ds.df, expr)
            except Exception as exc:
                log.info("data.query failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Invalid query expression",
                    "data.invalidQuery",
                ) from exc
            ds.df = filtered
        result = _meta(ds)
        result["matchedCount"] = int(len(filtered))
        result["removedCount"] = before - int(len(filtered))
        log.info(
            "data.query name=%s matched=%s removed=%s",
            ds.name,
            result["matchedCount"],
            result["removedCount"],
        )
        return result

    def sort(
        self,
        dataset_id: str,
        *,
        columns: list[str],
        ascending: bool = True,
    ) -> dict[str, Any]:
        """Sort rows in place via the shared Core ``sort_dataframe``."""
        _require_pandas()
        from dw_nodes_analysis.core.operations import sort_dataframe

        names = [str(item).strip() for item in columns if str(item).strip()]
        if not names:
            raise HostError(ErrorCode.ColumnOrValidation, "columns must not be empty", "data.sortColumnsEmpty")
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, names)
            if not resolved:
                raise HostError(ErrorCode.ColumnOrValidation, "columns must not be empty", "data.sortColumnsEmpty")
            try:
                sorted_df = sort_dataframe(ds.df, resolved, bool(ascending))
            except Exception as exc:
                log.info("data.sort failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to sort dataset",
                    "data.invalidValue",
                ) from exc
            ds.df = sorted_df
        result = _meta(ds)
        log.info("data.sort name=%s columns=%s ascending=%s", ds.name, names, ascending)
        return result

    def evaluate(self, dataset_id: str, expression: str) -> dict[str, Any]:
        """Compute columns in place via the shared Core ``eval_expression``.

        pandas ``DataFrame.eval`` returns a Series when the expression has no
        assignment. That must not overwrite the selected table.
        """
        _require_pandas()
        from dw_nodes_analysis.core.operations import eval_expression

        expr = str(expression or "").strip()
        if not expr:
            raise HostError(ErrorCode.ColumnOrValidation, "expression must not be empty", "data.evalEmpty")
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            try:
                computed = eval_expression(ds.df, expr)
            except Exception as exc:
                log.info("data.eval failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Invalid eval expression",
                    "data.invalidEval",
                ) from exc
            if not isinstance(computed, pd.DataFrame):
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Eval expression must assign a column, e.g. c = a + b",
                    "data.invalidEval",
                )
            ds.df = computed
        result = _meta(ds)
        log.info("data.eval name=%s rows=%s cols=%s", ds.name, result["rows"], result["cols"])
        return result

    def fillna(
        self,
        dataset_id: str,
        *,
        method: str = "value",
        subset: list[str] | None = None,
        value: Any = 0.0,
    ) -> dict[str, Any]:
        """Fill NA cells in place via the shared Core ``fillna_impl``."""
        _require_pandas()
        from dw_nodes_analysis.core.cleaning import fillna_impl

        method_norm = _normalize_fillna_method(method)
        fill_value = _parse_fill_value(value)
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, subset)
            before = _na_cell_count(ds.df)
            try:
                filled = fillna_impl(ds.df, subset=resolved, method=method_norm, value=fill_value, limit=None)
            except Exception as exc:
                log.info("data.fillNa failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to fill missing values",
                    "data.invalidValue",
                ) from exc
            ds.df = filled
        result = _meta(ds)
        result["filledCount"] = before - _na_cell_count(filled)
        log.info("data.fillNa name=%s method=%s filled=%s", ds.name, method_norm, result["filledCount"])
        return result

    def replace_values(
        self,
        dataset_id: str,
        *,
        old_values: list[str] | str | None = None,
        new_value: Any = "",
        subset: list[str] | None = None,
        case_sensitive: object = True,
    ) -> dict[str, Any]:
        """Replace matching cells in place via the shared Core ``replace_values_impl``."""
        _require_pandas()
        from dw_nodes_analysis.core.cleaning import replace_values_impl

        olds = _parse_old_values(old_values)
        if not olds:
            raise HostError(ErrorCode.ColumnOrValidation, "oldValues must not be empty", "data.replaceOldEmpty")
        case_norm = _parse_bool(case_sensitive, default=True)
        replacement = _parse_replace_value(new_value)
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, subset)
            before = ds.df
            try:
                replaced = replace_values_impl(
                    ds.df,
                    subset=resolved,
                    old_values=olds,
                    new_value=replacement,
                    case_sensitive=case_norm,
                )
            except Exception as exc:
                log.info("data.replaceValues failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to replace values",
                    "data.invalidValue",
                ) from exc
            ds.df = replaced
        result = _meta(ds)
        result["replacedCount"] = _changed_cell_count(before, replaced)
        log.info(
            "data.replaceValues name=%s replaced=%s rows=%s",
            ds.name,
            result["replacedCount"],
            result["rows"],
        )
        return result

    def threshold_filter(
        self,
        dataset_id: str,
        *,
        filter_type: str = "greater_than",
        lower: object = 0.0,
        upper: object = 100.0,
        subset: list[str] | None = None,
        row_logic: str = "any",
        treat_nan: object = False,
    ) -> dict[str, Any]:
        """Drop rows matching a numeric threshold via Core ``threshold_filter_impl``."""
        _require_pandas()
        from dw_nodes_analysis.core.cleaning import threshold_filter_impl

        ftype = _normalize_filter_type(filter_type)
        logic = _normalize_row_logic(row_logic)
        lo = _parse_float(lower, 0.0)
        hi = _parse_float(upper, 100.0)
        nan_as_hit = _parse_bool(treat_nan, default=False)
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, subset)
            if resolved is None:
                resolved = _numeric_columns(ds.df)
                if not resolved:
                    raise HostError(
                        ErrorCode.ColumnOrValidation,
                        "No numeric columns to filter",
                        "data.thresholdNoNumeric",
                    )
            else:
                _require_numeric_columns(ds.df, resolved)
            before = int(len(ds.df))
            try:
                filtered = threshold_filter_impl(
                    ds.df,
                    subset=resolved,
                    filter_type=ftype,
                    lower=lo,
                    upper=hi,
                    row_logic=logic,
                    treat_nan=nan_as_hit,
                    reindex=True,
                )
            except Exception as exc:
                log.info("data.thresholdFilter failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to apply threshold filter",
                    "data.invalidValue",
                ) from exc
            ds.df = filtered
        result = _meta(ds)
        result["removedCount"] = before - int(len(filtered))
        log.info(
            "data.thresholdFilter name=%s type=%s removed=%s rows=%s",
            ds.name,
            ftype,
            result["removedCount"],
            result["rows"],
        )
        return result

    def filter_by_column(
        self,
        dataset_id: str,
        *,
        column: object,
        min_val: object = None,
        max_val: object = None,
    ) -> dict[str, Any]:
        """Keep rows in an inclusive column range via Core ``filter_by_column_range``."""
        _require_pandas()
        from dw_nodes_analysis.core.operations import filter_by_column_range

        col_name = str(column or "").strip()
        if not col_name:
            raise HostError(
                ErrorCode.ColumnOrValidation,
                "Column is required",
                "data.filterByColumnColumnEmpty",
            )
        lo = _parse_optional_float(min_val)
        hi = _parse_optional_float(max_val)
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            resolved = _resolve_columns(ds.df, [col_name])
            col = resolved[0]
            _require_numeric_columns(ds.df, [col])
            before = int(len(ds.df))
            try:
                filtered = filter_by_column_range(ds.df, col, lo, hi)
            except Exception as exc:
                log.info("data.filterByColumn failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to filter by column range",
                    "data.invalidValue",
                ) from exc
            ds.df = filtered
        result = _meta(ds)
        result["matchedCount"] = int(len(filtered))
        result["removedCount"] = before - int(len(filtered))
        log.info(
            "data.filterByColumn name=%s column=%s matched=%s removed=%s",
            ds.name,
            col_name,
            result["matchedCount"],
            result["removedCount"],
        )
        return result

    def describe(
        self,
        dataset_id: str,
        *,
        percentiles: list[float] | str | None = "0.25,0.5,0.75",
        name: str | None = None,
    ) -> dict[str, Any]:
        """Publish a new statistics table via Core ``describe_dataframe``; source is unchanged."""
        _require_pandas()
        from dw_nodes_analysis.core.operations import describe_dataframe

        try:
            pcts = _parse_percentiles(percentiles)
        except ValueError as exc:
            raise HostError(
                ErrorCode.ColumnOrValidation,
                "Invalid percentiles",
                "data.invalidValue",
            ) from exc
        with self._lock:
            ds = self._items.get(dataset_id)
            if ds is None:
                raise HostError(ErrorCode.DatasetNotFound, f"Dataset not found: {dataset_id}", "data.notFound")
            source_name = ds.name
            try:
                table = _flatten_describe(describe_dataframe(ds.df, percentiles=pcts))
            except Exception as exc:
                log.info("data.describe failed: %s", type(exc).__name__)
                raise HostError(
                    ErrorCode.ColumnOrValidation,
                    "Failed to describe dataset",
                    "data.invalidValue",
                ) from exc
            base = (name or "").strip() or f"{source_name} describe"
            display = _unique_display_name(self._names(), base)
            new_ds = self._insert(display, table)
        result = _meta(new_ds)
        log.info("data.describe source=%s name=%s rows=%s cols=%s", source_name, new_ds.name, result["rows"], result["cols"])
        return result

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


_FILLNA_METHODS = frozenset({"value", "forward", "backward", "mean", "median", "mode"})
_FILLNA_ALIASES = {"constant": "value", "ffill": "forward", "bfill": "backward"}
_KEEP_VALUES = frozenset({"first", "last", "none"})
_KEEP_ALIASES = {"false": "none"}
_FILTER_TYPES = frozenset({"greater_than", "less_than", "in_range", "out_of_range"})
_FILTER_ALIASES = {
    "gt": "greater_than",
    ">": "greater_than",
    "greater": "greater_than",
    "lt": "less_than",
    "<": "less_than",
    "less": "less_than",
    "between": "in_range",
    "inside": "in_range",
    "outside": "out_of_range",
}
_ROW_LOGIC = frozenset({"any", "all"})


def _normalize_keep(raw: object) -> str:
    if raw is False:
        return "none"
    if isinstance(raw, bool):
        raise HostError(ErrorCode.ColumnOrValidation, "Unsupported keep value", "data.invalidValue")
    key = str(raw or "first").strip().lower()
    key = _KEEP_ALIASES.get(key, key)
    if key not in _KEEP_VALUES:
        raise HostError(ErrorCode.ColumnOrValidation, "Unsupported keep value", "data.invalidValue")
    return key


def _normalize_filter_type(raw: object) -> str:
    key = str(raw or "greater_than").strip().lower()
    key = _FILTER_ALIASES.get(key, key)
    if key not in _FILTER_TYPES:
        raise HostError(ErrorCode.ColumnOrValidation, "Unsupported filter type", "data.invalidValue")
    return key


def _normalize_row_logic(raw: object) -> str:
    key = str(raw or "any").strip().lower()
    if key not in _ROW_LOGIC:
        raise HostError(ErrorCode.ColumnOrValidation, "rowLogic must be 'any' or 'all'", "data.invalidValue")
    return key


def _parse_float(raw: object, default: float) -> float:
    if raw is None or raw == "":
        return default
    if isinstance(raw, bool):
        raise HostError(ErrorCode.ColumnOrValidation, "Threshold must be a number", "data.invalidValue")
    try:
        return float(raw)
    except (TypeError, ValueError) as exc:
        raise HostError(ErrorCode.ColumnOrValidation, "Threshold must be a number", "data.invalidValue") from exc


def _parse_optional_float(raw: object) -> float | None:
    """Empty / None means unbounded. 0 is a real bound, not a sentinel."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool):
        raise HostError(ErrorCode.ColumnOrValidation, "Bound must be a number", "data.invalidValue")
    try:
        return float(raw)
    except (TypeError, ValueError) as exc:
        raise HostError(ErrorCode.ColumnOrValidation, "Bound must be a number", "data.invalidValue") from exc


def _numeric_columns(df: Any) -> list[Any]:
    return [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]


def _require_numeric_columns(df: Any, columns: list[Any]) -> None:
    bad = [str(col) for col in columns if not pd.api.types.is_numeric_dtype(df[col])]
    if bad:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            f"Non-numeric columns: {', '.join(bad)}",
            "data.invalidValue",
        )


def _normalize_fillna_method(raw: object) -> str:
    key = str(raw or "value").strip().lower()
    key = _FILLNA_ALIASES.get(key, key)
    if key not in _FILLNA_METHODS:
        raise HostError(ErrorCode.ColumnOrValidation, "Unsupported fill method", "data.invalidValue")
    return key


def _parse_fill_value(raw: Any) -> Any:
    if raw is None:
        return 0.0
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw
    text = str(raw)
    try:
        return float(text)
    except (TypeError, ValueError):
        return text


def _parse_replace_value(raw: Any) -> Any:
    if raw is None:
        return ""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw
    text = str(raw)
    if text == "":
        return ""
    try:
        return float(text)
    except (TypeError, ValueError):
        return text


def _parse_old_values(raw: object) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [part.strip() for part in raw.split(",") if part.strip()]
    if isinstance(raw, (list, tuple)):
        return [str(item).strip() for item in raw if str(item).strip()]
    text = str(raw).strip()
    return [text] if text else []


def _parse_bool(raw: object, *, default: bool = True) -> bool:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)) and not isinstance(raw, bool) and raw in (0, 1):
        return bool(raw)
    key = str(raw).strip().lower()
    if key in ("true", "1", "yes", "on"):
        return True
    if key in ("false", "0", "no", "off"):
        return False
    raise HostError(ErrorCode.ColumnOrValidation, "Unsupported boolean value", "data.invalidValue")


def _changed_cell_count(before: Any, after: Any) -> int:
    neq = before.ne(after)
    both_na = before.isna() & after.isna()
    return int((neq & ~both_na).to_numpy().sum())


def _parse_percentiles(raw: object) -> list[float] | None:
    """Parse comma-separated or list percentiles in [0, 1]. Empty means pandas default."""
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)):
        parts = list(raw)
    else:
        text = str(raw).strip()
        if not text:
            return None
        parts = [p.strip() for p in text.split(",") if p.strip()]
        if not parts:
            return None
    out: list[float] = []
    seen: set[float] = set()
    for part in parts:
        try:
            value = float(part)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"invalid percentile {part!r}") from exc
        if value < 0.0 or value > 1.0:
            raise ValueError(f"percentile out of range: {value}")
        if value in seen:
            raise ValueError(f"duplicate percentile: {value}")
        seen.add(value)
        out.append(value)
    return out


def _flatten_describe(stats: Any) -> Any:
    table = stats.reset_index()
    first = table.columns[0]
    return table.rename(columns={first: "stat"})


def _na_cell_count(df: Any) -> int:
    return int(df.isna().to_numpy().sum())


def _resolve_columns(df: Any, subset: list[str] | None) -> list[Any] | None:
    if not subset:
        return None
    mapping = {str(col): col for col in df.columns}
    missing = [name for name in subset if name not in mapping]
    if missing:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            f"Unknown columns: {', '.join(missing)}",
            "data.columnNotFound",
        )
    return [mapping[name] for name in subset]


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
