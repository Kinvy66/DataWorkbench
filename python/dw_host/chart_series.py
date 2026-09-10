from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError

DEFAULT_MAX_POINTS = 5000
MIN_MAX_POINTS = 2
MAX_MAX_POINTS = 20_000


def clamp_max_points(value: int) -> int:
    return max(MIN_MAX_POINTS, min(int(value), MAX_MAX_POINTS))


def _column(df: Any, name: str) -> pd.Series:
    if name not in df.columns:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            f"Column not found: {name}",
            "chart.columnNotFound",
        )
    return df[name]


def _as_x_array(series: pd.Series, name: str) -> tuple[np.ndarray, str]:
    if pd.api.types.is_datetime64_any_dtype(series):
        converted = pd.to_datetime(series, utc=True, errors="coerce")
        millis = converted.astype("int64").to_numpy(dtype=np.float64) / 1e6
        millis = np.where(converted.isna(), np.nan, millis)
        return millis.astype(np.float64, copy=False), "time"
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce").to_numpy(dtype=np.float64), "number"
    parsed = pd.to_datetime(series, utc=True, errors="coerce")
    if float(parsed.notna().mean()) >= 0.8:
        millis = parsed.astype("int64").to_numpy(dtype=np.float64) / 1e6
        millis = np.where(parsed.isna(), np.nan, millis)
        return millis.astype(np.float64, copy=False), "time"
    raise HostError(
        ErrorCode.ColumnOrValidation,
        f"Column {name!r} must be numeric or datetime. Query or pick a numeric column.",
        "chart.nonNumeric",
    )


def _as_y_array(series: pd.Series, name: str) -> np.ndarray:
    if not pd.api.types.is_numeric_dtype(series):
        raise HostError(
            ErrorCode.ColumnOrValidation,
            f"Column {name!r} is not numeric. Query or pick a numeric column.",
            "chart.nonNumeric",
        )
    return pd.to_numeric(series, errors="coerce").to_numpy(dtype=np.float64)


def _json_nums(values: np.ndarray) -> list[float | None]:
    out: list[float | None] = []
    for raw in values.tolist():
        number = float(raw)
        out.append(number if math.isfinite(number) else None)
    return out


def lttb_indices(x: np.ndarray, y: np.ndarray, n_out: int) -> np.ndarray:
    """Largest-Triangle-Three-Buckets indices. NaN in y is treated as 0 for area only."""
    n = int(x.size)
    if n_out >= n or n_out < 3:
        return np.arange(n, dtype=np.int64)
    yy = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
    every = (n - 2) / (n_out - 2)
    indices = np.empty(n_out, dtype=np.int64)
    indices[0] = 0
    indices[-1] = n - 1
    a = 0
    for i in range(n_out - 2):
        avg_start = int(math.floor((i + 1) * every) + 1)
        avg_end = int(math.floor((i + 2) * every) + 1)
        avg_end = min(avg_end, n)
        if avg_end <= avg_start:
            avg_start = min(a + 1, n - 2)
            avg_end = min(avg_start + 1, n)
        avg_x = float(np.mean(x[avg_start:avg_end]))
        avg_y = float(np.mean(yy[avg_start:avg_end]))
        range_offs = int(math.floor(i * every) + 1)
        range_to = int(math.floor((i + 1) * every) + 1)
        range_to = min(max(range_to, range_offs + 1), n - 1)
        xs = x[range_offs:range_to]
        ys = yy[range_offs:range_to]
        if xs.size == 0:
            next_a = min(a + 1, n - 2)
        else:
            ax = float(x[a])
            ay = float(yy[a])
            areas = np.abs((ax - avg_x) * (ys - ay) - (ax - xs) * (avg_y - ay))
            next_a = int(range_offs + int(np.argmax(areas)))
        indices[i + 1] = next_a
        a = next_a
    return indices


def build_series(
    manager: DataManager,
    data_id: str,
    x_name: str,
    y_names: list[str],
    max_points: int = DEFAULT_MAX_POINTS,
    x_min: float | None = None,
    x_max: float | None = None,
) -> dict[str, Any]:
    """Downsample x + y columns. Non-finite x rows are dropped; y NaN becomes JSON null."""
    ds = manager.get(data_id)
    df = ds.df
    seen: list[str] = []
    for name in y_names:
        if name not in seen:
            seen.append(name)
    if not seen:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            "At least one y column is required",
            "chart.columnNotFound",
        )
    x_raw, x_kind = _as_x_array(_column(df, x_name), x_name)
    ys_raw = [_as_y_array(_column(df, name), name) for name in seen]
    mask = np.isfinite(x_raw)
    if x_min is not None:
        mask &= x_raw >= float(x_min)
    if x_max is not None:
        mask &= x_raw <= float(x_max)
    x_kept = x_raw[mask]
    ys_kept = [col[mask] for col in ys_raw]
    source_count = int(x_kept.size)
    if source_count < 2:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            "Not enough numeric points to plot",
            "chart.emptySeries",
        )
    cap = clamp_max_points(max_points)
    downsampled = source_count > cap
    if downsampled:
        idx = lttb_indices(x_kept, ys_kept[0], cap)
        x_kept = x_kept[idx]
        ys_kept = [col[idx] for col in ys_kept]
    return {
        "x": _json_nums(x_kept),
        "ys": [_json_nums(col) for col in ys_kept],
        "pointCount": int(x_kept.size),
        "sourceCount": source_count,
        "downsampled": downsampled,
        "xKind": x_kind,
        "maxPoints": cap,
    }
