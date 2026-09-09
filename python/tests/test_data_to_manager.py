from dw_host.api import bind_data_manager, publish_dataframe
from dw_host.data_manager import DataManager
from dw_nodes_system import DataToManagerNode, register_system_nodes
from dw_workflow import DANodeFactory


def test_publish_wraps_scalar_as_dataframe() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    dataset_id = publish_dataframe("n", 7)
    ds = manager.get(dataset_id)
    assert list(ds.df.columns) == ["value"]
    assert list(ds.df["value"]) == [7]


def test_data_to_manager_node_publishes() -> None:
    manager = DataManager()
    bind_data_manager(manager)
    factory = DANodeFactory()
    register_system_nodes(factory)
    node = factory.create_node(DataToManagerNode.qualified_name)
    assert node.execute(inputs={"data": [1, 2]}, params={"data_name": "wf"}) is True
    listed = manager.list_datasets()
    assert listed[0]["name"] == "wf"
    assert listed[0]["rows"] == 2
