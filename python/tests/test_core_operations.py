from __future__ import annotations

import pandas as pd

from dw_nodes_analysis.core.operations import query_dataframe


def test_query_dataframe_filters_rows() -> None:
    df = pd.DataFrame({"age": [10, 30], "name": ["a", "b"]})
    out = query_dataframe(df, "age > 20")
    assert list(out["name"]) == ["b"]
    assert list(df["age"]) == [10, 30]
