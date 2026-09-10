from __future__ import annotations

from pathlib import Path

import pandas as pd

from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_nodes_analysis import DataExportNode, DataSourceNode, register_analysis_nodes
from dw_nodes_analysis.core.io import export_data
from dw_nodes_system import register_system_nodes
from dw_workflow import DANodeFactory


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({"a": [1, 2], "b": ["甲", "乙"]})


def _node():
    factory = DANodeFactory()
    register_analysis_nodes(factory)
    return factory.create_node(DataExportNode.qualified_name)


def test_export_node_matches_core(tmp_path: Path) -> None:
    df = _sample_frame()
    via_node = tmp_path / "node.csv"
    via_core = tmp_path / "core.csv"
    node = _node()
    assert (
        node.execute(
            inputs={"data": df.copy()},
            params={"file_path": str(via_node), "export_format": "csv"},
        )
        is True
    )
    export_data(df, str(via_core), "csv")
    assert via_node.read_bytes() == via_core.read_bytes()
    assert node._output_data["success"] is True
    assert node._output_data["file_path_out"] == str(via_node)
    loaded = pd.read_csv(via_node)
    pd.testing.assert_frame_equal(loaded, df)


def test_export_node_excel_json_parquet_and_alias(tmp_path: Path) -> None:
    df = _sample_frame()
    node = _node()
    xlsx = tmp_path / "out.xlsx"
    assert node.execute(inputs={"data": df.copy()}, params={"file_path": str(xlsx), "export_format": "xlsx"}) is True
    loaded_x = pd.read_excel(xlsx)
    pd.testing.assert_frame_equal(loaded_x, df)

    js = tmp_path / "out.json"
    via_core = tmp_path / "core.json"
    assert node.execute(inputs={"data": df.copy()}, params={"file_path": str(js), "export_format": "json"}) is True
    export_data(df, str(via_core), "json")
    assert js.read_bytes() == via_core.read_bytes()

    pq = tmp_path / "out.parquet"
    assert node.execute(inputs={"data": df.copy()}, params={"file_path": str(pq), "export_format": "parquet"}) is True
    pd.testing.assert_frame_equal(pd.read_parquet(pq), df)


def test_export_node_creates_parent_dir(tmp_path: Path) -> None:
    dest = tmp_path / "nested" / "more" / "out.csv"
    node = _node()
    assert node.execute(inputs={"data": _sample_frame()}, params={"file_path": str(dest), "export_format": "csv"}) is True
    assert dest.is_file()


def test_export_node_rejects_empty_pickle_and_bad_format(tmp_path: Path) -> None:
    df = _sample_frame()
    node = _node()
    assert node.execute(inputs={"data": df}, params={"file_path": "", "export_format": "csv"}) is False
    pickle_path = tmp_path / "out.pkl"
    assert node.execute(inputs={"data": df}, params={"file_path": str(pickle_path), "export_format": "pickle"}) is False
    assert not pickle_path.exists()
    assert node.execute(inputs={"data": df}, params={"file_path": str(tmp_path / "x.csv"), "export_format": "html"}) is False
    assert node.execute(inputs={}, params={"file_path": str(tmp_path / "x.csv")}) is False


def test_data_source_export_writes_file(tmp_path: Path) -> None:
    manager = DataManager()
    bind_data_manager(manager)
    manager.publish_dataframe("people", _sample_frame())
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    export = factory.create_node(DataExportNode.qualified_name)
    dest = tmp_path / "people.csv"
    assert (
        export.execute(
            inputs={"data": source._output_data["data"]},
            params={"file_path": str(dest), "export_format": "csv"},
        )
        is True
    )
    loaded = pd.read_csv(dest)
    pd.testing.assert_frame_equal(loaded, _sample_frame())
    pd.testing.assert_frame_equal(manager.find_by_name("people").df, _sample_frame())
