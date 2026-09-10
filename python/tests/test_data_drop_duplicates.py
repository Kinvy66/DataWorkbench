from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataDropDuplicatesNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import drop_duplicates_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1, 1, 2, 2], "b": [10, 10, 20, 30]})


def test_drop_duplicates_node_matches_core() -> None:
    df = _sample_frame()
    expected = drop_duplicates_impl(df, subset=None, keep="first", ignore_index=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataDropDuplicatesNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"keep": "first", "subset": ""}) is True
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)
    assert node._output_data["removed_count"] == 1


def test_drop_duplicates_node_keep_last_none_and_alias() -> None:
    df = _sample_frame()
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    last = factory.create_node(DataDropDuplicatesNode.qualified_name)
    assert last.execute(inputs={"data": df.copy()}, params={"keep": "last", "subset": "a"}) is True
    pd.testing.assert_frame_equal(
        last._output_data["cleaned"],
        drop_duplicates_impl(df, subset=["a"], keep="last", ignore_index=True),
    )
    none = factory.create_node(DataDropDuplicatesNode.qualified_name)
    assert none.execute(inputs={"data": df.copy()}, params={"keep": "false", "subset": ""}) is True
    pd.testing.assert_frame_equal(
        none._output_data["cleaned"],
        drop_duplicates_impl(df, subset=None, keep="none", ignore_index=True),
    )


def test_drop_duplicates_manager_matches_core() -> None:
    df = _sample_frame()
    expected = drop_duplicates_impl(df, subset=["a"], keep="first", ignore_index=True)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.drop_duplicates(dataset_id, keep="first", subset=["a"])
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["removedCount"] == 2
    assert result["rows"] == 2


def test_drop_duplicates_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.drop_duplicates(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.drop_duplicates(dataset_id, keep="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_drop_duplicates_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataDropDuplicatesNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"keep": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"keep": "first", "subset": "missing"}) is False


def test_data_source_drop_duplicates_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    drop = factory.create_node(DataDropDuplicatesNode.qualified_name)
    assert drop.execute(inputs={"data": source._output_data["data"]}, params={"keep": "first"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": drop._output_data["cleaned"]}, params={"data_name": "unique"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["people"]["rows"] == 4
    assert by_name["unique"]["rows"] == 3
    assert drop._output_data["removed_count"] == 1
