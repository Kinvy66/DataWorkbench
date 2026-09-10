# dw:adapted — via remove_outliers_iqr_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataRemoveOutliersIQR — IQR outlier handling."""

import logging
import math
import os

from dw_nodes_analysis.core.cleaning import remove_outliers_iqr_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

IQR_ACTIONS = (
    "remove",
    "replace_mean",
    "replace_median",
    "replace_boundary",
    "replace_custom",
)


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all numeric columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def normalize_action(raw: object) -> str | None:
    key = str(raw or "remove").strip().lower()
    if key not in IQR_ACTIONS:
        return None
    return key


def parse_multiplier(raw: object) -> float | None:
    try:
        value = float(raw if raw is not None and raw != "" else 1.5)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value) or value <= 0:
        return None
    return value


def parse_custom_value(raw: object) -> float | None:
    try:
        value = float(raw if raw is not None and raw != "" else 0.0)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    return value


def parse_bool(raw: object, default: bool = True) -> bool | None:
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


def changed_cell_count(before, after) -> int:
    if before.shape != after.shape:
        return 0
    neq = before.ne(after)
    both_na = before.isna() & after.isna()
    return int((neq & ~both_na).to_numpy().sum())


@NodeDef(
    name="Remove Outliers IQR",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "outlierIqr.svg"),
    description=_(
        "Handles outliers with the IQR (interquartile range) method. Values outside "
        "Q1−multiplier×IQR and Q3+multiplier×IQR can be removed or replaced. Empty column "
        "list means all numeric columns. Operate IQR Outlier Handling calls the same Core function."
    ),  # cn:用 IQR（四分位距）处理异常值。超出 Q1−乘数×IQR 与 Q3+乘数×IQR 的值可删除或替换。列名为空表示全部数值列。功能区「IQR异常值处理」调用同一 Core 函数。
)
class DataRemoveOutliersIQRNode:
    """Handle outliers via remove_outliers_iqr_impl."""

    multiplier = Parameter(
        float,
        default=1.5,
        min=0.5,
        max=10.0,
        description=_("IQR multiplier, default 1.5"),  # cn:IQR 倍数，默认 1.5
    )
    action = Parameter(
        str,
        default="remove",
        enum=list(IQR_ACTIONS),
        description=_("How to handle outliers (remove / replace_mean / replace_median / replace_boundary / replace_custom)"),  # cn:如何处理异常值
    )
    custom_value = Parameter(
        float,
        default=0.0,
        description=_("Replacement when action is replace_custom"),  # cn:操作为 replace_custom 时的替换值
    )
    reindex = Parameter(
        bool,
        default=True,
        description=_("Reset row numbers after removing outlier rows"),  # cn:删除异常值行后重置行号
    )
    subset = Parameter(
        str,
        default="",
        description=_("Column names to check, comma-separated; empty means all numeric columns"),  # cn:要检查的列名，逗号分隔，空表示全部数值列
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        cleaned = Output("DataFrame", description=_("Cleaned data"))  # cn:清理后的数据
        removed_count = Output("int", description=_("Number of removed rows"))  # cn:移除的行数
        replaced_count = Output("int", description=_("Number of replaced cells"))  # cn:替换的单元格数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        multiplier = parse_multiplier(params.get("multiplier", 1.5))
        if multiplier is None:
            log.error("IQR invalid multiplier=%s", params.get("multiplier"))
            return False
        action = normalize_action(params.get("action", "remove"))
        if action is None:
            log.error("IQR invalid action=%s", params.get("action"))
            return False
        custom_value = parse_custom_value(params.get("custom_value", 0.0))
        if custom_value is None:
            log.error("IQR invalid custom_value=%s", params.get("custom_value"))
            return False
        reindex = parse_bool(params.get("reindex", True), default=True)
        if reindex is None:
            log.error("IQR invalid reindex=%s", params.get("reindex"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("IQR unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        try:
            cleaned = remove_outliers_iqr_impl(
                df,
                columns=subset,
                multiplier=multiplier,
                action=action,
                custom_value=custom_value,
                reindex=reindex,
            )
        except Exception:
            log.exception("IQR failed")
            return False
        self._output_data["cleaned"] = cleaned
        self._output_data["removed_count"] = len(df) - len(cleaned)
        self._output_data["replaced_count"] = changed_cell_count(df, cleaned)
        return True
