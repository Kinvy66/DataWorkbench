from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from dw_host.arrow_block import ArrowBlock, maybe_arrow
from dw_host.data_manager import DataManager, json_cell
from dw_host.errors import ErrorCode, HostError


def test_fetch_block_range() -> None:
    manager = DataManager()
    df = pd.DataFrame({"a": list(range(1000))})
    dataset_id = manager.publish_dataframe("t", df)
    block = manager.fetch_block(dataset_id, 512, 512)
    assert block["startRow"] == 512
    assert len(block["rows"]) == 488
    assert block["rows"][0][0] == 512
    assert block["rows"][-1][0] == 999


def test_patch_rollback() -> None:
    manager = DataManager()
    df = pd.DataFrame({"a": [1.0, 2.0]})
    dataset_id = manager.publish_dataframe("n", df)
    with pytest.raises(HostError) as exc:
        manager.patch_cells(dataset_id, [{"row": 0, "col": 0, "value": "x"}])
    assert exc.value.code == ErrorCode.ColumnOrValidation
    assert exc.value.i18n_key == "data.invalidValue"
    assert manager.get(dataset_id).df.iloc[0, 0] == 1.0


def test_import_csv_utf8(tmp_path: Path) -> None:
    path = tmp_path / "表.csv"
    path.write_text("列,值\n甲,1\n", encoding="utf-8")
    manager = DataManager()
    info = manager.import_path(str(path))
    names = [c["name"] for c in info["columns"]]
    assert "列" in names
    assert "值" in names
    assert info["rows"] == 1
    block = manager.fetch_block(info["id"], 0, 512)
    assert block["rows"][0][0] == "甲"


def test_import_txt_semicolon(tmp_path: Path) -> None:
    path = tmp_path / "notes.txt"
    path.write_text("a;b\n1;2\n3;4\n", encoding="utf-8")
    manager = DataManager()
    info = manager.import_path(str(path))
    assert info["rows"] == 2
    assert [c["name"] for c in info["columns"]] == ["a", "b"]
    block = manager.fetch_block(info["id"], 0, 512)
    assert block["rows"][0] == [1, 2]


def test_import_csv_gb18030(tmp_path: Path) -> None:
    path = tmp_path / "gb.csv"
    body = "列,值\n" + "\n".join(f"甲{i},{i}" for i in range(20)) + "\n"
    path.write_bytes(body.encode("gb18030"))
    manager = DataManager()
    info = manager.import_path(str(path))
    assert info["rows"] == 20
    assert [c["name"] for c in info["columns"]] == ["列", "值"]
    block = manager.fetch_block(info["id"], 0, 512)
    assert block["rows"][0][0] == "甲0"
    assert block["rows"][-1][0] == "甲19"


def test_duplicate_import_name(tmp_path: Path) -> None:
    path = tmp_path / "dup.csv"
    path.write_text("a\n1\n", encoding="utf-8")
    manager = DataManager()
    first = manager.import_path(str(path))
    second = manager.import_path(str(path))
    assert first["name"] == "dup"
    assert second["name"] == "dup (2)"


def test_pickle_rejected(tmp_path: Path) -> None:
    path = tmp_path / "x.pkl"
    path.write_bytes(b"not-a-pickle")
    manager = DataManager()
    with pytest.raises(HostError) as exc:
        manager.import_path(str(path))
    assert exc.value.code == ErrorCode.FileIo
    assert exc.value.i18n_key == "data.pickleDisabled"


def test_publish_overwrites_same_name() -> None:
    manager = DataManager()
    first_id = manager.publish_dataframe("x", pd.DataFrame({"a": [1]}))
    second_id = manager.publish_dataframe("x", pd.DataFrame({"a": [9, 8]}))
    assert first_id == second_id
    assert len(manager.get(first_id).df) == 2


def test_json_cell_nan_and_timestamp() -> None:
    assert json_cell(float("nan")) is None
    ts = pd.Timestamp("2020-01-02T03:04:05")
    assert json_cell(ts) == ts.isoformat()


def test_export_csv_sees_patch(tmp_path: Path) -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("e", pd.DataFrame({"a": [1.0, 2.0]}))
    manager.patch_cells(dataset_id, [{"row": 0, "col": 0, "value": "3.5"}])
    out = tmp_path / "out.csv"
    manager.export_path(dataset_id, str(out), "csv")
    text = out.read_text(encoding="utf-8-sig")
    assert "3.5" in text


def test_fetch_block_500k_window_not_full_table() -> None:
    manager = DataManager()
    n = 500_000
    df = pd.DataFrame({"id": np.arange(n), "value": np.arange(n) * 0.1})
    dataset_id = manager.publish_dataframe("big", df)
    first = manager.fetch_block(dataset_id, 0, 512)
    assert first["startRow"] == 0
    assert len(first["rows"]) == 512
    assert first["rows"][0][0] == 0
    assert first["rows"][-1][0] == 511
    last_start = (n - 1) // 512 * 512
    last = manager.fetch_block(dataset_id, last_start, 512)
    assert last["startRow"] == last_start
    assert len(last["rows"]) == n - last_start
    assert last["rows"][-1][0] == n - 1


def test_import_500k_csv_arrow_payload_not_file(tmp_path: Path) -> None:
    n = 500_000
    src = tmp_path / "big_500k.csv"
    pd.DataFrame({"id": np.arange(n), "value": np.arange(n) * 0.1}).to_csv(src, index=False)
    file_size = src.stat().st_size
    assert file_size > 1_000_000

    manager = DataManager()
    info = manager.import_path(str(src))
    assert info["rows"] == n
    first = manager.fetch_block(info["id"], 0, 512)
    assert first["startRow"] == 0
    assert len(first["rows"]) == 512
    assert first["rows"][0][0] == 0
    assert first["rows"][-1][0] == 511

    wrapped = maybe_arrow(first)
    assert isinstance(wrapped, ArrowBlock)
    assert wrapped.rows == 512
    assert len(wrapped.payload) * 20 < file_size

    last_start = (n - 1) // 512 * 512
    last = manager.fetch_block(info["id"], last_start, 512)
    assert last["rows"][-1][0] == n - 1
    last_wrapped = maybe_arrow(last)
    assert isinstance(last_wrapped, ArrowBlock)
    assert len(last_wrapped.payload) * 20 < file_size


def test_fetch_block_caps_row_count() -> None:
    manager = DataManager()
    dataset_id = manager.publish_dataframe("c", pd.DataFrame({"a": list(range(3000))}))
    block = manager.fetch_block(dataset_id, 0, 10_000)
    assert len(block["rows"]) == 2048


def test_xlsx_roundtrip(tmp_path: Path) -> None:
    src = tmp_path / "sheet.xlsx"
    pd.DataFrame({"x": [1, 2], "y": ["甲", "乙"]}).to_excel(src, index=False)
    manager = DataManager()
    info = manager.import_path(str(src))
    assert info["rows"] == 2
    assert [c["name"] for c in info["columns"]] == ["x", "y"]
    out = tmp_path / "out.xlsx"
    manager.export_path(info["id"], str(out), "xlsx")
    loaded = pd.read_excel(out)
    assert list(loaded["y"]) == ["甲", "乙"]


def test_parquet_roundtrip(tmp_path: Path) -> None:
    src = tmp_path / "t.parquet"
    pd.DataFrame({"x": [10, 20]}).to_parquet(src, index=False)
    manager = DataManager()
    info = manager.import_path(str(src))
    assert info["rows"] == 2
    out = tmp_path / "out.parquet"
    manager.export_path(info["id"], str(out), "parquet")
    loaded = pd.read_parquet(out)
    assert list(loaded["x"]) == [10, 20]


def test_rename_unique() -> None:
    manager = DataManager()
    a = manager.publish_dataframe("alpha", pd.DataFrame({"a": [1]}))
    manager.publish_dataframe("beta", pd.DataFrame({"a": [2]}))
    manager.rename(a, "beta")
    assert manager.get(a).name == "beta (2)"
