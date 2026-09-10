from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataSortNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import sort_dataframe
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"age": [30, 10, 20], "name": ["c", "a", "b"]})


def test_sort_node_matches_core() -> None:
    df = _sample_frame()
    expected = sort_dataframe(df, ["age"], True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataSortNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"columns": "age", "ascending": True}) is True
    pd.testing.assert_frame_equal(node._output_data["sorted"], expected)


def test_sort_node_descending_and_multi_column() -> None:
    df = pd.DataFrame({"g": [1, 1, 2], "v": [2, 1, 0]})
    expected = sort_dataframe(df, ["g", "v"], False)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataSortNode.qualified_name)
    assert (
        node.execute(inputs={"data": df.copy()}, params={"columns": "g, v", "ascending": False}) is True
    )
    pd.testing.assert_frame_equal(node._output_data["sorted"], expected)


def test_sort_manager_matches_core() -> None:
    df = _sample_frame()
    expected = sort_dataframe(df, ["name"], False)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.sort(dataset_id, columns=["name"], ascending=False)
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["rows"] == 3
    assert result["name"] == "people"


def test_sort_manager_rejects_empty_and_unknown() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.sort(dataset_id, columns=[])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.sortColumnsEmpty"
    try:
        manager.sort(dataset_id, columns=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_sort_node_rejects_empty_and_unknown() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataSortNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"columns": ""}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"columns": "missing"}) is False


def test_data_source_sort_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    sort_node = factory.create_node(DataSortNode.qualified_name)
    assert (
        sort_node.execute(inputs={"data": source._output_data["data"]}, params={"columns": "age"}) is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": sort_node._output_data["sorted"]}, params={"data_name": "sorted"})
        is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["sorted"]["rows"] == 3
    pd.testing.assert_frame_equal(
        manager.get(by_name["sorted"]["id"]).df.reset_index(drop=True),
        sort_dataframe(_sample_frame(), ["age"], True).reset_index(drop=True),
    )
