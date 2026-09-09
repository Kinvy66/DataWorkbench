from dw_nodes_system import ConstantNode, DelayNode, EndNode, register_system_nodes
from dw_workflow import DAConnection, DANodeFactory, DAWorkflow, DAWorkflowSerializer


def _factory() -> DANodeFactory:
    factory = DANodeFactory()
    register_system_nodes(factory)
    return factory


def test_to_dict_from_dict_keeps_connection_and_params() -> None:
    factory = _factory()
    workflow = DAWorkflow(name="roundtrip")
    constant = factory.create_node(ConstantNode.qualified_name)
    end = factory.create_node(EndNode.qualified_name)
    constant.value = "[1, 2, 3]"
    src_id = workflow.add_node(constant)
    dst_id = workflow.add_node(end)
    workflow.add_connection(
        DAConnection(
            source_node_id=src_id,
            source_output_channel="value",
            target_node_id=dst_id,
            target_input_channel="done",
        )
    )

    serializer = DAWorkflowSerializer()
    payload = serializer.to_dict(workflow)
    restored = serializer.from_dict(payload, factory)

    assert restored.name == "roundtrip"
    assert len(restored.get_nodes()) == 2
    connections = restored.get_connections()
    assert len(connections) == 1
    conn = connections[0]
    assert conn.source_output_channel == "value"
    assert conn.target_input_channel == "done"
    assert restored.get_node_by_id(src_id).value == "[1, 2, 3]"
    assert restored.get_node_by_id(src_id).qualified_name == ConstantNode.qualified_name
    assert restored.get_node_by_id(dst_id).qualified_name == EndNode.qualified_name


def test_cycle_is_not_a_valid_dag() -> None:
    factory = _factory()
    workflow = DAWorkflow(name="cycle")
    first = factory.create_node(DelayNode.qualified_name)
    second = factory.create_node(DelayNode.qualified_name)
    first.seconds = 0.0
    second.seconds = 0.0
    id_a = workflow.add_node(first)
    id_b = workflow.add_node(second)
    workflow.add_connection(DAConnection(id_a, "done", id_b, "trigger"))
    workflow.add_connection(DAConnection(id_b, "done", id_a, "trigger"))
    assert workflow.is_valid_dag() is False
