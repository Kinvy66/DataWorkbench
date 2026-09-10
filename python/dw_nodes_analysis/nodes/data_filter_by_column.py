# dw:adapted — via filter_by_column_range; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataFilterByColumn — keep rows whose column value is inside an inclusive range."""

import logging
import os

import pandas as pd

from dw_nodes_analysis.core.operations import filter_by_column_range
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


def parse_optional_float(raw: object) -> float | None:
    """Empty / None means unbounded. 0 is a real bound, not a sentinel."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if not text:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


@NodeDef(
    name="Filter By Column",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "filterByColumn.svg"),
    description=_(
        "Keeps rows whose numeric column is inside an inclusive range. "
        "Empty min or max means that bound is open. 0 is a real bound, not 'no limit'. "
        "Ribbon Filter by Column calls the same Core function."
    ),  # cn:保留数值列落在闭区间内的行。最小/最大留空表示该侧不限制。0 是真实边界，不是「不限制」。功能区「按列筛选」调用同一 Core 函数。
)
class DataFilterByColumnNode:
    """Keep rows in an inclusive column range via filter_by_column_range."""

    column = Parameter(
        str,
        default="",
        description=_("Numeric column to filter"),  # cn:要筛选的数值列
    )
    min_value = Parameter(
        str,
        default="",
        description=_("Minimum (inclusive); empty means no lower bound"),  # cn:最小值（包含）；空表示不限制下限
    )
    max_value = Parameter(
        str,
        default="",
        description=_("Maximum (inclusive); empty means no upper bound"),  # cn:最大值（包含）；空表示不限制上限
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        filtered = Output("DataFrame", description=_("Filtered data"))  # cn:筛选后的数据
        removed_count = Output("int", description=_("Number of removed rows"))  # cn:删除的行数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        column = str(params.get("column", "") or "").strip()
        if not column:
            log.error("Filter By Column missing column")
            return False
        mapping = {str(col): col for col in df.columns}
        if column not in mapping:
            log.error("Filter By Column unknown column=%s", column)
            return False
        col = mapping[column]
        if not pd.api.types.is_numeric_dtype(df[col]):
            log.error("Filter By Column non-numeric column=%s", column)
            return False
        min_val = parse_optional_float(params.get("min_value", ""))
        max_val = parse_optional_float(params.get("max_value", ""))
        if _is_bad_optional_number(params.get("min_value", ""), min_val):
            log.error("Filter By Column invalid min_value=%s", params.get("min_value"))
            return False
        if _is_bad_optional_number(params.get("max_value", ""), max_val):
            log.error("Filter By Column invalid max_value=%s", params.get("max_value"))
            return False
        original_len = int(len(df))
        try:
            filtered = filter_by_column_range(df, col, min_val, max_val)
        except Exception:
            log.exception("Filter By Column failed")
            return False
        self._output_data["filtered"] = filtered
        self._output_data["removed_count"] = original_len - int(len(filtered))
        return True


def _is_bad_optional_number(raw: object, parsed: float | None) -> bool:
    if parsed is not None:
        return False
    if raw is None:
        return False
    if isinstance(raw, bool):
        return True
    if isinstance(raw, (int, float)):
        return False
    return bool(str(raw).strip())
