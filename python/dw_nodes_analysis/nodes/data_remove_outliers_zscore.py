# dw:adapted — via remove_outliers_zscore_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataRemoveOutliersZScore — Z-score outlier handling."""

import logging
import math
import os

from dw_nodes_analysis.core.cleaning import remove_outliers_zscore_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

ZSCORE_ACTIONS = (
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
    if key not in ZSCORE_ACTIONS:
        return None
    return key


def parse_threshold(raw: object) -> float | None:
    try:
        value = float(raw if raw is not None and raw != "" else 3.0)
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


def changed_cell_count(before, after) -> int:
    if before.shape != after.shape:
        return 0
    neq = before.ne(after)
    both_na = before.isna() & after.isna()
    return int((neq & ~both_na).to_numpy().sum())


@NodeDef(
    name="Remove Outliers Z-Score",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "outlierZscore.svg"),
    description=_(
        "Handles outliers with the Z-score method. Values whose absolute Z-score exceeds the "
        "threshold (default 3) can be removed or replaced. Optional robust median/MAD. Empty "
        "column list means all numeric columns. Operate Z-Score Outlier Handling calls the same Core function."
    ),  # cn:用 Z-score 处理异常值。绝对 Z-score 超过阈值（默认 3）的值可删除或替换。可选稳健中位数/MAD。列名为空表示全部数值列。功能区「Z-Score异常值处理」调用同一 Core 函数。
)
class DataRemoveOutliersZScoreNode:
    """Handle outliers via remove_outliers_zscore_impl."""

    threshold = Parameter(
        float,
        default=3.0,
        min=1.0,
        max=10.0,
        description=_("Z-score threshold, default 3.0"),  # cn:Z-Score 阈值，默认 3.0
    )
    robust = Parameter(
        bool,
        default=False,
        description=_("Use median and MAD instead of mean and std"),  # cn:使用中位数和 MAD 代替均值和标准差
    )
    action = Parameter(
        str,
        default="remove",
        enum=list(ZSCORE_ACTIONS),
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
        threshold = parse_threshold(params.get("threshold", 3.0))
        if threshold is None:
            log.error("Z-score invalid threshold=%s", params.get("threshold"))
            return False
        robust = parse_bool(params.get("robust", False), default=False)
        if robust is None:
            log.error("Z-score invalid robust=%s", params.get("robust"))
            return False
        action = normalize_action(params.get("action", "remove"))
        if action is None:
            log.error("Z-score invalid action=%s", params.get("action"))
            return False
        custom_value = parse_custom_value(params.get("custom_value", 0.0))
        if custom_value is None:
            log.error("Z-score invalid custom_value=%s", params.get("custom_value"))
            return False
        reindex = parse_bool(params.get("reindex", True), default=True)
        if reindex is None:
            log.error("Z-score invalid reindex=%s", params.get("reindex"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Z-score unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        try:
            cleaned = remove_outliers_zscore_impl(
                df,
                columns=subset,
                threshold=threshold,
                robust=robust,
                action=action,
                custom_value=custom_value,
                reindex=reindex,
            )
        except Exception:
            log.exception("Z-score failed")
            return False
        self._output_data["cleaned"] = cleaned
        self._output_data["removed_count"] = len(df) - len(cleaned)
        self._output_data["replaced_count"] = changed_cell_count(df, cleaned)
        return True
