from __future__ import annotations

import numpy as np
import pandas as pd

from dw_host.chart_series import DEFAULT_MAX_POINTS, build_series, lttb_indices
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError


def test_lttb_keeps_endpoints_and_caps_length() -> None:
    x = np.linspace(0.0, 10.0, 1000)
    y = np.sin(x)
    idx = lttb_indices(x, y, 50)
    assert idx[0] == 0
    assert idx[-1] == 999
    assert len(idx) == 50
    assert np.all(np.diff(idx) >= 0)


def test_build_series_downsamples_and_keeps_numeric_y() -> None:
    n = 8000
    df = pd.DataFrame({"t": np.arange(n, dtype=float), "ch1": np.sin(np.linspace(0, 20, n))})
    manager = DataManager()
    data_id = manager.publish_dataframe("wave", df)
    result = build_series(manager, data_id, "t", ["ch1"], max_points=DEFAULT_MAX_POINTS)
    assert result["downsampled"] is True
    assert result["sourceCount"] == n
    assert result["pointCount"] == DEFAULT_MAX_POINTS
    assert result["xKind"] == "number"
    assert len(result["x"]) == DEFAULT_MAX_POINTS
    assert len(result["ys"][0]) == DEFAULT_MAX_POINTS
    assert result["x"][0] == 0.0
    assert result["x"][-1] == float(n - 1)
    assert all(v is None or isinstance(v, float) for v in result["ys"][0])


def test_build_series_datetime_x_is_epoch_ms() -> None:
    times = pd.date_range("2024-01-01", periods=4, freq="h")
    df = pd.DataFrame({"t": times, "y": [1.0, 2.0, 3.0, 4.0]})
    manager = DataManager()
    data_id = manager.publish_dataframe("series", df)
    converted = pd.to_datetime(times, utc=True)
    result = build_series(manager, data_id, "t", ["y"])
    assert result["xKind"] == "time"
    assert result["downsampled"] is False
    expected = converted.astype("int64").to_numpy(dtype=np.float64) / 1e6
    assert result["x"][0] == float(expected[0])
    assert result["x"][-1] == float(expected[-1])


def test_build_series_y_nan_becomes_null() -> None:
    df = pd.DataFrame({"x": [0.0, 1.0, 2.0, 3.0], "y": [1.0, np.nan, 3.0, 4.0]})
    manager = DataManager()
    data_id = manager.publish_dataframe("gaps", df)
    result = build_series(manager, data_id, "x", ["y"])
    assert result["ys"][0][1] is None
    assert result["ys"][0][0] == 1.0


def test_build_series_rejects_non_numeric_y() -> None:
    df = pd.DataFrame({"age": [10, 30, 18], "name": ["a", "b", "c"]})
    manager = DataManager()
    data_id = manager.publish_dataframe("people", df)
    try:
        build_series(manager, data_id, "age", ["name"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "chart.nonNumeric"


def test_build_series_missing_dataset() -> None:
    manager = DataManager()
    try:
        build_series(manager, "missing", "x", ["y"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.DatasetNotFound
        assert exc.i18n_key == "data.notFound"
