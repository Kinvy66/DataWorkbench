# dw:adapted — via search_dataframe; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataSearch — keep rows whose column matches a regex pattern."""

import logging
import os

from dw_nodes_analysis.core.operations import search_dataframe
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


def parse_bool(raw: object, default: bool = False) -> bool | None:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    key = str(raw).strip().lower()
    if key in ("1", "true", "yes", "on"):
        return True
    if key in ("0", "false", "no", "off", ""):
        return False
    return None


@NodeDef(
    name="Search",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "search.svg"),
    description=_(
        "Keeps rows whose selected column matches a regex pattern. "
        "Case-insensitive by default. Ribbon Search calls the same Core function."
    ),  # cn:保留所选列匹配正则的行。默认不区分大小写。功能区「搜索」调用同一 Core 函数。
)
class DataSearchNode:
    """Keep matching rows via search_dataframe."""

    column = Parameter(str, default="", description=_("Column to search"))  # cn:要搜索的列名
    pattern = Parameter(
        str,
        default="",
        description=_("Search pattern, supports regex"),  # cn:搜索模式，支持正则
    )
    case_sensitive = Parameter(bool, default=False, description=_("Case sensitive"))  # cn:是否区分大小写

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        result = Output("DataFrame", description=_("Search results"))  # cn:搜索结果
        match_count = Output("int", description=_("Number of matched rows"))  # cn:匹配行数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        column = str(params.get("column", "") or "").strip()
        pattern = str(params.get("pattern", "") or "").strip()
        if df is None or not column or not pattern:
            return False
        mapping = {str(col): col for col in df.columns}
        if column not in mapping:
            log.error("Search unknown column=%s", column)
            return False
        case_sensitive = parse_bool(params.get("case_sensitive", False))
        if case_sensitive is None:
            log.error("Search invalid case_sensitive=%s", params.get("case_sensitive"))
            return False
        try:
            matched = search_dataframe(df, mapping[column], pattern, case_sensitive)
        except Exception:
            log.exception("Search failed")
            return False
        self._output_data["result"] = matched
        self._output_data["match_count"] = int(len(matched))
        return True
