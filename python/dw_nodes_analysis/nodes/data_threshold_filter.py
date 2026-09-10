# dw:adapted — via threshold_filter_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataThresholdFilter — drop rows that match a numeric threshold."""

import logging
import os

import pandas as pd

from dw_nodes_analysis.core.cleaning import threshold_filter_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

FILTER_TYPES = ("greater_than", "less_than", "in_range", "out_of_range")
FILTER_ALIASES = {
    "gt": "greater_than",
    ">": "greater_than",
    "greater": "greater_than",
    "lt": "less_than",
    "<": "less_than",
    "less": "less_than",
    "between": "in_range",
    "inside": "in_range",
    "outside": "out_of_range",
}
ROW_LOGIC = ("any", "all")


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all numeric columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def normalize_filter_type(raw: object) -> str | None:
    key = str(raw or "greater_than").strip().lower()
    key = FILTER_ALIASES.get(key, key)
    if key not in FILTER_TYPES:
        return None
    return key


def normalize_row_logic(raw: object) -> str | None:
    key = str(raw or "any").strip().lower()
    if key not in ROW_LOGIC:
        return None
    return key


def parse_float(raw: object, default: float) -> float | None:
    if raw is None or raw == "":
        return default
    if isinstance(raw, bool):
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def parse_bool(raw: object, default: bool = False) -> bool | None:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    key = str(raw).strip().lower()
    if key in ("1", "true", "yes", "on"):
        return True
    if key in ("0", "false", "no", "off"):
        return False
    return None


def numeric_columns(df) -> list:
    return [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]


@NodeDef(
    name="Threshold Filter",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "thresholdFilter.svg"),
    description=_(
        "Drops rows that match a numeric threshold. greater_than drops values above upper; "
        "less_than drops values below lower; in_range / out_of_range use both bounds. "
        "Empty column list means all numeric columns. Ribbon Threshold Filter calls the same Core function."
    ),  # cn:按数值阈值删除行。greater_than 删除大于上限的值；less_than 删除小于下限的值；in_range / out_of_range 使用上下限。列名为空表示全部数值列。功能区「阈值筛选」调用同一 Core 函数。
)
class DataThresholdFilterNode:
    """Drop rows matching a numeric threshold via threshold_filter_impl."""

    filter_type = Parameter(
        str,
        default="greater_than",
        enum=["greater_than", "less_than", "in_range", "out_of_range"],
        description=_("greater_than: drop > upper; less_than: drop < lower; in_range / out_of_range: both bounds"),  # cn:greater_than: 删除大于上限; less_than: 删除小于下限; in_range / out_of_range: 使用上下限
    )
    lower = Parameter(
        float,
        default=0.0,
        description=_("Lower bound (less_than / in_range / out_of_range)"),  # cn:下限（less_than / in_range / out_of_range）
    )
    upper = Parameter(
        float,
        default=100.0,
        description=_("Upper bound (greater_than / in_range / out_of_range)"),  # cn:上限（greater_than / in_range / out_of_range）
    )
    subset = Parameter(
        str,
        default="",
        description=_("Numeric column names, comma-separated; empty means all numeric columns"),  # cn:数值列名，逗号分隔，空表示全部数值列
    )
    row_logic = Parameter(
        str,
        default="any",
        enum=["any", "all"],
        description=_("any: drop if any selected column matches; all: drop only if every selected column matches"),  # cn:any: 任一选中列命中即删; all: 全部选中列命中才删
    )
    treat_nan = Parameter(
        bool,
        default=False,
        description=_("Treat missing values as a threshold match"),  # cn:将缺失值视为命中阈值
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
        filter_type = normalize_filter_type(params.get("filter_type", "greater_than"))
        if filter_type is None:
            log.error("Threshold Filter invalid filter_type=%s", params.get("filter_type"))
            return False
        row_logic = normalize_row_logic(params.get("row_logic", "any"))
        if row_logic is None:
            log.error("Threshold Filter invalid row_logic=%s", params.get("row_logic"))
            return False
        lower = parse_float(params.get("lower", 0.0), 0.0)
        upper = parse_float(params.get("upper", 100.0), 100.0)
        if lower is None or upper is None:
            log.error("Threshold Filter invalid lower/upper")
            return False
        treat_nan = parse_bool(params.get("treat_nan", False), default=False)
        if treat_nan is None:
            log.error("Threshold Filter invalid treat_nan=%s", params.get("treat_nan"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Threshold Filter unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
            if any(not pd.api.types.is_numeric_dtype(df[col]) for col in subset):
                log.error("Threshold Filter non-numeric columns: %s", subset)
                return False
        else:
            subset = numeric_columns(df)
            if not subset:
                log.error("Threshold Filter no numeric columns")
                return False
        original_len = int(len(df))
        try:
            filtered = threshold_filter_impl(
                df,
                subset=subset,
                filter_type=filter_type,
                lower=lower,
                upper=upper,
                row_logic=row_logic,
                treat_nan=treat_nan,
                reindex=True,
            )
        except Exception:
            log.exception("Threshold Filter failed")
            return False
        self._output_data["filtered"] = filtered
        self._output_data["removed_count"] = original_len - int(len(filtered))
        return True
