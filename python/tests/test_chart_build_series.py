from __future__ import annotations

import numpy as np
import pandas as pd

from dw_host.chart_series import (
    DEFAULT_MAX_POINTS,
    HIST_BINS_DEFAULT,
    build_histogram,
    build_series,
    lttb_indices,
)
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


def test_build_series_window_filters_x() -> None:
    df = pd.DataFrame({"t": np.arange(100, dtype=float), "y": np.arange(100, dtype=float)})
    manager = DataManager()
    data_id = manager.publish_dataframe("wave", df)
    result = build_series(manager, data_id, "t", ["y"], max_points=5000, x_min=10.0, x_max=19.0)
    assert result["sourceCount"] == 10
    assert result["downsampled"] is False
    assert result["pointCount"] == 10
    assert result["x"][0] == 10.0
    assert result["x"][-1] == 19.0


def test_build_series_window_then_lttb_keeps_window_endpoints() -> None:
    n = 8000
    df = pd.DataFrame({"t": np.arange(n, dtype=float), "y": np.sin(np.linspace(0, 20, n))})
    manager = DataManager()
    data_id = manager.publish_dataframe("wave", df)
    result = build_series(manager, data_id, "t", ["y"], max_points=50, x_min=1000.0, x_max=3999.0)
    assert result["sourceCount"] == 3000
    assert result["downsampled"] is True
    assert result["pointCount"] == 50
    assert result["x"][0] == 1000.0
    assert result["x"][-1] == 3999.0


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


def test_build_histogram_counts_sum_to_source() -> None:
    values = np.concatenate([np.zeros(40), np.ones(60)])
    df = pd.DataFrame({"v": values, "w": values + 0.5})
    manager = DataManager()
    data_id = manager.publish_dataframe("bins", df)
    result = build_histogram(manager, data_id, ["v"], bins=10)
    assert result["downsampled"] is False
    assert result["sourceCount"] == 100
    assert result["pointCount"] == 10
    assert result["xKind"] == "number"
    assert len(result["x"]) == 10
    assert sum(result["ys"][0]) == 100
    both = build_histogram(manager, data_id, ["v", "w"], bins=HIST_BINS_DEFAULT)
    assert both["pointCount"] == HIST_BINS_DEFAULT
    assert len(both["ys"]) == 2
    assert len(both["x"]) == len(both["ys"][0]) == HIST_BINS_DEFAULT
    assert sum(both["ys"][0]) == 100
    assert sum(both["ys"][1]) == 100


def test_build_histogram_rejects_non_numeric() -> None:
    df = pd.DataFrame({"age": [10, 30, 18], "name": ["a", "b", "c"]})
    manager = DataManager()
    data_id = manager.publish_dataframe("people", df)
    try:
        build_histogram(manager, data_id, ["name"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "chart.nonNumeric"


def test_build_histogram_range_filter() -> None:
    df = pd.DataFrame({"v": [0.0, 1.0, 2.0, 3.0, 10.0]})
    manager = DataManager()
    data_id = manager.publish_dataframe("range", df)
    result = build_histogram(manager, data_id, ["v"], bins=5, x_min=0.0, x_max=3.0)
    assert result["sourceCount"] == 4
    assert sum(result["ys"][0]) == 4


def test_build_histogram_bin_width_caps_count() -> None:
    df = pd.DataFrame({"v": np.linspace(0.0, 10.0, 200)})
    manager = DataManager()
    data_id = manager.publish_dataframe("wide", df)
    result = build_histogram(manager, data_id, ["v"], bin_width=2.0)
    assert result["pointCount"] == 5
    assert result["x"][0] == 1.0
    assert abs(result["x"][1] - result["x"][0] - 2.0) < 1e-9
    tiny = build_histogram(manager, data_id, ["v"], bin_width=0.001)
    assert tiny["pointCount"] == 200


def test_build_histogram_probability_and_cumulative() -> None:
    values = np.concatenate([np.zeros(25), np.ones(75)])
    df = pd.DataFrame({"v": values})
    manager = DataManager()
    data_id = manager.publish_dataframe("mix", df)
    prob = build_histogram(manager, data_id, ["v"], bins=2, hist_stat="probability")
    assert abs(sum(prob["ys"][0]) - 1.0) < 1e-9
    percent = build_histogram(manager, data_id, ["v"], bins=2, hist_stat="percent")
    assert abs(sum(percent["ys"][0]) - 100.0) < 1e-9
    cum = build_histogram(manager, data_id, ["v"], bins=2, hist_cumulative=True)
    assert cum["ys"][0][-1] == 100
    density = build_histogram(manager, data_id, ["v"], bins=10, hist_stat="density")
    assert density["pointCount"] == 10
    width = (float(values.max()) - float(values.min())) / 10
    area = sum(c * width for c in density["ys"][0])
    assert abs(area - 1.0) < 0.08
    freq = build_histogram(manager, data_id, ["v"], bins=2, hist_stat="frequency")
    assert abs(sum(freq["ys"][0]) - 1.0) < 1e-9
    try:
        build_histogram(manager, data_id, ["v"], hist_stat="mode")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.i18n_key == "chart.histStatInvalid"


def test_hist_edges_bin_width() -> None:
    from dw_host.chart_series import hist_edges

    edges = hist_edges(0.0, 10.0, bins=50, bin_width=2.5)
    assert len(edges) == 5
    assert edges[0] == 0.0
    assert edges[-1] == 10.0
