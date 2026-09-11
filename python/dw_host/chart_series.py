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
HIST_BINS_DEFAULT = 50
HIST_BINS_MIN = 5
HIST_BINS_MAX = 200
HIST_STATS = ("count", "density", "probability", "percent")


def clamp_max_points(value: int) -> int:
    return max(MIN_MAX_POINTS, min(int(value), MAX_MAX_POINTS))


def clamp_hist_bins(value: int | None) -> int:
    if value is None:
        return HIST_BINS_DEFAULT
    return max(HIST_BINS_MIN, min(int(value), HIST_BINS_MAX))


def normalize_hist_stat(value: str | None) -> str:
    if not value:
        return "count"
    key = str(value).strip().lower()
    if key in ("frequency", "probability"):
        return "probability"
    if key not in HIST_STATS:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            "histStat must be count, density, probability, or percent",
            "chart.histStatInvalid",
        )
    return key


def hist_edges(vmin: float, vmax: float, bins: int | None, bin_width: float | None) -> np.ndarray:
    lo = float(vmin)
    hi = float(vmax)
    if lo == hi:
        lo -= 0.5
        hi += 0.5
    span = hi - lo
    if bin_width is not None and float(bin_width) > 0:
        width = float(bin_width)
        n = int(math.ceil(span / width)) if width > 0 else HIST_BINS_DEFAULT
        n = max(2, min(n, HIST_BINS_MAX))
        return np.linspace(lo, hi, n + 1)
    n_bins = clamp_hist_bins(bins)
    return np.linspace(lo, hi, n_bins + 1)


def scale_hist_counts(counts: np.ndarray, n: int, stat: str, density: bool) -> np.ndarray:
    if stat == "density" or density:
        return counts
    if n <= 0:
        return counts
    if stat == "probability":
        return counts / float(n)
    if stat == "percent":
        return counts / float(n) * 100.0
    return counts


def _unique_names(names: list[str]) -> list[str]:
    seen: list[str] = []
    for name in names:
        if name not in seen:
            seen.append(name)
    return seen


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
    seen = _unique_names(y_names)
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


def build_histogram(
    manager: DataManager,
    data_id: str,
    y_names: list[str],
    bins: int | None = None,
    x_min: float | None = None,
    x_max: float | None = None,
    bin_width: float | None = None,
    hist_stat: str | None = None,
    hist_cumulative: bool = False,
) -> dict[str, Any]:
    """Bin numeric columns in Python. Renderer only gets bin centers + counts."""
    ds = manager.get(data_id)
    df = ds.df
    seen = _unique_names(y_names)
    if not seen:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            "At least one y column is required",
            "chart.columnNotFound",
        )
    stat = normalize_hist_stat(hist_stat)
    density = stat == "density"
    cols = [_as_y_array(_column(df, name), name) for name in seen]
    kept: list[np.ndarray] = []
    for col in cols:
        mask = np.isfinite(col)
        if x_min is not None:
            mask &= col >= float(x_min)
        if x_max is not None:
            mask &= col <= float(x_max)
        kept.append(col[mask])
    source_count = int(max((arr.size for arr in kept), default=0))
    if source_count < 1:
        raise HostError(
            ErrorCode.ColumnOrValidation,
            "Not enough numeric points to plot",
            "chart.emptySeries",
        )
    vmin = min(float(arr.min()) for arr in kept if arr.size)
    vmax = max(float(arr.max()) for arr in kept if arr.size)
    edges = hist_edges(vmin, vmax, bins, bin_width)
    n_bins = int(edges.size - 1)
    centers = (edges[:-1] + edges[1:]) * 0.5
    scaled: list[np.ndarray] = []
    for arr in kept:
        counts, _ = np.histogram(arr, bins=edges, density=density)
        values = scale_hist_counts(counts.astype(np.float64, copy=False), int(arr.size), stat, density)
        if hist_cumulative:
            values = np.cumsum(values)
        scaled.append(values)
    return {
        "x": [float(v) for v in centers.tolist()],
        "ys": [[float(v) for v in col.tolist()] for col in scaled],
        "pointCount": n_bins,
        "sourceCount": source_count,
        "downsampled": False,
        "xKind": "number",
        "maxPoints": n_bins,
    }
