from __future__ import annotations

import pandas as pd

from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataQueryNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import query_dataframe
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"age": [10, 30], "name": ["a", "b"]})


def test_query_node_matches_core() -> None:
    df = _sample_frame()
    expected = query_dataframe(df, "age > 20")
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataQueryNode.qualified_name)
    assert node.execute(inputs={"data": df.copy()}, params={"query_string": "age > 20"}) is True
    pd.testing.assert_frame_equal(node._output_data["result"], expected)
    assert node._output_data["row_count"] == 1


def test_query_manager_matches_core() -> None:
    df = _sample_frame()
    expected = query_dataframe(df, "age > 20")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.query(dataset_id, "age > 20")
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["matchedCount"] == 1
    assert result["removedCount"] == 1
    assert result["rows"] == 1


def test_query_manager_rejects_empty_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.query(dataset_id, "   ")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.queryEmpty"
    try:
        manager.query(dataset_id, "not_a_column > 1")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidQuery"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())
