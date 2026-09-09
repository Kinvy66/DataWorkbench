from __future__ import annotations

import json
import time
from pathlib import Path

from dw_nodes_analysis import DataQueryNode, DataSourceNode
from dw_nodes_system import ConstantNode, DataToManagerNode, DelayNode, EndNode, StartNode
from rpc_client import popen, read_rpc, readline, send

START = StartNode.qualified_name
CONSTANT = ConstantNode.qualified_name
DATAMGR = DataToManagerNode.qualified_name
SOURCE = DataSourceNode.qualified_name
QUERY = DataQueryNode.qualified_name
END = EndNode.qualified_name
DELAY = DelayNode.qualified_name


def _ready(proc):
    ready = json.loads(readline(proc))
    assert ready["method"] == "host.ready"
    return ready


def _rpc(proc, req_id: int, method: str, params: dict):
    send(proc, {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params})
    return read_rpc(proc)


def _drain_until_finished(proc, workflow_id: str, limit: int = 40) -> list[dict]:
    seen: list[dict] = []
    for _ in range(limit):
        msg = read_rpc(proc)
        seen.append(msg)
        if msg.get("method") == "workflow.finished":
            assert msg["params"]["workflowId"] == workflow_id
            return seen
    raise AssertionError(f"no workflow.finished in {seen!r}")


def test_workflow_create_add_dump_load_without_addnode() -> None:
    proc = popen()
    try:
        _ready(proc)
        created = _rpc(proc, 1, "workflow.create", {"name": "logic"})
        wf = created["result"]["workflowId"]
        added = _rpc(
            proc,
            2,
            "workflow.addNode",
            {"workflowId": wf, "qualifiedName": CONSTANT},
        )
        node_id = added["result"]["nodeId"]
        _rpc(
            proc,
            3,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": node_id, "name": "value", "value": "[1, 2]"},
        )
        end = _rpc(proc, 4, "workflow.addNode", {"workflowId": wf, "qualifiedName": END})
        _rpc(
            proc,
            5,
            "workflow.connect",
            {
                "workflowId": wf,
                "fromId": node_id,
                "fromPort": "value",
                "toId": end["result"]["nodeId"],
                "toPort": "done",
            },
        )
        dumped = _rpc(proc, 6, "workflow.dumpLogic", {"workflowId": wf})
        payload = dumped["result"]["payload"]
        assert dumped["result"]["format"] == "json"
        assert len(payload["nodes"]) == 2
        assert len(payload["connections"]) == 1

        loaded = _rpc(proc, 7, "workflow.loadLogic", {"payload": payload, "format": "json"})
        wf2 = loaded["result"]["workflowId"]
        assert wf2 != wf
        dumped2 = _rpc(proc, 8, "workflow.dumpLogic", {"workflowId": wf2})
        assert dumped2["result"]["payload"]["nodes"] == payload["nodes"]
        assert dumped2["result"]["payload"]["connections"] == payload["connections"]

        graph = _rpc(proc, 9, "workflow.getGraph", {"workflowId": wf2})
        assert graph["result"]["workflowId"] == wf2
        node_ids = {item["nodeId"] for item in graph["result"]["nodes"]}
        assert node_ids == {item["node_id"] for item in payload["nodes"]}
        assert len(graph["result"]["connections"]) == 1
        conn = graph["result"]["connections"][0]
        assert conn["fromPort"] == "value"
        assert conn["toPort"] == "done"
        assert "connectionId" in conn

        inplace = _rpc(
            proc,
            10,
            "workflow.loadLogic",
            {"payload": payload, "format": "json", "workflowId": wf2},
        )
        assert inplace["result"]["workflowId"] == wf2
        graph2 = _rpc(proc, 11, "workflow.getGraph", {"workflowId": wf2})
        assert {item["nodeId"] for item in graph2["result"]["nodes"]} == node_ids

        missing = _rpc(
            proc,
            12,
            "workflow.addNode",
            {"workflowId": wf2, "qualifiedName": "no.such.Node"},
        )
        assert missing["error"]["code"] == 2001
        assert missing["error"]["data"]["i18nKey"] == "workflow.unknownType"

        send(proc, {"jsonrpc": "2.0", "id": 13, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_workflow_execute_emits_finished() -> None:
    proc = popen()
    try:
        _ready(proc)
        wf = _rpc(proc, 1, "workflow.create", {"name": "run"})["result"]["workflowId"]
        node_id = _rpc(
            proc,
            2,
            "workflow.addNode",
            {"workflowId": wf, "qualifiedName": CONSTANT},
        )["result"]["nodeId"]
        _rpc(
            proc,
            3,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": node_id, "name": "value", "value": "'rpc'"},
        )
        accepted = _rpc(proc, 4, "workflow.execute", {"workflowId": wf})
        assert accepted["result"]["accepted"] is True
        events = _drain_until_finished(proc, wf)
        finished = events[-1]
        assert finished["params"]["ok"] is True
        states = [m["params"]["state"] for m in events if m.get("method") == "workflow.nodeState"]
        assert "running" in states
        assert "ok" in states
        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_workflow_duplicate_connect_and_cycle() -> None:
    proc = popen()
    try:
        _ready(proc)
        wf = _rpc(proc, 1, "workflow.create", {"name": "cycle"})["result"]["workflowId"]
        a = _rpc(proc, 2, "workflow.addNode", {"workflowId": wf, "qualifiedName": DELAY})["result"]["nodeId"]
        b = _rpc(proc, 3, "workflow.addNode", {"workflowId": wf, "qualifiedName": DELAY})["result"]["nodeId"]
        _rpc(
            proc,
            4,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": a, "name": "seconds", "value": 0},
        )
        _rpc(
            proc,
            5,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": b, "name": "seconds", "value": 0},
        )
        first = _rpc(
            proc,
            6,
            "workflow.connect",
            {"workflowId": wf, "fromId": a, "fromPort": "done", "toId": b, "toPort": "trigger"},
        )
        assert "connectionId" in first["result"]
        dup = _rpc(
            proc,
            7,
            "workflow.connect",
            {"workflowId": wf, "fromId": a, "fromPort": "done", "toId": b, "toPort": "trigger"},
        )
        assert dup["error"]["data"]["i18nKey"] == "workflow.duplicateConnection"
        _rpc(
            proc,
            8,
            "workflow.connect",
            {"workflowId": wf, "fromId": b, "fromPort": "done", "toId": a, "toPort": "trigger"},
        )
        cycled = _rpc(proc, 9, "workflow.execute", {"workflowId": wf})
        assert cycled["error"]["code"] == 2002
        assert cycled["error"]["data"]["i18nKey"] == "workflow.cycle"
        send(proc, {"jsonrpc": "2.0", "id": 10, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_list_node_types_includes_system_set() -> None:
    proc = popen()
    try:
        _ready(proc)
        listed = _rpc(proc, 1, "workflow.listNodeTypes", {})
        names = {item["qualifiedName"] for item in listed["result"]["types"]}
        assert CONSTANT in names
        assert DATAMGR in names
        assert DELAY in names
        assert SOURCE in names
        assert QUERY in names
        constant = next(item for item in listed["result"]["types"] if item["qualifiedName"] == CONSTANT)
        assert any(p["name"] == "value" for p in constant["outputs"])
        assert any(p["name"] == "value" and p["type"] == "code" for p in constant["parameters"])
        send(proc, {"jsonrpc": "2.0", "id": 2, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_constant_to_datamanager_appears_in_data_list() -> None:
    proc = popen()
    try:
        _ready(proc)
        created = _rpc(proc, 1, "workflow.create", {"name": "publish"})
        wf = created["result"]["workflowId"]
        src = _rpc(proc, 2, "workflow.addNode", {"workflowId": wf, "qualifiedName": CONSTANT})
        dst = _rpc(proc, 3, "workflow.addNode", {"workflowId": wf, "qualifiedName": DATAMGR})
        src_id = src["result"]["nodeId"]
        dst_id = dst["result"]["nodeId"]
        _rpc(
            proc,
            4,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": src_id, "name": "value", "value": "[10, 20]"},
        )
        _rpc(
            proc,
            5,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": dst_id, "name": "data_name", "value": "from_workflow"},
        )
        _rpc(
            proc,
            6,
            "workflow.connect",
            {
                "workflowId": wf,
                "fromId": src_id,
                "fromPort": "value",
                "toId": dst_id,
                "toPort": "data",
            },
        )
        accepted = _rpc(proc, 7, "workflow.execute", {"workflowId": wf})
        assert accepted["result"]["accepted"] is True
        notes = _drain_until_finished(proc, wf)
        finished = notes[-1]
        assert finished["params"]["ok"] is True
        listed = _rpc(proc, 8, "data.list", {})
        names = {item["name"] for item in listed["result"]["datasets"]}
        assert "from_workflow" in names
        send(proc, {"jsonrpc": "2.0", "id": 9, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_import_source_query_to_manager(tmp_path: Path) -> None:
    csv_path = tmp_path / "people.csv"
    csv_path.write_text("age,name\n10,a\n30,b\n", encoding="utf-8")
    proc = popen()
    try:
        _ready(proc)
        imported = _rpc(proc, 1, "data.import", {"path": str(csv_path)})
        table_name = imported["result"]["name"]
        wf = _rpc(proc, 2, "workflow.create", {"name": "query"})["result"]["workflowId"]
        src_id = _rpc(proc, 3, "workflow.addNode", {"workflowId": wf, "qualifiedName": SOURCE})["result"]["nodeId"]
        query_id = _rpc(proc, 4, "workflow.addNode", {"workflowId": wf, "qualifiedName": QUERY})["result"]["nodeId"]
        dst_id = _rpc(proc, 5, "workflow.addNode", {"workflowId": wf, "qualifiedName": DATAMGR})["result"]["nodeId"]
        _rpc(proc, 6, "workflow.setParam", {"workflowId": wf, "nodeId": src_id, "name": "dataset_name", "value": table_name})
        _rpc(proc, 7, "workflow.setParam", {"workflowId": wf, "nodeId": query_id, "name": "query_string", "value": "age > 20"})
        _rpc(proc, 8, "workflow.setParam", {"workflowId": wf, "nodeId": dst_id, "name": "data_name", "value": "filtered"})
        _rpc(
            proc,
            9,
            "workflow.connect",
            {"workflowId": wf, "fromId": src_id, "fromPort": "data", "toId": query_id, "toPort": "data"},
        )
        _rpc(
            proc,
            10,
            "workflow.connect",
            {"workflowId": wf, "fromId": query_id, "fromPort": "result", "toId": dst_id, "toPort": "data"},
        )
        accepted = _rpc(proc, 11, "workflow.execute", {"workflowId": wf})
        assert accepted["result"]["accepted"] is True
        notes = _drain_until_finished(proc, wf)
        assert notes[-1]["params"]["ok"] is True
        listed = _rpc(proc, 12, "data.list", {})
        by_name = {item["name"]: item for item in listed["result"]["datasets"]}
        assert by_name["filtered"]["rows"] == 1
        send(proc, {"jsonrpc": "2.0", "id": 13, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_workflow_stop_interrupts_delay() -> None:
    proc = popen()
    try:
        _ready(proc)
        wf = _rpc(proc, 1, "workflow.create", {"name": "delay-stop"})["result"]["workflowId"]
        start_id = _rpc(
            proc,
            2,
            "workflow.addNode",
            {"workflowId": wf, "qualifiedName": START},
        )["result"]["nodeId"]
        delay_id = _rpc(
            proc,
            3,
            "workflow.addNode",
            {"workflowId": wf, "qualifiedName": DELAY},
        )["result"]["nodeId"]
        _rpc(
            proc,
            4,
            "workflow.setParam",
            {"workflowId": wf, "nodeId": delay_id, "name": "seconds", "value": 5},
        )
        _rpc(
            proc,
            5,
            "workflow.connect",
            {
                "workflowId": wf,
                "fromId": start_id,
                "fromPort": "trigger",
                "toId": delay_id,
                "toPort": "trigger",
            },
        )
        accepted = _rpc(proc, 6, "workflow.execute", {"workflowId": wf})
        assert accepted["result"]["accepted"] is True
        running = False
        for _ in range(40):
            msg = read_rpc(proc)
            if msg.get("method") != "workflow.nodeState":
                continue
            params = msg["params"]
            if params["workflowId"] == wf and params["nodeId"] == delay_id and params["state"] == "running":
                running = True
                break
        assert running, "Delay never reached running"

        t0 = time.monotonic()
        send(proc, {"jsonrpc": "2.0", "id": 7, "method": "workflow.stop", "params": {"workflowId": wf}})
        stop_ok = False
        finished = None
        for _ in range(40):
            msg = read_rpc(proc)
            if msg.get("id") == 7:
                assert msg["result"]["ok"] is True
                stop_ok = True
            if msg.get("method") == "workflow.finished":
                finished = msg
            if stop_ok and finished is not None:
                break
        assert stop_ok
        assert finished is not None
        assert finished["params"]["workflowId"] == wf
        assert finished["params"].get("cancelled") is True
        assert finished["params"]["ok"] is False
        assert time.monotonic() - t0 < 1.5

        send(proc, {"jsonrpc": "2.0", "id": 8, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()
