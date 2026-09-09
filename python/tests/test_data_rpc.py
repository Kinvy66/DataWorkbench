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

        _send(proc, {"jsonrpc": "2.0", "id": 6, "method": "host.shutdown", "params": {}})
        proc.wait(timeout=5)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
