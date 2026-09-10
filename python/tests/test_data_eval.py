from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataEvalNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import eval_expression
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1.0, 2.0], "b": [10.0, 20.0]})


def test_eval_node_matches_core() -> None:
    df = _sample_frame()
    expected = eval_expression(df.copy(), "c = a + b")
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataEvalNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"expression": "c = a + b"}) is True
    pd.testing.assert_frame_equal(node._output_data["result"], expected)
    assert list(node._output_data["result"]["c"]) == [11.0, 22.0]


def test_eval_manager_matches_core() -> None:
    df = _sample_frame()
    expected = eval_expression(df.copy(), "c = a + b")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("nums", df.copy())
    result = manager.evaluate(dataset_id, "c = a + b")
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["cols"] == 3
    assert result["rows"] == 2


def test_eval_manager_rejects_empty_invalid_and_series() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("nums", _sample_frame())
    try:
        manager.evaluate(dataset_id, "   ")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.evalEmpty"
    try:
        manager.evaluate(dataset_id, "a +")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidEval"
    try:
        manager.evaluate(dataset_id, "a + b")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidEval"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_eval_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataEvalNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"expression": ""}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"expression": "a +"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"expression": "a + b"}) is False


def test_data_source_eval_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("nums", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "nums"}) is True
    ev = factory.create_node(DataEvalNode.qualified_name)
    assert (
        ev.execute(
            inputs={"data": source._output_data["data"]},
            params={"expression": "c = a * 2"},
        )
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert sink.execute(inputs={"data": ev._output_data["result"]}, params={"data_name": "computed"}) is True
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["nums"]["cols"] == 2
    assert by_name["computed"]["cols"] == 3
