# dw:adapted — via create_pivot_table; flatten MultiIndex for the virtual table; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataPivotTable — create a pivot table."""

import logging
import os

from dw_nodes_analysis.core.operations import create_pivot_table
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

PIVOT_AGGFUNCS = (
    "mean",
    "sum",
    "count",
    "size",
    "min",
    "max",
    "median",
    "std",
    "var",
    "first",
    "last",
    "prod",
)


def parse_columns(text: object) -> list[str]:
    """Comma-separated column names; empty means none."""
    return [s.strip() for s in str(text or "").split(",") if s.strip()]


def normalize_aggfunc(raw: object) -> str | None:
    key = str(raw or "mean").strip().lower()
    if key not in PIVOT_AGGFUNCS:
        return None
    return key


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


def flatten_pivot(table):
    """Turn pivot index / MultiIndex columns into a flat table the virtual table can show."""
    result = table.copy() if hasattr(table, "columns") else table.to_frame()
    if getattr(result.columns, "nlevels", 1) > 1:
        result.columns = ["_".join(str(part) for part in col if str(part) != "") for col in result.columns]
    result = result.reset_index()
    result.columns = [str(col) for col in result.columns]
    return result


@NodeDef(
    name="Pivot Table",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "pivotTable.svg"),
    description=_(
        "Creates a pivot table. Index columns are required; column and value lists are optional "
        "(empty values means remaining numeric columns). Aggregation, margins, and sort match the "
        "upstream dialog. Outputs a new table; does not modify the input. Operate Pivot Table calls "
        "the same Core function."
    ),  # cn:创建透视表。行索引列必填；列索引和值列可选（值列为空表示其余数值列）。聚合、边缘汇总和排序对齐上游对话框。输出新表，不修改输入。功能区「数据透视表」调用同一 Core 函数。
)
class DataPivotTableNode:
    """Create a pivot table via create_pivot_table."""

    index = Parameter(
        str,
        default="",
        description=_("Row index column name(s), comma-separated"),  # cn:行索引列名，逗号分隔
    )
    columns = Parameter(
        str,
        default="",
        description=_("Column index column name(s), comma-separated; empty means none"),  # cn:列索引列名，逗号分隔，空表示无
    )
    values = Parameter(
        str,
        default="",
        description=_("Value column name(s), comma-separated; empty means remaining numeric columns"),  # cn:值列名，逗号分隔，空表示其余数值列
    )
    aggfunc = Parameter(
        str,
        default="mean",
        enum=list(PIVOT_AGGFUNCS),
        description=_("Aggregation function (mean/sum/count/size/min/max/…)"),  # cn:聚合函数
    )
    margins = Parameter(
        bool,
        default=False,
        description=_("Add row and column totals"),  # cn:添加行列合计
    )
    margins_name = Parameter(
        str,
        default="All",
        description=_("Name of the totals row and column"),  # cn:合计行/列的名称
    )
    sort = Parameter(
        bool,
        default=False,
        description=_("Sort the aggregated result"),  # cn:对聚合结果排序
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        pivot = Output("DataFrame", description=_("Pivot table result"))  # cn:透视表结果

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        index = parse_columns(params.get("index", ""))
        columns = parse_columns(params.get("columns", ""))
        values = parse_columns(params.get("values", ""))
        if not index:
            log.error("Pivot Table missing index columns")
            return False
        mapping = {str(col): col for col in df.columns}
        seen: set[str] = set()
        for name in index + columns + values:
            if name not in mapping:
                log.error("Pivot Table unknown column=%s", name)
                return False
            if name in seen:
                log.error("Pivot Table overlapping column role=%s", name)
                return False
            seen.add(name)
        aggfunc = normalize_aggfunc(params.get("aggfunc", "mean"))
        if aggfunc is None:
            log.error("Pivot Table invalid aggfunc=%s", params.get("aggfunc"))
            return False
        margins = parse_bool(params.get("margins", False), default=False)
        if margins is None:
            log.error("Pivot Table invalid margins=%s", params.get("margins"))
            return False
        sort = parse_bool(params.get("sort", False), default=False)
        if sort is None:
            log.error("Pivot Table invalid sort=%s", params.get("sort"))
            return False
        margins_name = str(params.get("margins_name", "All") or "All").strip() or "All"
        try:
            table = create_pivot_table(
                df,
                index=[mapping[name] for name in index],
                columns=[mapping[name] for name in columns] or None,
                values=[mapping[name] for name in values] or None,
                aggfunc=aggfunc,
                margins=margins,
                margins_name=margins_name,
                sort=sort,
            )
            self._output_data["pivot"] = flatten_pivot(table)
        except Exception:
            log.exception("Pivot Table failed")
            return False
        return True
