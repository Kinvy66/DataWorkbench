from dw_host.workflow_runtime import WorkflowRuntime
from dw_nodes_system import ConstantNode, EndNode


def test_get_graph_after_load_keeps_ids_and_ports() -> None:
    runtime = WorkflowRuntime(notify=lambda _method, _params: None)
    created = runtime.create("wrap")
    workflow_id = created["workflowId"]
    src = runtime.add_node(workflow_id, ConstantNode.qualified_name)
    dst = runtime.add_node(workflow_id, EndNode.qualified_name)
    runtime.set_param(workflow_id, src["nodeId"], "value", "[1, 2]")
    runtime.connect(workflow_id, src["nodeId"], "value", dst["nodeId"], "done")

    dumped = runtime.dump_logic(workflow_id)
    loaded = runtime.load_logic(dumped["payload"], "json")
    graph = runtime.get_graph(loaded["workflowId"])

    assert graph["workflowId"] == loaded["workflowId"]
    assert {item["nodeId"] for item in graph["nodes"]} == {item["node_id"] for item in dumped["payload"]["nodes"]}
    assert len(graph["connections"]) == 1
    conn = graph["connections"][0]
    assert conn["fromPort"] == "value"
    assert conn["toPort"] == "done"
    constant = next(item for item in graph["nodes"] if item["qualifiedName"] == ConstantNode.qualified_name)
    assert constant["parameters"]["value"] == "[1, 2]"

    replaced = runtime.load_logic(dumped["payload"], "json", workflow_id)
    assert replaced["workflowId"] == workflow_id
    graph2 = runtime.get_graph(workflow_id)
    assert {item["nodeId"] for item in graph2["nodes"]} == {item["nodeId"] for item in graph["nodes"]}
