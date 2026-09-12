from __future__ import annotations

import pandas as pd

from dw_host.data_manager import DataManager
from dw_host.qa_lab import enabled


def _people() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "name": ["Alice", "Bob", "Alice"],
            "age": [28.0, None, 28.0],
            "city": ["Beijing", "Shanghai", "Beijing"],
            "score": [88.0, 72.0, 88.0],
        }
    )


def test_qa_lab_is_off_by_default() -> None:
    assert enabled() is False


def test_qa_lab_dropna_does_not_remove_rows(monkeypatch) -> None:
    monkeypatch.setenv("DW_QA_LAB", "1")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _people())
    result = manager.dropna(dataset_id)
    assert result["removedCount"] == 2
    assert result["rows"] == 3
    assert int(manager.get(dataset_id).df["age"].isna().sum()) == 1


def test_qa_lab_query_does_not_filter(monkeypatch) -> None:
    monkeypatch.setenv("DW_QA_LAB", "1")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _people())
    result = manager.query(dataset_id, "city == 'Beijing'")
    assert result["matchedCount"] == 5
    assert result["rows"] == 3
    cities = set(manager.get(dataset_id).df["city"].tolist())
    assert "Shanghai" in cities


def test_qa_lab_sort_descending_is_ascending(monkeypatch) -> None:
    monkeypatch.setenv("DW_QA_LAB", "1")
    manager = DataManager()
    df = pd.DataFrame({"score": [10, 30, 20]})
    dataset_id = manager.publish_dataframe("s", df)
    manager.sort(dataset_id, columns=["score"], ascending=False)
    assert manager.get(dataset_id).df["score"].tolist() == [10, 20, 30]


def test_qa_lab_describe_does_not_add_dataset(monkeypatch) -> None:
    monkeypatch.setenv("DW_QA_LAB", "1")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", _people())
    result = manager.describe(dataset_id)
    assert result["id"] == dataset_id
    assert len(manager.list_datasets()) == 1


def test_qa_lab_csv_export_omits_header(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("DW_QA_LAB", "1")
    manager = DataManager()
    dataset_id = manager.publish_dataframe("people", pd.DataFrame({"a": [1], "b": [2]}))
    dest = tmp_path / "out.csv"
    manager.export_path(dataset_id, str(dest), "csv")
    text = dest.read_text(encoding="utf-8-sig")
    assert not text.lower().startswith("a")
    assert "1" in text
