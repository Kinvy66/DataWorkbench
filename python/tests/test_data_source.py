from __future__ import annotations

import pandas as pd

from dw_host.api import bind_data_manager, get_dataframe, publish_dataframe
from dw_host.data_manager import DataManager
from dw_nodes_analysis import DataQueryNode, DataSourceNode, register_analysis_nodes
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def test_get_dataframe_returns_copy() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    publish_dataframe("people", pd.DataFrame({"age": [10, 30]}))
    df = get_dataframe(dataset_name="people")
    df.loc[df.index[0], "age"] = 99
    original = manager.find_by_name("people").df
    assert int(original.iloc[0]["age"]) == 10


def test_data_source_query_to_manager() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    publish_dataframe("people", pd.DataFrame({"age": [10, 30], "name": ["a", "b"]}))
    factory = DANodeFactory()
    register_system_nodes(factory)
    register_analysis_nodes(factory)
    source = factory.create_node(DataSourceNode.qualified_name)
    assert source.execute(params={"dataset_name": "people"}) is True
    query = factory.create_node(DataQueryNode.qualified_name)
    assert (
        query.execute(inputs={"data": source._output_data["data"]}, params={"query_string": "age > 20"})
        is True
    )
    sink = factory.create_node(DataToManagerNode.qualified_name)
    assert (
        sink.execute(inputs={"data": query._output_data["result"]}, params={"data_name": "filtered"}) is True
    )
    by_name = {item["name"]: item for item in manager.list_datasets()}
    assert by_name["filtered"]["rows"] == 1
    assert source.execute(params={"dataset_name": "missing"}) is False
