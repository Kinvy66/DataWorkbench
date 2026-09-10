from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataFillNaNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import fillna_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, None, 3.0], "b": [1.0, 2.0, None]})


def test_fillna_node_matches_core() -> None:
    df = _sample_frame()
    expected = fillna_impl(df, subset=None, method="value", value=0.0, limit=None)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFillNaNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"method": "value", "value": "0", "subset": ""}) is True
    pd.testing.assert_frame_equal(node._output_data["filled"], expected)
    assert node._output_data["filled_count"] == 2


def test_fillna_node_mean_and_alias() -> None:
    df = pd.DataFrame({"a": [1.0, None, 3.0]})
    expected = fillna_impl(df, method="mean")
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFillNaNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"method": "mean"}) is True
    pd.testing.assert_frame_equal(node._output_data["filled"], expected)
    alias = factory.create_node(DataFillNaNode.qualified_name)
    assert alias.execute(inputs={"data": df.copy()}, params={"method": "ffill"}) is True
    pd.testing.assert_frame_equal(
        alias._output_data["filled"],
        fillna_impl(df, method="forward"),
    )


def test_fillna_manager_matches_core() -> None:
    df = _sample_frame()
    expected = fillna_impl(df, subset=["a"], method="value", value=0.0, limit=None)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.fillna(dataset_id, method="value", subset=["a"], value=0)
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["filledCount"] == 1
    assert result["rows"] == 3


def test_fillna_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.fillna(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.fillna(dataset_id, method="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_fillna_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataFillNaNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"method": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"method": "value", "subset": "missing"}) is False


def test_data_source_fillna_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    fill = factory.create_node(DataFillNaNode.qualified_name)
    assert fill.execute(inputs={"data": source._output_data["data"]}, params={"method": "value", "value": "0"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": fill._output_data["filled"]}, params={"data_name": "filled"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["filled"]["rows"] == 3
    assert fill._output_data["filled_count"] == 2
