from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataReplaceValuesNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.cleaning import replace_values_impl
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": ["x", "y", "x"], "b": [1.0, 2.0, 1.0]})


def test_replace_values_node_matches_core() -> None:
    df = _sample_frame()
    expected = replace_values_impl(df, subset=["a"], old_values=["x"], new_value="z", case_sensitive=True)
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataReplaceValuesNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"old_values": "x", "new_value": "z", "subset": "a", "case_sensitive": True},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["replaced"], expected)
    assert node._output_data["replaced_count"] == 2


def test_replace_values_node_numeric_and_casefold() -> None:
    df = _sample_frame()
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    numeric = factory.create_node(DataReplaceValuesNode.qualified_name)
    assert (
        numeric.execute(
            inputs={"data": df.copy()},
            params={"old_values": "1", "new_value": "9", "subset": "b"},
        )
        is True
    )
    pd.testing.assert_frame_equal(
        numeric._output_data["replaced"],
        replace_values_impl(df, subset=["b"], old_values=["1"], new_value=9.0, case_sensitive=True),
    )
    assert numeric._output_data["replaced_count"] == 2
    names = pd.DataFrame({"name": ["Bob", "bob", "Ann"]})
    folded = factory.create_node(DataReplaceValuesNode.qualified_name)
    assert (
        folded.execute(
            inputs={"data": names.copy()},
            params={"old_values": "bob", "new_value": "Robert", "case_sensitive": "false"},
        )
        is True
    )
    pd.testing.assert_frame_equal(
        folded._output_data["replaced"],
        replace_values_impl(
            names, subset=None, old_values=["bob"], new_value="Robert", case_sensitive=False
        ),
    )
    assert folded._output_data["replaced_count"] == 2


def test_replace_values_manager_matches_core() -> None:
    df = _sample_frame()
    expected = replace_values_impl(df, subset=["a"], old_values=["x"], new_value="z", case_sensitive=True)
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.replace_values(dataset_id, old_values=["x"], new_value="z", subset=["a"])
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, expected)
    assert result["replacedCount"] == 2
    assert result["rows"] == 3


def test_replace_values_manager_rejects_unknown_and_empty() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.replace_values(dataset_id, old_values=["x"], subset=["missing"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.replace_values(dataset_id, old_values=[])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.replaceOldEmpty"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_replace_values_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataReplaceValuesNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"old_values": ""}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"old_values": "x", "subset": "missing"}) is False
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"old_values": "x", "case_sensitive": "maybe"},
        )
        is False
    )


def test_data_source_replace_values_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    replace = factory.create_node(DataReplaceValuesNode.qualified_name)
    assert (
        replace.execute(
            inputs={"data": source._output_data["data"]},
            params={"old_values": "x", "new_value": "z", "subset": "a"},
        )
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": replace._output_data["replaced"]}, params={"data_name": "swapped"})
        is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["people"]["rows"] == 3
    assert by_name["swapped"]["rows"] == 3
    assert replace._output_data["replaced_count"] == 2
