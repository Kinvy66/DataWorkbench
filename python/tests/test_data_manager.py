from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

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
