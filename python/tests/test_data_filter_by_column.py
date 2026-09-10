from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataFilterByColumnNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import filter_by_column_range
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, 5.0, 10.0, 15.0], "b": [0.0, 1.0, 2.0, 3.0]})


def test_filter_by_column_node_matches_core() -> None:
    df = _sample_frame()
    expected = filter_by_column_range(df, "a", min_val=5.0, max_val=10.0)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFilterByColumnNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"column": "a", "min_value": "5", "max_value": "10"},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["filtered"], expected)
    assert node._output_data["removed_count"] == 2


def test_filter_by_column_node_min_only_and_zero_bound() -> None:
    df = pd.DataFrame({"a": [-1.0, 0.0, 1.0]})
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFilterByColumnNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"column": "a", "min_value": "0"}) is True
    pd.testing.assert_frame_equal(
        node._output_data["filtered"],
        filter_by_column_range(df, "a", min_val=0.0, max_val=None),
    )
    assert node._output_data["removed_count"] == 1


def test_filter_by_column_manager_matches_core() -> None:
    df = _sample_frame()
    expected = filter_by_column_range(df, "a", min_val=5.0, max_val=10.0)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("nums", df.copy())
    result = manager.filter_by_column(dataset_id, column="a", min_val=5, max_val=10)
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["removedCount"] == 2
    assert result["matchedCount"] == 2
    assert result["rows"] == 2


def test_filter_by_column_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("nums", _sample_frame())
    try:
        manager.filter_by_column(dataset_id, column="")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.filterByColumnColumnEmpty"
    try:
        manager.filter_by_column(dataset_id, column="missing")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    names_id = manager.publish_dataframe("names", pd.DataFrame({"name": ["a", "b"]}))
    try:
        manager.filter_by_column(names_id, column="name", min_val=0)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_filter_by_column_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFilterByColumnNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"column": ""}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"column": "missing"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"column": "a", "min_value": "nope"}) is False
    names = pd.DataFrame({"name": ["a", "b"]})
    assert node.execute(inputs={"data": names}, params={"column": "name"}) is False


def test_data_source_filter_by_column_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("nums", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "nums"}) is True
    filt = factory.create_node(DataFilterByColumnNode.qualified_name)
    assert (
        filt.execute(
            inputs={"data": source._output_data["data"]},
            params={"column": "a", "min_value": 5, "max_value": 10},
        )
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": filt._output_data["filtered"]}, params={"data_name": "kept"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["nums"]["rows"] == 4
    assert by_name["kept"]["rows"] == 2
    assert filt._output_data["removed_count"] == 2
