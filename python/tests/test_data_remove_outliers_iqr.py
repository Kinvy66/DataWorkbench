from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataRemoveOutliersIQRNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import remove_outliers_iqr_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0, 100.0], "label": ["x", "y", "z", "w", "v"]})


def test_iqr_node_remove_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_iqr_impl(df, columns=None, multiplier=1.5, action="remove", reindex=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersIQRNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"action": "remove", "multiplier": 1.5, "subset": ""}) is True
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)
    assert node._output_data["removed_count"] == 1
    assert node._output_data["replaced_count"] == 0


def test_iqr_node_replace_median_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_iqr_impl(
        df, columns=["a"], multiplier=1.5, action="replace_median", custom_value=0.0, reindex=True
    )
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersIQRNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"action": "replace_median", "multiplier": 1.5, "subset": "a"},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["cleaned"], expected)
    assert node._output_data["removed_count"] == 0
    assert node._output_data["replaced_count"] == 1


def test_iqr_manager_matches_core() -> None:
    df = _sample_frame()
    expected = remove_outliers_iqr_impl(df, columns=["a"], multiplier=1.5, action="remove", reindex=True)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.remove_outliers_iqr(dataset_id, subset=["a"], action="remove")
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["removedCount"] == 1
    assert result["replacedCount"] == 0
    assert result["rows"] == 4
    assert result["action"] == "remove"


def test_iqr_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.remove_outliers_iqr(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.remove_outliers_iqr(dataset_id, action="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.remove_outliers_iqr(dataset_id, multiplier=0)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_iqr_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataRemoveOutliersIQRNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"action": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"subset": "missing"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"multiplier": 0}) is False


def test_data_source_iqr_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    iqr = factory.create_node(DataRemoveOutliersIQRNode.qualified_name)
    assert iqr.execute(inputs={"data": source._output_data["data"]}, params={"action": "remove"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert sink.execute(inputs={"data": iqr._output_data["cleaned"]}, params={"data_name": "cleaned"}) is True
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["cleaned"]["rows"] == 4
    assert iqr._output_data["removed_count"] == 1
