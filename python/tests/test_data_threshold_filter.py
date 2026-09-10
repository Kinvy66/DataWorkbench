from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataSourceNode, DataThresholdFilterNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import threshold_filter_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, 5.0, 10.0, 15.0], "b": [0.0, 1.0, 2.0, 3.0]})


def test_threshold_filter_node_matches_core() -> None:
    df = _sample_frame()
    expected = threshold_filter_impl(
        df,
        subset=["a"],
        filter_type="greater_than",
        lower=0.0,
        upper=10.0,
        row_logic="any",
        treat_nan=False,
        reindex=True,
    )
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataThresholdFilterNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"filter_type": "greater_than", "upper": 10, "subset": "a"},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["filtered"], expected)
    assert node._output_data["removed_count"] == 1


def test_threshold_filter_node_range_and_alias() -> None:
    df = _sample_frame()
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    inside = factory.create_node(DataThresholdFilterNode.qualified_name)
    assert (
        inside.execute(
            inputs={"data": df.copy()},
            params={"filter_type": "between", "lower": 5, "upper": 10, "subset": "a"},
        )
        is True
    )
    pd.testing.assert_frame_equal(
        inside._output_data["filtered"],
        threshold_filter_impl(
            df,
            subset=["a"],
            filter_type="in_range",
            lower=5.0,
            upper=10.0,
            row_logic="any",
            treat_nan=False,
            reindex=True,
        ),
    )
    assert inside._output_data["removed_count"] == 2


def test_threshold_filter_manager_matches_core() -> None:
    df = _sample_frame()
    expected = threshold_filter_impl(
        df,
        subset=["a"],
        filter_type="greater_than",
        lower=0.0,
        upper=10.0,
        row_logic="any",
        treat_nan=False,
        reindex=True,
    )
    manager = DataManager()
    dataset_id = manager.publish_dataframe("nums", df.copy())
    result = manager.threshold_filter(dataset_id, filter_type="gt", upper=10, subset=["a"])
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["removedCount"] == 1
    assert result["rows"] == 3


def test_threshold_filter_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("nums", _sample_frame())
    try:
        manager.threshold_filter(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.threshold_filter(dataset_id, filter_type="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    names_id = manager.publish_dataframe("names", pd.DataFrame({"name": ["a", "b"]}))
    try:
        manager.threshold_filter(names_id)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.thresholdNoNumeric"
    mixed_id = manager.publish_dataframe("mixed", pd.DataFrame({"a": [1.0, 2.0], "name": ["x", "y"]}))
    try:
        manager.threshold_filter(mixed_id, subset=["name"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_threshold_filter_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataThresholdFilterNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"filter_type": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"subset": "missing"}) is False
    names = pd.DataFrame({"name": ["a", "b"]})
    assert node.execute(inputs={"data": names}, params={}) is False


def test_data_source_threshold_filter_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("nums", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "nums"}) is True
    filt = factory.create_node(DataThresholdFilterNode.qualified_name)
    assert (
        filt.execute(
            inputs={"data": source._output_data["data"]},
            params={"filter_type": "greater_than", "upper": 10, "subset": "a"},
        )
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": filt._output_data["filtered"]}, params={"data_name": "kept"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["nums"]["rows"] == 4
    assert by_name["kept"]["rows"] == 3
    assert filt._output_data["removed_count"] == 1
