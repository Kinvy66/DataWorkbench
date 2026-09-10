# dw:adapted — via drop_duplicates_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataDropDuplicates — drop duplicate rows from a DataFrame."""

import logging
import os

from dw_nodes_analysis.core.cleaning import drop_duplicates_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

KEEP_VALUES = ("first", "last", "none")
KEEP_ALIASES = {
    "false": "none",
}


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def normalize_keep(raw: object) -> str | None:
    if raw is False:
        return "none"
    if isinstance(raw, bool):
        return None
    key = str(raw or "first").strip().lower()
    key = KEEP_ALIASES.get(key, key)
    if key not in KEEP_VALUES:
        return None
    return key


@NodeDef(
    name="Drop Duplicates",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "dropDuplicates.svg"),
    description=_(
        "Removes duplicate rows. Choose which columns identify a duplicate (comma-separated; empty = all) "
        "and whether to keep the first, last, or no occurrence. Ribbon Drop Duplicates calls the same Core function."
    ),  # cn:删除重复行。指定用于识别重复的列（逗号分隔，空表示全部列），以及保留第一个、最后一个还是全部删除。功能区「删除重复」调用同一 Core 函数。
)
class DataDropDuplicatesNode:
    """Drop duplicate rows via drop_duplicates_impl."""

    subset = Parameter(
        str,
        default="",
        description=_("Column names for identifying duplicates, comma-separated; empty means all columns"),  # cn:用于识别重复的列名，逗号分隔，空表示全部列
    )
    keep = Parameter(
        str,
        default="first",
        enum=["first", "last", "none"],
        description=_("first/last/none: keep first, last, or drop all duplicate rows"),  # cn:first/last/none: 保留第一个、最后一个，或删除全部重复行
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        cleaned = Output("DataFrame", description=_("Deduplicated data"))  # cn:去重后的数据
        removed_count = Output("int", description=_("Number of removed rows"))  # cn:删除的行数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        keep = normalize_keep(params.get("keep", "first"))
        if keep is None:
            log.error("Drop Duplicates invalid keep=%s", params.get("keep"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Drop Duplicates unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        original_len = int(len(df))
        try:
            cleaned = drop_duplicates_impl(df, subset=subset, keep=keep, ignore_index=True)
        except Exception:
            log.exception("Drop Duplicates failed")
            return False
        self._output_data["cleaned"] = cleaned
        self._output_data["removed_count"] = original_len - int(len(cleaned))
        return True
