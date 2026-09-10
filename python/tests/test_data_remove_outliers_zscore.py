from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataRemoveOutliersZScoreNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import remove_outliers_zscore_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [0.0] * 20 + [100.0], "label": [f"r{i}" for i in range(21)]})


def test_zscore_node_remove_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_zscore_impl(df, columns=None, threshold=3.0, action="remove", reindex=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersZScoreNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"action": "remove", "threshold": 3.0, "subset": ""}) is True
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)
    assert node._output_data["removed_count"] == 1
    assert node._output_data["replaced_count"] == 0


def test_zscore_node_replace_median_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_zscore_impl(
        df, columns=["a"], threshold=3.0, action="replace_median", custom_value=0.0, reindex=True
    )
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersZScoreNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"action": "replace_median", "threshold": 3.0, "subset": "a"},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)
    assert node._output_data["removed_count"] == 0
    assert node._output_data["replaced_count"] == 1


def test_zscore_node_robust_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_zscore_impl(df, columns=["a"], threshold=3.0, robust=True, action="remove", reindex=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersZScoreNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"threshold": 3.0, "robust": True, "subset": "a"}) is True
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)


def test_zscore_manager_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_zscore_impl(df, columns=["a"], threshold=3.0, action="remove", reindex=True)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.remove_outliers_zscore(dataset_id, subset=["a"], action="remove")
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["removedCount"] == 1
    assert result["replacedCount"] == 0
    assert result["rows"] == 20
    assert result["action"] == "remove"
    assert result["robust"] is False


def test_zscore_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.remove_outliers_zscore(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.remove_outliers_zscore(dataset_id, action="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.remove_outliers_zscore(dataset_id, threshold=0)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_zscore_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersZScoreNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"action": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"subset": "missing"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"threshold": 0}) is False


def test_data_source_zscore_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    zscore = factory.create_node(DataRemoveOutliersZScoreNode.qualified_name)
    assert zscore.execute(inputs={"data": source._output_data["data"]}, params={"action": "remove"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert sink.execute(inputs={"data": zscore._output_data["cleaned"]}, params={"data_name": "cleaned"}) is True
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["cleaned"]["rows"] == 20
    assert zscore._output_data["removed_count"] == 1
