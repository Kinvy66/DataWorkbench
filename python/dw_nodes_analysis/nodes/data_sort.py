# dw:adapted — rows via sort_dataframe; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataSort — sort a DataFrame by one or more columns."""

import logging
import os

from dw_nodes_analysis.core.operations import sort_dataframe
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


def parse_columns(text: object) -> list[str]:
    """Comma-separated column names; empty means none selected."""
    return [s.strip() for s in str(text or "").split(",") if s.strip()]


@NodeDef(
    name="Sort",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "sort.svg"),
    description=_(
        "Sorts a DataFrame by one or more columns. Specify column names as a comma-separated list "
        "and choose ascending or descending order. Ribbon Sort calls the same Core function."
    ),  # cn:按一个或多个列对 DataFrame 排序。列名以逗号分隔，可选择升序或降序。功能区「排序」调用同一 Core 函数。
)
class DataSortNode:
    """Sort rows via sort_dataframe."""

    columns = Parameter(
        str,
        default="",
        description=_("Sort column names, comma separated"),  # cn:排序列名，逗号分隔
    )
    ascending = Parameter(
        bool,
        default=True,
        description=_("Ascending order"),  # cn:是否升序
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        sorted = Output("DataFrame", description=_("Sorted data"))  # cn:排序后的数据

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        cols = parse_columns(params.get("columns", ""))
        if df is None or not cols:
            return False
        mapping = {str(col): col for col in df.columns}
        missing = [name for name in cols if name not in mapping]
        if missing:
            log.error("Sort unknown columns: %s", missing)
            return False
        resolved = [mapping[name] for name in cols]
        asc = bool(params.get("ascending", True))
        try:
            result = sort_dataframe(df, resolved, asc)
        except Exception:
            log.exception("Sort failed")
            return False
        self._output_data["sorted"] = result
        return True
