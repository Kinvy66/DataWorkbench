from __future__ import annotations

import json

from dw_host.arrow_block import decode_ipc_rows, encode_rows_ipc, maybe_arrow


def test_encode_decode_roundtrip() -> None:
    rows = [["甲", 1], ["乙", 2], [None, 3]]
    payload = encode_rows_ipc(rows)
    assert decode_ipc_rows(payload) == rows


def test_encode_bool_and_float() -> None:
    rows = [[True, 1.5], [False, None]]
    assert decode_ipc_rows(encode_rows_ipc(rows)) == rows


def test_maybe_arrow_empty_stays_json() -> None:
    block = {"startRow": 10, "rows": []}
    assert maybe_arrow(block) is block


def test_maybe_arrow_wraps_rows() -> None:
    from dw_host.arrow_block import ArrowBlock

    block = {"startRow": 512, "rows": [[1, "a"], [2, "b"]]}
    wrapped = maybe_arrow(block)
    assert isinstance(wrapped, ArrowBlock)
    assert wrapped.start_row == 512
    assert wrapped.rows == 2
    assert decode_ipc_rows(wrapped.payload) == block["rows"]


def test_arrow_payload_smaller_than_json_for_wide_cells() -> None:
    rows = [[f"value-{i}-padding-xxxxxxxx", i * 0.123456789] for i in range(2048)]
    payload = encode_rows_ipc(rows)
    json_len = len(json.dumps({"startRow": 0, "rows": rows}, ensure_ascii=False))
    assert len(payload) < json_len
