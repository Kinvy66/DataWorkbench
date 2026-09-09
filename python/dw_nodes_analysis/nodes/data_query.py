# dw:adapted — import dw_workflow + core.query_dataframe; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataQuery — pandas query expression node."""

import logging
import os

from dw_nodes_analysis.core.operations import query_dataframe
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


@NodeDef(
    name="Query",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "query.svg"),
    description=_(
        "Filters DataFrame rows using a pandas query expression (e.g. 'age > 25 and name == \"John\"'). Outputs the filtered data and the result row count."
    ),  # cn:使用 pandas query 表达式（如 'age > 25 and name == "John"'）筛选 DataFrame 行。输出筛选后的数据和结果行数。
)
class DataQueryNode:
    """Filter data using a pandas query expression."""

    query_string = Parameter(
        str,
        default="",
        layout="below",
        description=_("query expression, e.g. 'age > 25 and name == \"John\"'"),  # cn:query 表达式，如 'age > 25 and name == "John"'
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        result = Output("DataFrame", description=_("Query result"))  # cn:查询结果
        row_count = Output("int", description=_("Number of result rows"))  # cn:结果行数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        query_str = params.get("query_string", "") or ""
        if df is None or not str(query_str).strip():
            return False
        try:
            result = query_dataframe(df, str(query_str))
        except Exception:
            log.exception("Query failed")
            return False
        self._output_data["result"] = result
        self._output_data["row_count"] = int(len(result))
        return True
