from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import DataPivotTableNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.operations import create_pivot_table
from dw_nodes_analysis.nodes.data_pivot_table import flatten_pivot
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "category": ["A", "A", "B", "B"],
            "region": ["East", "West", "East", "West"],
            "sales": [100.0, 200.0, 150.0, 250.0],
        }
    )


def test_pivot_node_mean_matches_core() -> None:
    df = _sample_frame()
    expected = flatten_pivot(
        create_pivot_table(df, index=["category"], columns=["region"], values=["sales"], aggfunc="mean")
    )
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataPivotTableNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"index": "category", "columns": "region", "values": "sales", "aggfunc": "mean"},
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["pivot"], expected)
    pd.testing.assert_frame_equal(df, _sample_frame())


def test_pivot_node_sum_margins_matches_core() -> None:
    df = _sample_frame()
    expected = flatten_pivot(
        create_pivot_table(
            df,
            index=["category"],
            columns=["region"],
            values=["sales"],
            aggfunc="sum",
            margins=True,
            margins_name="All",
            sort=True,
        )
    )
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataPivotTableNode.qualified_name)
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={
                "index": "category",
                "columns": "region",
                "values": "sales",
                "aggfunc": "sum",
                "margins": True,
                "margins_name": "All",
                "sort": True,
            },
        )
        is True
    )
    pd.testing.assert_frame_equal(node._output_data["pivot"], expected)


def test_pivot_manager_publishes_new_dataset() -> None:
    df = _sample_frame()
    expected = flatten_pivot(
        create_pivot_table(df, index=["category"], columns=["region"], values=["sales"], aggfunc="mean")
    )
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", df.copy())
    result = manager.pivot_table(
        dataset_id, index=["category"], columns=["region"], values=["sales"], aggfunc="mean"
    )
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())
    assert result["id"] != dataset_id
    assert result["name"] == "people_PivotTable"
    assert result["aggfunc"] == "mean"
    pd.testing.assert_frame_equal(manager.get(result["id"]).df, expected)
    again = manager.pivot_table(dataset_id, index=["category"], values=["sales"])
    assert again["name"] == "people_PivotTable (2)"


def test_pivot_manager_rejects_unknown_and_invalid() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _sample_frame())
    try:
        manager.pivot_table(dataset_id, index=[], values=["sales"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.pivotIndexEmpty"
    try:
        manager.pivot_table(dataset_id, index=["missing"], values=["sales"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.columnNotFound"
    try:
        manager.pivot_table(dataset_id, index=["category"], values=["sales"], aggfunc="maybe")
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    try:
        manager.pivot_table(dataset_id, index=["category"], values=["category"])
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.ColumnOrValidation
        assert exc.i18n_key == "data.invalidValue"
    pd.testing.assert_frame_equal(manager.get(dataset_id).df, _sample_frame())


def test_pivot_node_rejects_invalid() -> None:
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    node = factory.create_node(DataPivotTableNode.qualified_name)
    df = _sample_frame()
    assert node.execute(inputs={"data": df.copy()}, params={"index": "", "values": "sales"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"index": "missing", "values": "sales"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"index": "category", "values": "sales", "aggfunc": "maybe"}) is False
    assert node.execute(inputs={"data": df.copy()}, params={"index": "category", "values": "category"}) is False


def test_data_source_pivot_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    pivot = factory.create_node(DataPivotTableNode.qualified_name)
    assert (
        pivot.execute(
            inputs={"data": source._output_data["data"]},
            params={"index": "category", "columns": "region", "values": "sales"},
        )
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert sink.execute(inputs={"data": pivot._output_data["pivot"]}, params={"data_name": "pivoted"}) is True
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["people"]["rows"] == 4
    assert by_name["pivoted"]["rows"] == len(pivot._output_data["pivot"])
    assert "category" in list(pivot._output_data["pivot"].columns)
