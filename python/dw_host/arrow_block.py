"""Arrow IPC helpers for data.fetchBlock binary frames."""

from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass
from typing import Any

log = logging.getLogger("dw_host")

ARROW_ENCODING = "arrow-v1"


@dataclass
class ArrowBlock:
    start_row: int
    payload: bytes
    rows: int


def maybe_arrow(block: dict[str, Any]) -> dict[str, Any] | ArrowBlock:
    """Wrap a JSON fetchBlock result in an Arrow frame; fall back to JSON."""
    rows = block.get("rows") or []
    if not rows:
        return block
    try:
        payload = encode_rows_ipc(rows)
    except Exception:
        log.info("data.fetchBlock Arrow encode failed; using JSON")
        return block
    return ArrowBlock(start_row=int(block["startRow"]), payload=payload, rows=len(rows))


def encode_rows_ipc(rows: list[list[Any]]) -> bytes:
    import pyarrow as pa
    import pyarrow.ipc as ipc

    if not rows:
        raise ValueError("cannot encode empty rows")
    width = len(rows[0])
    columns = list(zip(*rows))
    if len(columns) != width:
        raise ValueError("ragged rows")
    arrays = [_column_array(col) for col in columns]
    names = [str(i) for i in range(width)]
    table = pa.Table.from_arrays(arrays, names=names)
    sink = io.BytesIO()
    with ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sink.getvalue()


def decode_ipc_rows(payload: bytes) -> list[list[Any]]:
    import pyarrow as pa
    import pyarrow.ipc as ipc

    reader = ipc.open_stream(io.BytesIO(payload))
    table = reader.read_all()
    rows: list[list[Any]] = []
    for i in range(table.num_rows):
        row: list[Any] = []
        for j in range(table.num_columns):
            row.append(_arrow_py(table.column(j)[i].as_py()))
        rows.append(row)
    return rows


def _arrow_py(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def _column_array(values: tuple[Any, ...]) -> Any:
    import pyarrow as pa

    if all(v is None for v in values):
        return pa.array(values, type=pa.null())
    if all(v is None or isinstance(v, bool) for v in values):
        return pa.array(values, type=pa.bool_())
    if all(v is None or (isinstance(v, int) and not isinstance(v, bool)) for v in values):
        return pa.array(values, type=pa.int64())
    if all(
        v is None or isinstance(v, float) or (isinstance(v, int) and not isinstance(v, bool)) for v in values
    ):
        cleaned = []
        for v in values:
            if v is None:
                cleaned.append(None)
            elif isinstance(v, float) and math.isnan(v):
                cleaned.append(None)
            else:
                cleaned.append(float(v))
        return pa.array(cleaned, type=pa.float64())
    return pa.array([None if v is None else str(v) for v in values], type=pa.string())
