from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataFillInterpolateNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import interpolate_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, None, 3.0], "b": [10.0, None, 30.0]})


def test_interpolate_node_matches_core() -> None:
    df = _sample_frame()
    expected = interpolate_impl(df, subset=None, method="linear", limit=None, order=3)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFillInterpolateNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"method": "linear", "order": 3, "limit": 0, "subset": ""}) is True
    pd.testing.assert_frame_equal(node._output_data["interpolated"], expected)
    assert node._output_data["filled_count"] == 2


def test_interpolate_node_spline_matches_core() -> None:
    df = pd.DataFrame({"a": [1.0, None, None, 4.0]})
    expected = interpolate_impl(df, method="spline", order=2)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFillInterpolateNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"method": "spline", "order": 2}) is True
    pd.testing.assert_frame_equal(node._output_data["interpolated"], expected)


def test_interpolate_manager_matches_core() -> None:
    df = _sample_frame()
    expected = interpolate_impl(df, subset=["a"], method="linear", limit=None, order=3)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.interpolate(dataset_id, method="linear", subset=["a"])
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["filledCount"] == 1
    assert result["rows"] == 3


def test_interpolate_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.interpolate(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.interpolate(dataset_id, method="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.interpolate(dataset_id, order=0)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.interpolate(dataset_id, limit=-1)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_interpolate_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFillInterpolateNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"method": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"method": "linear", "subset": "missing"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"method": "linear", "order": 0}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"method": "linear", "limit": -2}) is False


def test_data_source_interpolate_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    fill = factory.create_node(DataFillInterpolateNode.qualified_name)
    assert fill.execute(inputs={"data": source._output_data["data"]}, params={"method": "linear"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": fill._output_data["interpolated"]}, params={"data_name": "interpolated"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["interpolated"]["rows"] == 3
    assert fill._output_data["filled_count"] == 2
