# dw:adapted — via fillna_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataFillNa — fill missing values in a DataFrame."""

import logging
import os

from dw_nodes_analysis.core.cleaning import fillna_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

FILLNA_METHODS = ("value", "forward", "backward", "mean", "median", "mode")
FILLNA_ALIASES = {
    "constant": "value",
    "ffill": "forward",
    "bfill": "backward",
}


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def normalize_method(raw: object) -> str | None:
    key = str(raw or "value").strip().lower()
    key = FILLNA_ALIASES.get(key, key)
    if key not in FILLNA_METHODS:
        return None
    return key


def parse_fill_value(raw: object) -> object:
    """Match upstream: try float, otherwise keep the string."""
    if raw is None:
        return 0.0
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw
    text = str(raw)
    try:
        return float(text)
    except (TypeError, ValueError):
        return text


def na_cell_count(df) -> int:
    return int(df.isna().to_numpy().sum())


@NodeDef(
    name="Fill NA",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "fillNa.svg"),
    description=_(
        "Fills missing values (NaN) using a constant, forward/backward fill, mean, median, or mode. "
        "Optional comma-separated column subset; empty means all columns. Ribbon Fill NA calls the same Core function."
    ),  # cn:用固定值、前向/后向填充、均值、中位数或众数填充缺失值（NaN）。可选逗号分隔列子集，空表示全部列。功能区「填充缺失」调用同一 Core 函数。
)
class DataFillNaNode:
    """Fill missing values via fillna_impl."""

    method = Parameter(
        str,
        default="value",
        enum=["value", "forward", "backward", "mean", "median", "mode"],
        description=_("value: constant; forward/backward: ffill/bfill; mean/median/mode: statistic"),  # cn:value: 固定值; forward/backward: 前向/后向填充; mean/median/mode: 统计值
    )
    value = Parameter(
        str,
        default="0",
        description=_("Fill value when method=value"),  # cn:当 method=value 时的填充值
    )
    subset = Parameter(
        str,
        default="",
        description=_("Column names to fill, comma-separated; empty means all columns"),  # cn:要填充的列名，逗号分隔，空表示全部列
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        filled = Output("DataFrame", description=_("Filled data"))  # cn:填充后的数据
        filled_count = Output("int", description=_("Number of filled cells"))  # cn:填充的单元格数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        method = normalize_method(params.get("method", "value"))
        if method is None:
            log.error("Fill NA invalid method=%s", params.get("method"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Fill NA unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        fill_value = parse_fill_value(params.get("value", "0"))
        before = na_cell_count(df)
        try:
            filled = fillna_impl(df, subset=subset, method=method, value=fill_value, limit=None)
        except Exception:
            log.exception("Fill NA failed")
            return False
        self._output_data["filled"] = filled
        self._output_data["filled_count"] = before - na_cell_count(filled)
        return True
