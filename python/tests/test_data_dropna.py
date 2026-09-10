from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataDropNaNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import dropna_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, None, 3.0], "b": [1.0, 2.0, None]})


def test_dropna_node_matches_core() -> None:
    df = _sample_frame()
    expected = dropna_impl(df, subset=None, how="any", min_non_na=0, reindex=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataDropNaNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"how": "any", "subset": "", "thresh": 0}) is True
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)
    assert node._output_data["removed_count"] == 2


def test_dropna_manager_matches_core() -> None:
    df = _sample_frame()
    expected = dropna_impl(df, subset=["a"], how="any", min_non_na=0, reindex=True)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.dropna(dataset_id, how="any", subset=["a"])
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["removedCount"] == 1
    assert result["rows"] == 2


def test_dropna_manager_rejects_unknown_column() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.dropna(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"


def test_data_source_dropna_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    drop = factory.create_node(DataDropNaNode.qualified_name)
    assert drop.execute(inputs={"data": source._output_data["data"]}, params={"how": "all"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": drop._output_data["cleaned"]}, params={"data_name": "cleaned"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    # how=all keeps every row that is not entirely NA
    assert by_name["cleaned"]["rows"] == 3
    assert drop._output_data["removed_count"] == 0
