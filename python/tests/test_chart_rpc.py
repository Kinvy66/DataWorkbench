from __future__ import annotations

import json
from pathlib import Path

from rpc_client import popen, read_rpc, readline, send


def test_chart_list_types_and_build_series(tmp_path: Path) -> None:
    csv_path = tmp_path / "wave.csv"
    rows = ["t,ch1,label"]
    for i in range(6000):
        rows.append(f"{i},{i * 0.01},n")
    csv_path.write_text("\n".join(rows) + "\n", encoding="utf-8")
    proc = popen()
    try:
        ready = json.loads(readline(proc))
        assert ready["method"] == "host.ready"

        send(proc, {"jsonrpc": "2.0", "id": 1, "method": "chart.listTypes", "params": {}})
        types = read_rpc(proc)
        ids = [item["id"] for item in types["result"]["types"]]
        assert ids == ["line", "scatter", "bar", "hist"]

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
        dataset_id = imported["result"]["id"]

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "chart.buildSeries",
                "params": {"dataId": dataset_id, "x": "t", "y": ["ch1"], "maxPoints": 5000},
            },
        )
        built = read_rpc(proc)
        result = built["result"]
        assert result["downsampled"] is True
        assert result["sourceCount"] == 6000
        assert result["pointCount"] == 5000
        assert len(result["x"]) == 5000
        assert len(result["ys"][0]) == 5000
        assert result["xKind"] == "number"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "chart.buildSeries",
                "params": {
                    "dataId": dataset_id,
                    "x": "t",
                    "y": ["ch1"],
                    "maxPoints": 5000,
                    "xMin": 100,
                    "xMax": 199,
                },
            },
        )
        windowed = read_rpc(proc)
        window_result = windowed["result"]
        assert window_result["sourceCount"] == 100
        assert window_result["downsampled"] is False
        assert window_result["pointCount"] == 100
        assert window_result["x"][0] == 100.0
        assert window_result["x"][-1] == 199.0

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "chart.buildSeries",
                "params": {"dataId": dataset_id, "y": ["ch1"], "kind": "hist", "bins": 50},
            },
        )
        hist = read_rpc(proc)
        hist_result = hist["result"]
        assert hist_result["downsampled"] is False
        assert hist_result["sourceCount"] == 6000
        assert hist_result["pointCount"] == 50
        assert len(hist_result["x"]) == 50
        assert len(hist_result["ys"][0]) == 50
        assert sum(hist_result["ys"][0]) == 6000
        assert hist_result["xKind"] == "number"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 8,
                "method": "chart.buildSeries",
                "params": {
                    "dataId": dataset_id,
                    "y": ["ch1"],
                    "kind": "hist",
                    "histStat": "probability",
                    "histCumulative": True,
                },
            },
        )
        hist_prob = read_rpc(proc)
        prob_result = hist_prob["result"]
        assert abs(prob_result["ys"][0][-1] - 1.0) < 1e-9

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "chart.buildSeries",
                "params": {"dataId": dataset_id, "x": "t", "y": ["label"]},
            },
        )
        bad = read_rpc(proc)
        assert bad["error"]["code"] == 1002
        assert bad["error"]["data"]["i18nKey"] == "chart.nonNumeric"

        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "chart.buildSeries",
                "params": {"dataId": "missing", "x": "t", "y": ["ch1"]},
            },
        )
        missing = read_rpc(proc)
        assert missing["error"]["code"] == 1001
        assert missing["error"]["data"]["i18nKey"] == "data.notFound"
    finally:
        proc.kill()
        proc.wait(timeout=10)
