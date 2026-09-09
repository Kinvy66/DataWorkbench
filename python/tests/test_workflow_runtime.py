from __future__ import annotations

import time

from dw_host.workflow_runtime import WorkflowRuntime
from dw_nodes_system import ConstantNode, DelayNode, EndNode, StartNode


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


def test_add_node_and_connect_reuse_ids() -> None:
    runtime = WorkflowRuntime(notify=lambda _method, _params: None)
    workflow_id = runtime.create("ids")["workflowId"]
    src = runtime.add_node(workflow_id, ConstantNode.qualified_name, node_id="keep-src")
    dst = runtime.add_node(workflow_id, EndNode.qualified_name, node_id="keep-dst")
    assert src["nodeId"] == "keep-src"
    connected = runtime.connect(workflow_id, src["nodeId"], "value", dst["nodeId"], "done", "keep-edge")
    assert connected["connectionId"] == "keep-edge"
    runtime.remove_node(workflow_id, "keep-src")
    restored = runtime.add_node(workflow_id, ConstantNode.qualified_name, node_id="keep-src")
    assert restored["nodeId"] == "keep-src"
    again = runtime.connect(workflow_id, "keep-src", "value", "keep-dst", "done", "keep-edge")
    assert again["connectionId"] == "keep-edge"


def test_stop_interrupts_delay_wait() -> None:
    notes: list[tuple[str, dict]] = []
    runtime = WorkflowRuntime(notify=lambda method, params: notes.append((method, params)))
    workflow_id = runtime.create("delay-stop")["workflowId"]
    start = runtime.add_node(workflow_id, StartNode.qualified_name)
    delay = runtime.add_node(workflow_id, DelayNode.qualified_name)
    runtime.set_param(workflow_id, delay["nodeId"], "seconds", 5)
    runtime.connect(workflow_id, start["nodeId"], "trigger", delay["nodeId"], "trigger")

    deferred = runtime.schedule_execute(workflow_id)
    deferred.start()
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        if any(
            method == "workflow.nodeState"
            and params.get("nodeId") == delay["nodeId"]
            and params.get("state") == "running"
            for method, params in notes
        ):
            break
        time.sleep(0.01)
    else:
        raise AssertionError(f"Delay never reached running: {notes!r}")

    t0 = time.monotonic()
    assert runtime.stop(workflow_id) == {"ok": True}
    while time.monotonic() - t0 < 2:
        if any(method == "workflow.finished" for method, _params in notes):
            break
        time.sleep(0.01)
    else:
        raise AssertionError(f"no workflow.finished after stop: {notes!r}")

    assert time.monotonic() - t0 < 1.5
    finished = next(params for method, params in reversed(notes) if method == "workflow.finished")
    assert finished["workflowId"] == workflow_id
    assert finished.get("cancelled") is True
    assert finished["ok"] is False

