"""Wiki sample CSV through the same RPCs the Operate / Chart / Workflow UI uses."""

from __future__ import annotations

import json
from pathlib import Path

from rpc_client import popen, read_rpc, readline, send

from dw_nodes_analysis import DataQueryNode, DataSourceNode
from dw_nodes_system import DataToManagerNode

WIKI_DEMO = Path(__file__).resolve().parents[2] / "docs" / "wiki" / "samples" / "wiki-demo.csv"
SOURCE = DataSourceNode.qualified_name
QUERY = DataQueryNode.qualified_name
DATAMGR = DataToManagerNode.qualified_name


def _ready(proc):
    ready = json.loads(readline(proc))
    assert ready["method"] == "host.ready"
    assert ready["params"]["pandasAvailable"] is True
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


def test_wiki_demo_file_exists() -> None:
    assert WIKI_DEMO.is_file(), WIKI_DEMO
    header = WIKI_DEMO.read_text(encoding="utf-8").splitlines()[0]
    assert header == "name,age,city,score"


def test_wiki_demo_import_dropna_query_describe_chart() -> None:
    proc = popen()
    try:
        _ready(proc)
        imported = _rpc(proc, 1, "data.import", {"path": str(WIKI_DEMO)})
        assert "result" in imported, imported
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 11
        names = [col["name"] for col in imported["result"]["columns"]]
        assert names == ["name", "age", "city", "score"]

        dropped = _rpc(proc, 2, "data.dropNa", {"id": dataset_id, "how": "any"})
        assert dropped["result"]["removedCount"] == 2
        assert dropped["result"]["rows"] == 9

        send(proc, {"jsonrpc": "2.0", "id": 3, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()

    proc = popen()
    try:
        _ready(proc)
        imported = _rpc(proc, 1, "data.import", {"path": str(WIKI_DEMO)})
        dataset_id = imported["result"]["id"]
        dupes = _rpc(proc, 2, "data.dropDuplicates", {"id": dataset_id, "keep": "first"})
        assert dupes["result"]["removedCount"] == 1
        assert dupes["result"]["rows"] == 10

        send(proc, {"jsonrpc": "2.0", "id": 3, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()

    proc = popen()
    try:
        _ready(proc)
        imported = _rpc(proc, 1, "data.import", {"path": str(WIKI_DEMO)})
        dataset_id = imported["result"]["id"]
        queried = _rpc(proc, 2, "data.query", {"id": dataset_id, "queryString": "city == 'Beijing'"})
        assert queried["result"]["rows"] == 5

        described = _rpc(proc, 3, "data.describe", {"id": dataset_id})
        assert described["result"]["id"] != dataset_id
        source = _rpc(proc, 4, "data.getSchema", {"id": dataset_id})
        assert source["result"]["rowCount"] == 5

        pivoted = _rpc(
            proc,
            5,
            "data.pivotTable",
            {
                "id": dataset_id,
                "index": ["city"],
                "values": ["score"],
                "aggfunc": "mean",
            },
        )
        assert pivoted["result"]["id"] != dataset_id
        assert pivoted["result"]["rows"] >= 1

        line = _rpc(
            proc,
            6,
            "chart.buildSeries",
            {"dataId": dataset_id, "x": "age", "y": ["score"], "maxPoints": 5000},
        )
        assert "result" in line, line
        assert line["result"]["pointCount"] >= 1
        assert line["result"]["pointCount"] == len(line["result"]["x"])

        bad = _rpc(proc, 7, "chart.buildSeries", {"dataId": dataset_id, "x": "age", "y": ["name"]})
        assert bad["error"]["code"] == 1002
        assert bad["error"]["data"]["i18nKey"] == "chart.nonNumeric"

        send(proc, {"jsonrpc": "2.0", "id": 8, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_wiki_demo_source_query_to_manager() -> None:
    proc = popen()
    try:
        _ready(proc)
        imported = _rpc(proc, 1, "data.import", {"path": str(WIKI_DEMO)})
        table_name = imported["result"]["name"]
        wf = _rpc(proc, 2, "workflow.create", {"name": "wiki-demo"})["result"]["workflowId"]
        src_id = _rpc(proc, 3, "workflow.addNode", {"workflowId": wf, "qualifiedName": SOURCE})["result"]["nodeId"]
        query_id = _rpc(proc, 4, "workflow.addNode", {"workflowId": wf, "qualifiedName": QUERY})["result"]["nodeId"]
        dst_id = _rpc(proc, 5, "workflow.addNode", {"workflowId": wf, "qualifiedName": DATAMGR})["result"]["nodeId"]
        _rpc(proc, 6, "workflow.setParam", {"workflowId": wf, "nodeId": src_id, "name": "dataset_name", "value": table_name})
        _rpc(proc, 7, "workflow.setParam", {"workflowId": wf, "nodeId": query_id, "name": "query_string", "value": "age > 25"})
        _rpc(proc, 8, "workflow.setParam", {"workflowId": wf, "nodeId": dst_id, "name": "data_name", "value": "adults"})
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
        assert by_name["adults"]["rows"] == 8
        send(proc, {"jsonrpc": "2.0", "id": 13, "method": "host.shutdown", "params": {}})
        assert proc.wait(timeout=5) == 0
    finally:
        if proc.poll() is None:
            proc.kill()
