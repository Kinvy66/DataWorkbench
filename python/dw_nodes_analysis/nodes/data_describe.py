# dw:adapted — via describe_dataframe; flatten index to "stat"; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataDescribe — descriptive statistics for a DataFrame."""

import logging
import os

from dw_nodes_analysis.core.operations import describe_dataframe
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

DEFAULT_PERCENTILES = "0.25,0.5,0.75"


def parse_percentiles(raw: object) -> list[float] | None:
    """Parse comma-separated or list percentiles in [0, 1]. Empty means pandas default."""
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)):
        parts = list(raw)
    else:
        text = str(raw).strip()
        if not text:
            return None
        parts = [p.strip() for p in text.split(",") if p.strip()]
        if not parts:
            return None
    out: list[float] = []
    seen: set[float] = set()
    for part in parts:
        try:
            value = float(part)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"invalid percentile {part!r}") from exc
        if value < 0.0 or value > 1.0:
            raise ValueError(f"percentile out of range: {value}")
        if value in seen:
            raise ValueError(f"duplicate percentile: {value}")
        seen.add(value)
        out.append(value)
    return out


def flatten_describe(stats):
    """Turn describe() index (count, mean, …) into a visible ``stat`` column."""
    table = stats.reset_index()
    first = table.columns[0]
    return table.rename(columns={first: "stat"})


@NodeDef(
    name="Describe",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "describe.svg"),
    description=_(
        "Generates descriptive statistics (count, mean, std, min, max, and configurable percentiles) "
        "for numeric columns. Outputs a new statistics table; does not modify the input. "
        "Ribbon Describe calls the same Core function."
    ),  # cn:为数值列生成描述性统计（计数、均值、标准差、最小/最大值和可配置分位数）。输出新的统计表，不修改输入。功能区「描述统计」调用同一 Core 函数。
)
class DataDescribeNode:
    """Descriptive statistics via describe_dataframe."""

    percentiles = Parameter(
        str,
        default=DEFAULT_PERCENTILES,
        description=_("Percentiles, comma-separated values in [0, 1]; empty uses pandas defaults"),  # cn:分位数，逗号分隔、取值 [0, 1]；空则使用 pandas 默认
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        stats_data = Output("DataFrame", description=_("Descriptive statistics result"))  # cn:描述性统计结果

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        try:
            pcts = parse_percentiles(params.get("percentiles", DEFAULT_PERCENTILES))
        except ValueError:
            log.error("Describe invalid percentiles=%s", params.get("percentiles"))
            return False
        try:
            stats = describe_dataframe(df, percentiles=pcts)
            self._output_data["stats_data"] = flatten_describe(stats)
        except Exception:
            log.exception("Describe failed")
            return False
        return True
