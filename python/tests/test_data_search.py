from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataSearchNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import search_dataframe
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "name": ["Alice", "Bob", "Charlie"],
            "city": ["Beijing", "Shanghai", "Beijing"],
            "age": [25, 30, 35],
        }
    )


def test_search_node_matches_core() -> None:
    df = _sample_frame()
    expected = search_dataframe(df.copy(), "city", "bei")
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataSearchNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"column": "city", "pattern": "bei"}) is True
    pd.testing.assert_frame_equal(node._output_data["result"], expected)
    assert node._output_data["match_count"] == 2


def test_search_manager_matches_core() -> None:
    df = _sample_frame()
    expected = search_dataframe(df.copy(), "city", "bei")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.search(dataset_id, column="city", pattern="bei")
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["matchedCount"] == 2
    assert result["removedCount"] == 1
    assert result["rows"] == 2


def test_search_case_sensitive_and_regex() -> None:
    df = _sample_frame()
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataSearchNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"column": "name", "pattern": "alice", "case_sensitive": True},
        )
        is True
    )
    assert node._output_data["match_count"] == 0
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"column": "name", "pattern": "^A|^B"},
        )
        is True
    )
    assert node._output_data["match_count"] == 2
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    sensitive = manager.search(dataset_id, column="name", pattern="alice", case_sensitive=True)
    assert sensitive["matchedCount"] == 0
    assert sensitive["rows"] == 0


def test_search_manager_rejects_empty_unknown_and_nontext() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.search(dataset_id, column="", pattern="bei")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.searchColumnEmpty"
    try:
        manager.search(dataset_id, column="city", pattern="   ")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.searchPatternEmpty"
    try:
        manager.search(dataset_id, column="missing", pattern="bei")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.search(dataset_id, column="age", pattern="25")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidSearch"
    try:
        manager.search(dataset_id, column="name", pattern="[")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidSearch"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_search_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataSearchNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"column": "", "pattern": "bei"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"column": "city", "pattern": ""}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"column": "missing", "pattern": "bei"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"column": "age", "pattern": "25"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"column": "name", "pattern": "["}) is False


def test_data_source_search_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    search = factory.create_node(DataSearchNode.qualified_name)
    assert (
        search.execute(
            inputs={"data": source._output_data["data"]},
            params={"column": "city", "pattern": "bei"},
        )
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert sink.execute(inputs={"data": search._output_data["result"]}, params={"data_name": "hits"}) is True
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["people"]["rows"] == 3
    assert by_name["hits"]["rows"] == 2
    assert search._output_data["match_count"] == 2
