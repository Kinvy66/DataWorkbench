from dw_host.workflow_runtime import WorkflowRuntime
from dw_nodes_system import TextViewerNode, register_system_nodes
from dw_workflow import DANodeFactory, DAWorkflow, DAWorkflowSerializer


def _factory() -> DANodeFactory:
    factory = DANodeFactory()
    register_system_nodes(factory)
    return factory


def _viewer():
    return _factory().create_node(TextViewerNode.qualified_name)


def test_execute_stringifies_input() -> None:
    node = _viewer()
    assert node.execute(inputs={"value": 42}) is True
    assert node.serialize_runtime_state() == {"display_text": "42"}


def test_none_input_clears_display_text() -> None:
    node = _viewer()
    assert node.execute(inputs={"value": None}) is True
    assert node.serialize_runtime_state() == {"display_text": ""}


def test_unprintable_fallback() -> None:
    class Boom:
        def __str__(self) -> str:
            raise RuntimeError("nope")

    node = _viewer()
    assert node.execute(inputs={"value": Boom()}) is True
    assert node.serialize_runtime_state() == {"display_text": "<unprintable>"}


def test_runtime_state_roundtrip() -> None:
    factory = _factory()
    workflow = DAWorkflow(name="tv")
    node = factory.create_node(TextViewerNode.qualified_name)
    assert node.execute(inputs={"value": "hello"}) is True
    workflow.add_node(node)
    serializer = DAWorkflowSerializer()
    restored = serializer.from_dict(serializer.to_dict(workflow), factory)
    loaded = restored.get_nodes()[0]
    assert loaded.serialize_runtime_state() == {"display_text": "hello"}
    assert loaded._display_text == "hello"


def test_get_graph_includes_display_text() -> None:
    runtime = WorkflowRuntime(notify=lambda _method, _params: None)
    workflow_id = runtime.create("tv")["workflowId"]
    added = runtime.add_node(workflow_id, TextViewerNode.qualified_name)
    node = runtime._session(workflow_id).workflow.get_node_by_id(added["nodeId"])
    assert node.execute(inputs={"value": "hello"}) is True
    graph = runtime.get_graph(workflow_id)
    item = next(n for n in graph["nodes"] if n["nodeId"] == added["nodeId"])
    assert item["runtimeState"]["displayText"] == "hello"


def test_node_state_notify_includes_display_text() -> None:
    seen: list[tuple[str, dict]] = []
    runtime = WorkflowRuntime(notify=lambda method, params: seen.append((method, params)))
    workflow_id = runtime.create("tv")["workflowId"]
    added = runtime.add_node(workflow_id, TextViewerNode.qualified_name)
    node = runtime._session(workflow_id).workflow.get_node_by_id(added["nodeId"])
    assert node.execute(inputs={"value": "hello"}) is True
    node.set_node_state("success")
    display = [
        params.get("displayText")
        for method, params in seen
        if method == "workflow.nodeState" and params.get("nodeId") == added["nodeId"]
    ]
    assert "hello" in display
