# dw:adapted — rows only via dropna_impl (no axis=1); super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataDropNa — drop rows that contain missing values."""

import logging
import os

from dw_nodes_analysis.core.cleaning import dropna_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


@NodeDef(
    name="Drop NA",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "dropNa.svg"),
    description=_(
        "Removes rows containing missing values (NaN). Supports 'any' (drop if any value is missing) "
        "or 'all' (drop only if all values are missing), with an optional column subset and a minimum "
        "non-missing count threshold. Ribbon Drop NA calls the same Core function."
    ),  # cn:删除包含缺失值（NaN）的行。支持 any（任一缺失即删）或 all（全部缺失才删），可选列子集和非缺失值最少数量。功能区「删除缺失」调用同一 Core 函数。
)
class DataDropNaNode:
    """Drop rows that contain missing values via dropna_impl."""

    how = Parameter(
        str,
        default="any",
        enum=["any", "all"],
        description=_("any: drop if any missing; all: drop only if all missing"),  # cn:any: 任一缺失即删除; all: 全部缺失才删除
    )
    subset = Parameter(
        str,
        default="",
        description=_("Column names to check, comma-separated; empty means all columns"),  # cn:检查缺失值的列名，逗号分隔，空表示全部列
    )
    thresh = Parameter(
        int,
        default=0,
        min=0,
        description=_("Minimum number of non-missing values; 0 means unused"),  # cn:非缺失值最少数量，0 表示不使用
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        cleaned = Output("DataFrame", description=_("Cleaned data"))  # cn:清理后的数据
        removed_count = Output("int", description=_("Number of removed rows"))  # cn:删除的行数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        how = str(params.get("how", "any") or "any").strip().lower()
        if how not in ("any", "all"):
            log.error("Drop NA invalid how=%s", how)
            return False
        subset = parse_subset(params.get("subset", ""))
        try:
            thresh = int(params.get("thresh", 0) or 0)
        except (TypeError, ValueError):
            return False
        if thresh < 0:
            return False
        original_len = int(len(df))
        try:
            cleaned = dropna_impl(df, subset=subset, how=how, min_non_na=thresh, reindex=True)
        except Exception:
            log.exception("Drop NA failed")
            return False
        self._output_data["cleaned"] = cleaned
        self._output_data["removed_count"] = original_len - int(len(cleaned))
        return True
