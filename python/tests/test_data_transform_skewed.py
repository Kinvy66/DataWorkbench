from __future__ import annotations

import math

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataSourceNode, DataTransformSkewedNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import transform_skewed_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, 2.0, 4.0, 8.0], "label": ["w", "x", "y", "z"]})


def test_transform_skewed_node_log_matches_core() -> None:
    df = _sample_frame()
    expected = transform_skewed_impl(df, columns=None, method="log", lambda_value=0.5, add_one=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataTransformSkewedNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"method": "log", "subset": ""}) is True
    pd.testing.assert_frame_equal(node._output_data["transformed"], expected)
    assert node._output_data["transformed_count"] == 1
    assert node._output_data["changed_count"] == 4


def test_transform_skewed_node_power_matches_core() -> None:
    df = _sample_frame()
    expected = transform_skewed_impl(df, columns=["a"], method="power", lambda_value=2.0, add_one=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataTransformSkewedNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"method": "power", "lambda_value": 2.0, "subset": "a"},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["transformed"], expected)
    assert node._output_data["transformed_count"] == 1
    assert node._output_data["changed_count"] == 3


def test_transform_skewed_manager_matches_core() -> None:
    df = _sample_frame()
    expected = transform_skewed_impl(df, columns=["a"], method="log", lambda_value=0.5, add_one=True)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.transform_skewed(dataset_id, subset=["a"], method="log")
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["method"] == "log"
    assert result["transformedCount"] == 1
    assert result["changedCount"] == 4
    assert result["rows"] == 4


def test_transform_skewed_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.transform_skewed(dataset_id, subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.transform_skewed(dataset_id, method="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.transform_skewed(dataset_id, lambda_value=math.inf)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_transform_skewed_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataTransformSkewedNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"method": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"subset": "missing"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"lambda_value": math.inf}) is False


def test_data_source_transform_skewed_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    skewed = factory.create_node(DataTransformSkewedNode.qualified_name)
    assert skewed.execute(inputs={"data": source._output_data["data"]}, params={"method": "log"}) is True
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert sink.execute(inputs={"data": skewed._output_data["transformed"]}, params={"data_name": "skewed"}) is True
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["skewed"]["rows"] == 4
    assert skewed._output_data["changed_count"] == 4
