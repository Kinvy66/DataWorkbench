from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataDescribeNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import describe_dataframe
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0], "b": [10.0, 20.0, 30.0, 40.0]})


def _flatten(stats: pd.DataFrame) -> pd.DataFrame:
    table = stats.reset_index()
    return table.rename(columns={table.columns[0]: "stat"})


def test_describe_node_matches_core() -> None:
    df = _sample_frame()
    expected = _flatten(describe_dataframe(df, percentiles=[0.25, 0.5, 0.75]))
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataDescribeNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"percentiles": "0.25,0.5,0.75"}) is True
    pd.testing.assert_frame_equal(node._output_data["stats_data"], expected)
    pd.testing.assert_frame_equal(df, _sample_frame())


def test_describe_manager_matches_core_and_keeps_source() -> None:
    df = _sample_frame()
    expected = _flatten(describe_dataframe(df, percentiles=[0.25, 0.5, 0.75]))
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.describe(dataset_id)
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())
    assert result["id"] != dataset_id
    assert result["name"] == "people describe"
    assert result["columns"][0]["name"] == "stat"
    pd.testing.assert_frame_equal(manager.get(result["id"]).df, expected)
    again = manager.describe(dataset_id)
    assert again["name"] == "people describe (2)"


def test_describe_manager_custom_name_and_rejects_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    named = manager.describe(dataset_id, name="stats")
    assert named["name"] == "stats"
    try:
        manager.describe(dataset_id, percentiles="2")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.describe(dataset_id, percentiles="0.25,0.25")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())
    try:
        manager.describe("missing")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.DatasetNotFound


def test_describe_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataDescribeNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"percentiles": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"percentiles": "1.5"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"percentiles": "0.1,0.1"}) is False


def test_data_source_describe_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    describe = factory.create_node(DataDescribeNode.qualified_name)
    assert describe.execute(inputs={"data": source._output_data["data"]}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": describe._output_data["stats_data"]}, params={"data_name": "people stats"})
        is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["people"]["rows"] == 4
    assert by_name["people stats"]["rows"] == len(describe._output_data["stats_data"])
    assert "stat" in list(describe._output_data["stats_data"].columns)
