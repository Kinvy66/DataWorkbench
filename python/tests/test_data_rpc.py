from __future__ import annotations

import json
from pathlib import Path

from dw_host.arrow_block import decode_ipc_rows
from rpc_client import popen, read_rpc, readexact, readline, send


def test_data_import_list_fetch_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "rpc.csv"
    csv_path.write_text("列,值\n甲,1\n乙,2\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"

        send(proc, {"jsonrpc": "2.0", "id": 1, "method": "data.list", "params": {}})
        listed = read_rpc(proc)
        assert listed["result"]["datasets"] == []

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        assert "result" in imported, imported
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 2
        assert imported["result"]["columns"][0]["name"] == "列"

        send(proc, {"jsonrpc": "2.0", "id": 3, "method": "data.getSchema", "params": {"id": dataset_id}})
        schema = read_rpc(proc)
        assert schema["result"]["rowCount"] == 2

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.fetchBlock",
                "params": {"id": dataset_id, "startRow": 0, "rowCount": 512},
            },
        )
        header = json.loads(readline(proc))
        assert header["result"]["encoding"] == "arrow-v1"
        assert header["result"]["bytes"] > 0
        assert header["result"]["meta"]["startRow"] == 0
        payload = readexact(proc, int(header["result"]["bytes"]))
        assert b"\n" in payload or len(payload) > 0
        rows = decode_ipc_rows(payload)
        assert rows[0][0] == "甲"

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "data.remove", "params": {"id": "missing"}})
        missing = read_rpc(proc)
        assert missing["error"]["code"] == 1001
        assert missing["error"]["data"]["i18nKey"] == "data.notFound"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "data.patchCells",
                "params": {"id": dataset_id, "patches": [{"row": 0, "col": 1, "value": "9"}]},
            },
        )
        patched = read_rpc(proc)
        assert patched["result"]["ok"] is True

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "data.rename",
                "params": {"id": dataset_id, "name": "renamed"},
            },
        )
        renamed = read_rpc(proc)
        assert renamed["result"]["ok"] is True

        export_path = tmp_path / "out.csv"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 8,
                "method": "data.export",
                "params": {"id": dataset_id, "path": str(export_path), "format": "csv"},
            },
        )
        exported = read_rpc(proc)
        assert exported["result"]["ok"] is True
        assert "9" in export_path.read_text(encoding="utf-8-sig")

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 9,
                "method": "data.patchCells",
                "params": {"id": dataset_id, "patches": [{"row": 0, "col": 1, "value": "not-a-number"}]},
            },
        )
        invalid = read_rpc(proc)
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidValue"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 10,
                "method": "data.rename",
                "params": {"id": dataset_id, "name": "   "},
            },
        )
        empty_name = read_rpc(proc)
        assert empty_name["error"]["code"] == 1002
        assert empty_name["error"]["data"]["i18nKey"] == "data.invalidValue"

        send(proc, {"jsonrpc": "2.0", "id": 11, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_pickle_import_rejected_via_rpc(tmp_path: Path) -> None:
    path = tmp_path / "x.pkl"
    path.write_bytes(b"not-a-pickle")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(path)},
            },
        )
        imported = read_rpc(proc)
        assert imported["error"]["code"] == 3001
        assert imported["error"]["data"]["i18nKey"] == "data.pickleDisabled"
        send(proc, {"jsonrpc": "2.0", "id": 2, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_data_dropna_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "na.csv"
    csv_path.write_text("a,b\n1,1\n,\n3,\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 3

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.dropNa",
                "params": {"id": dataset_id, "how": "any"},
            },
        )
        dropped = read_rpc(proc)
        assert "result" in dropped, dropped
        assert dropped["result"]["rows"] == 1
        assert dropped["result"]["removedCount"] == 2

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "data.dropNa",
                "params": {"id": dataset_id, "how": "maybe"},
            },
        )
        invalid = read_rpc(proc)
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidValue"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.dropNa",
                "params": {"id": dataset_id, "subset": ["missing"]},
            },
        )
        missing_col = read_rpc(proc)
        assert missing_col["error"]["code"] == 1002
        assert missing_col["error"]["data"]["i18nKey"] == "data.columnNotFound"

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "data.dropNa", "params": {"id": "missing"}})
        missing_ds = read_rpc(proc)
        assert missing_ds["error"]["code"] == 1001

        send(proc, {"jsonrpc": "2.0", "id": 6, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_data_drop_duplicates_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "dup.csv"
    csv_path.write_text("a,b\n1,10\n1,10\n2,20\n2,30\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 4

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.dropDuplicates",
                "params": {"id": dataset_id, "keep": "first"},
            },
        )
        dropped = read_rpc(proc)
        assert "result" in dropped, dropped
        assert dropped["result"]["rows"] == 3
        assert dropped["result"]["removedCount"] == 1

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "data.dropDuplicates",
                "params": {"id": dataset_id, "keep": "maybe"},
            },
        )
        invalid = read_rpc(proc)
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidValue"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.dropDuplicates",
                "params": {"id": dataset_id, "subset": ["missing"]},
            },
        )
        missing_col = read_rpc(proc)
        assert missing_col["error"]["code"] == 1002
        assert missing_col["error"]["data"]["i18nKey"] == "data.columnNotFound"

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "data.dropDuplicates", "params": {"id": "missing"}})
        missing_ds = read_rpc(proc)
        assert missing_ds["error"]["code"] == 1001

        send(proc, {"jsonrpc": "2.0", "id": 6, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_data_query_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "people.csv"
    csv_path.write_text("age,name\n10,a\n30,b\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 2

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.query",
                "params": {"id": dataset_id, "queryString": "age > 20"},
            },
        )
        queried = read_rpc(proc)
        assert "result" in queried, queried
        assert queried["result"]["rows"] == 1
        assert queried["result"]["matchedCount"] == 1
        assert queried["result"]["removedCount"] == 1

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "data.query",
                "params": {"id": dataset_id, "queryString": "   "},
            },
        )
        empty = read_rpc(proc)
        assert empty["error"]["code"] == 1002
        assert empty["error"]["data"]["i18nKey"] == "data.queryEmpty"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.query",
                "params": {"id": dataset_id, "queryString": "not_a_column > 1"},
            },
        )
        invalid = read_rpc(proc)
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidQuery"

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_data_sort_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "people.csv"
    csv_path.write_text("age,name\n30,c\n10,a\n20,b\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 3

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.sort",
                "params": {"id": dataset_id, "columns": ["age"], "ascending": True},
            },
        )
        sorted_ok = read_rpc(proc)
        assert "result" in sorted_ok, sorted_ok
        assert sorted_ok["result"]["rows"] == 3

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "data.fetchBlock",
                "params": {"id": dataset_id, "startRow": 0, "rowCount": 512},
            },
        )
        header = json.loads(readline(proc))
        assert header["result"]["encoding"] == "arrow-v1"
        payload = readexact(proc, int(header["result"]["bytes"]))
        rows = decode_ipc_rows(payload)
        assert [int(row[0]) for row in rows] == [10, 20, 30]

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.sort",
                "params": {"id": dataset_id, "columns": []},
            },
        )
        empty = read_rpc(proc)
        assert empty["error"]["code"] == 1002
        assert empty["error"]["data"]["i18nKey"] == "data.sortColumnsEmpty"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "data.sort",
                "params": {"id": dataset_id, "columns": ["missing"]},
            },
        )
        missing_col = read_rpc(proc)
        assert missing_col["error"]["code"] == 1002
        assert missing_col["error"]["data"]["i18nKey"] == "data.columnNotFound"

        send(proc, {"jsonrpc": "2.0", "id": 6, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_data_fillna_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "na.csv"
    csv_path.write_text("a,b\n1,\n,2\n3,3\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 3

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.fillNa",
                "params": {"id": dataset_id, "method": "value", "value": 0},
            },
        )
        filled = read_rpc(proc)
        assert "result" in filled, filled
        assert filled["result"]["rows"] == 3
        assert filled["result"]["filledCount"] == 2

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "data.fillNa",
                "params": {"id": dataset_id, "method": "maybe"},
            },
        )
        invalid = read_rpc(proc)
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidValue"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.fillNa",
                "params": {"id": dataset_id, "subset": ["missing"]},
            },
        )
        missing_col = read_rpc(proc)
        assert missing_col["error"]["code"] == 1002
        assert missing_col["error"]["data"]["i18nKey"] == "data.columnNotFound"

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()


def test_data_describe_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "nums.csv"
    csv_path.write_text("a,b\n1,10\n2,20\n3,30\n4,40\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = read_rpc(proc)
        dataset_id = imported["result"]["id"]
        source_rows = imported["result"]["rows"]
        assert source_rows == 4

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.describe",
                "params": {"id": dataset_id},
            },
        )
        described = read_rpc(proc)
        assert "result" in described, described
        stats_id = described["result"]["id"]
        assert stats_id != dataset_id
        assert described["result"]["name"].endswith("describe")
        assert described["result"]["columns"][0]["name"] == "stat"
        assert described["result"]["rows"] >= 1

        send(proc, {"jsonrpc": "2.0", "id": 3, "method": "data.getSchema", "params": {"id": dataset_id}})
        source_schema = read_rpc(proc)
        assert source_schema["result"]["rowCount"] == source_rows

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.describe",
                "params": {"id": dataset_id, "percentiles": "2"},
            },
        )
        invalid = read_rpc(proc)
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidValue"

        send(proc, {"jsonrpc": "2.0", "id": 5, "method": "data.describe", "params": {"id": "missing"}})
        missing = read_rpc(proc)
        assert missing["error"]["code"] == 1001

        send(proc, {"jsonrpc": "2.0", "id": 6, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
