from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError
from dw_host.rpc_project import clear_logic, pack_logic, unpack_logic
from dw_host.workflow_runtime import WorkflowRuntime
from dw_nodes_system import ConstantNode, EndNode
from rpc_client import popen, read_rpc, readline, send


def test_pack_unpack_keeps_ids_cells_and_connections(tmp_path: Path) -> None:
    manager = DataManager()
    runtime = WorkflowRuntime(notify=lambda _m, _p: None)
    ds_id = manager.publish_dataframe("people", pd.DataFrame({"name": ["Ada", "Bob"], "age": [36, 41]}))
    workflow_id = runtime.create("demo")["workflowId"]
    src = runtime.add_node(workflow_id, ConstantNode.qualified_name)
    dst = runtime.add_node(workflow_id, EndNode.qualified_name)
    runtime.set_param(workflow_id, src["nodeId"], "value", "1")
    runtime.connect(workflow_id, src["nodeId"], "value", dst["nodeId"], "done")
    dumped = runtime.dump_logic(workflow_id)

    pack_dir = tmp_path / "pack"
    pack_dir.mkdir()
    (pack_dir / "workflow-logic.json").write_text(json.dumps(dumped["payload"]), encoding="utf-8")
    packed = pack_logic(str(pack_dir), manager)
    assert packed["count"] == 1
    assert (pack_dir / "datas" / f"{ds_id}.parquet").is_file()

    manager2 = DataManager()
    manager2.publish_dataframe("other", pd.DataFrame({"x": [9]}))
    runtime2 = WorkflowRuntime(notify=lambda _m, _p: None)
    runtime2.create("scratch")
    restored = unpack_logic(str(pack_dir), manager2, runtime2)
    listed = manager2.list_datasets()
    assert listed[0]["id"] == ds_id
    assert listed[0]["name"] == "people"
    block = manager2.fetch_block(ds_id, 0, 10)
    assert block["rows"][0] == ["Ada", 36]
    assert block["rows"][1] == ["Bob", 41]
    graph = runtime2.get_graph(restored["workflowId"])
    assert len(graph["nodes"]) == 2
    assert len(graph["connections"]) == 1
    conn = graph["connections"][0]
    assert (conn["fromId"], conn["fromPort"], conn["toId"], conn["toPort"]) == (
        src["nodeId"],
        "value",
        dst["nodeId"],
        "done",
    )


def test_unpack_failure_does_not_clear_current_data(tmp_path: Path) -> None:
    manager = DataManager()
    runtime = WorkflowRuntime(notify=lambda _m, _p: None)
    keep_id = manager.publish_dataframe("keep", pd.DataFrame({"v": [7, 8]}))
    runtime.create("live")
    missing = tmp_path / "missing"
    missing.mkdir()
    (missing / "data-manager.json").write_text(
        json.dumps([{"id": "gone-id", "name": "gone", "store": "inline-parquet"}]),
        encoding="utf-8",
    )
    (missing / "workflow-logic.json").write_text(
        json.dumps({"name": "x", "nodes": [], "connections": []}), encoding="utf-8"
    )
    with pytest.raises(HostError) as exc:
        unpack_logic(str(missing), manager, runtime)
    assert exc.value.i18n_key == "project.invalid"
    assert manager.get(keep_id).df["v"].tolist() == [7, 8]
    assert manager.list_datasets()[0]["name"] == "keep"


def test_unpack_bad_dir_does_not_wipe(tmp_path: Path) -> None:
    manager = DataManager()
    runtime = WorkflowRuntime(notify=lambda _m, _p: None)
    keep_id = manager.publish_dataframe("keep", pd.DataFrame({"v": [1]}))
    runtime.create("live")
    try:
        unpack_logic(str(tmp_path / "no-such-dir"), manager, runtime)
        raise AssertionError("expected HostError")
    except HostError as exc:
        assert exc.code == ErrorCode.FileIo
        assert exc.i18n_key == "project.dirMissing"
    assert manager.get(keep_id).df["v"].tolist() == [1]


def test_clear_logic_empties_data_and_sessions() -> None:
    manager = DataManager()
    runtime = WorkflowRuntime(notify=lambda _m, _p: None)
    manager.publish_dataframe("gone", pd.DataFrame({"v": [1]}))
    runtime.create("live")
    clear_logic(manager, runtime)
    assert manager.list_datasets() == []
    try:
        runtime.dump_logic("nope")
        raise AssertionError("expected missing workflow")
    except HostError as exc:
        assert exc.i18n_key == "workflow.notFound"


def test_project_pack_unpack_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "people.csv"
    csv_path.write_text("name,age\nAda,36\nBob,41\n", encoding="utf-8")
    pack_dir = tmp_path / "rpc-pack"
    pack_dir.mkdir()
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"

        send(proc, {"jsonrpc": "2.0", "id": 1, "method": "data.import", "params": {"path": str(csv_path)}})
        imported = read_rpc(proc)["result"]
        ds_id = imported["id"]

        send(proc, {"jsonrpc": "2.0", "id": 2, "method": "workflow.create", "params": {"name": "rpc"}})
        workflow_id = read_rpc(proc)["result"]["workflowId"]
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "workflow.addNode",
                "params": {"workflowId": workflow_id, "qualifiedName": ConstantNode.qualified_name},
            },
        )
        node = read_rpc(proc)["result"]
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "workflow.dumpLogic",
                "params": {"workflowId": workflow_id, "format": "json"},
            },
        )
        payload = read_rpc(proc)["result"]["payload"]
        (pack_dir / "workflow-logic.json").write_text(json.dumps(payload), encoding="utf-8")

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "project.packLogic", "params": {"dir": str(pack_dir)}})
        packed = read_rpc(proc)["result"]
        assert packed["ok"] is True
        assert packed["count"] == 1

        send(proc, {"jsonrpc": "2.0", "id": 6, "method": "project.clearLogic", "params": {}})
        assert read_rpc(proc)["result"]["ok"] is True

        send(proc, {"jsonrpc": "2.0", "id": 7, "method": "data.list", "params": {}})
        assert read_rpc(proc)["result"]["datasets"] == []

        send(proc, {"jsonrpc": "2.0", "id": 8, "method": "project.unpackLogic", "params": {"dir": str(pack_dir)}})
        unpacked = read_rpc(proc)["result"]
        assert unpacked["datasets"][0]["id"] == ds_id
        restored_wf = unpacked["workflowId"]

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 9,
                "method": "data.fetchBlock",
                "params": {"id": ds_id, "startRow": 0, "rowCount": 10},
            },
        )
        rows = read_rpc(proc)["result"]["rows"]
        assert rows[0][0] == "Ada"
        assert rows[1][1] == 41

        send(proc, {"jsonrpc": "2.0", "id": 10, "method": "workflow.getGraph", "params": {"workflowId": restored_wf}})
        graph = read_rpc(proc)["result"]
        assert len(graph["nodes"]) == 1
        assert graph["nodes"][0]["nodeId"] == node["nodeId"]

        send(proc, {"jsonrpc": "2.0", "id": 11, "method": "host.shutdown", "params": {}})
        read_rpc(proc)
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()
