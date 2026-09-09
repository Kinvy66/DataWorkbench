from __future__ import annotations

import json
from pathlib import Path

from test_host_rpc import _popen, _readline, _send


def test_data_import_list_fetch_via_rpc(tmp_path: Path) -> None:
    csv_path = tmp_path / "rpc.csv"
    csv_path.write_text("列,值\n甲,1\n乙,2\n", encoding="utf-8")
    proc = _popen()
    try:
        ready = json.loads(_readline(proc))
        assert ready["method"] == "host.ready"

        _send(proc, {"jsonrpc": "2.0", "id": 1, "method": "data.list", "params": {}})
        listed = json.loads(_readline(proc))
        assert listed["result"]["datasets"] == []

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "data.import",
                "params": {"path": str(csv_path)},
            },
        )
        imported = json.loads(_readline(proc))
        assert "result" in imported, imported
        dataset_id = imported["result"]["id"]
        assert imported["result"]["rows"] == 2
        assert imported["result"]["columns"][0]["name"] == "列"

        _send(proc, {"jsonrpc": "2.0", "id": 3, "method": "data.getSchema", "params": {"id": dataset_id}})
        schema = json.loads(_readline(proc))
        assert schema["result"]["rowCount"] == 2

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "data.fetchBlock",
                "params": {"id": dataset_id, "startRow": 0, "rowCount": 512},
            },
        )
        block = json.loads(_readline(proc))
        assert block["result"]["rows"][0][0] == "甲"

        _send(proc, {"jsonrpc": "2.0", "id": 5, "method": "data.remove", "params": {"id": "missing"}})
        missing = json.loads(_readline(proc))
        assert missing["error"]["code"] == 1001
        assert missing["error"]["data"]["i18nKey"] == "data.notFound"

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "data.patchCells",
                "params": {"id": dataset_id, "patches": [{"row": 0, "col": 1, "value": "9"}]},
            },
        )
        patched = json.loads(_readline(proc))
        assert patched["result"]["ok"] is True

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "data.rename",
                "params": {"id": dataset_id, "name": "renamed"},
            },
        )
        renamed = json.loads(_readline(proc))
        assert renamed["result"]["ok"] is True

        export_path = tmp_path / "out.csv"
        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 8,
                "method": "data.export",
                "params": {"id": dataset_id, "path": str(export_path), "format": "csv"},
            },
        )
        exported = json.loads(_readline(proc))
        assert exported["result"]["ok"] is True
        assert "9" in export_path.read_text(encoding="utf-8-sig")

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 9,
                "method": "data.patchCells",
                "params": {"id": dataset_id, "patches": [{"row": 0, "col": 1, "value": "not-a-number"}]},
            },
        )
        invalid = json.loads(_readline(proc))
        assert invalid["error"]["code"] == 1002
        assert invalid["error"]["data"]["i18nKey"] == "data.invalidValue"

        _send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 10,
                "method": "data.rename",
                "params": {"id": dataset_id, "name": "   "},
            },
        )
        empty_name = json.loads(_readline(proc))
        assert empty_name["error"]["code"] == 1002
        assert empty_name["error"]["data"]["i18nKey"] == "data.invalidValue"

        _send(proc, {"jsonrpc": "2.0", "id": 11, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
