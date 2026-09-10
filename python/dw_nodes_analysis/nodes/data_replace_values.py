# dw:adapted — via replace_values_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataReplaceValues — replace matching cells in a DataFrame."""

import logging
import os

from dw_nodes_analysis.core.cleaning import replace_values_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def parse_old_values(text: object) -> list[str]:
    """Comma-separated values to replace; empty parts are skipped."""
    if isinstance(text, (list, tuple)):
        return [str(item).strip() for item in text if str(item).strip()]
    return [s.strip() for s in str(text or "").split(",") if s.strip()]


def parse_new_value(raw: object) -> object:
    """Try float, otherwise keep the string (empty stays empty)."""
    if raw is None:
        return ""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw
    text = str(raw)
    if text == "":
        return ""
    try:
        return float(text)
    except (TypeError, ValueError):
        return text


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
    neq = before.ne(after)
    both_na = before.isna() & after.isna()
    return int((neq & ~both_na).to_numpy().sum())


@NodeDef(
    name="Replace Values",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "replaceValues.svg"),
    description=_(
        "Replaces matching cells. Old values are comma-separated; empty column list means all columns. "
        "Optional case-insensitive match for text columns. Ribbon Replace Values calls the same Core function."
    ),  # cn:替换匹配的单元格。旧值为逗号分隔；列名为空表示全部列。文本列可选择不区分大小写。功能区「替换值」调用同一 Core 函数。
)
class DataReplaceValuesNode:
    """Replace matching cells via replace_values_impl."""

    old_values = Parameter(
        str,
        default="",
        description=_("Values to replace, comma-separated"),  # cn:要替换的旧值，逗号分隔
    )
    new_value = Parameter(
        str,
        default="",
        description=_("Replacement value"),  # cn:替换后的新值
    )
    subset = Parameter(
        str,
        default="",
        description=_("Column names to search, comma-separated; empty means all columns"),  # cn:要搜索的列名，逗号分隔，空表示全部列
    )
    case_sensitive = Parameter(
        bool,
        default=True,
        description=_("Match text columns case-sensitively"),  # cn:文本列是否区分大小写
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        replaced = Output("DataFrame", description=_("Replaced data"))  # cn:替换后的数据
        replaced_count = Output("int", description=_("Number of replaced cells"))  # cn:替换的单元格数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        olds = parse_old_values(params.get("old_values", ""))
        if not olds:
            log.error("Replace Values old_values is empty")
            return False
        case_sensitive = parse_bool(params.get("case_sensitive", True))
        if case_sensitive is None:
            log.error("Replace Values invalid case_sensitive=%s", params.get("case_sensitive"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Replace Values unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        new_value = parse_new_value(params.get("new_value", ""))
        try:
            replaced = replace_values_impl(
                df,
                subset=subset,
                old_values=olds,
                new_value=new_value,
                case_sensitive=case_sensitive,
            )
        except Exception:
            log.exception("Replace Values failed")
            return False
        self._output_data["replaced"] = replaced
        self._output_data["replaced_count"] = changed_cell_count(df, replaced)
        return True
