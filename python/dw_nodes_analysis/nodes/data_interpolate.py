# dw:adapted — via interpolate_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataFillInterpolate — fill missing values by interpolation."""

import logging
import os

from dw_nodes_analysis.core.cleaning import interpolate_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

INTERPOLATE_METHODS = (
    "linear",
    "time",
    "index",
    "pad",
    "nearest",
    "zero",
    "slinear",
    "quadratic",
    "cubic",
    "spline",
    "barycentric",
    "polynomial",
    "krogh",
    "piecewise_polynomial",
    "pchip",
    "akima",
)


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def normalize_method(raw: object) -> str | None:
    key = str(raw or "linear").strip().lower()
    if key not in INTERPOLATE_METHODS:
        return None
    return key


def parse_limit(raw: object) -> tuple[bool, int | None]:
    """0 / empty means no consecutive-NaN cap; otherwise must be >= 1."""
    if raw is None or raw == "":
        return True, None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return False, None
    if value == 0:
        return True, None
    if value < 1:
        return False, None
    return True, value


def parse_order(raw: object) -> int | None:
    try:
        value = int(raw if raw is not None and raw != "" else 3)
    except (TypeError, ValueError):
        return None
    if value < 1 or value > 10:
        return None
    return value


def na_cell_count(df) -> int:
    return int(df.isna().to_numpy().sum())


@NodeDef(
    name="Interpolate",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "interpolate.svg"),
    description=_(
        "Fills missing values (NaN) by interpolation. Methods match the upstream interpolate dialog "
        "(linear, spline, polynomial, time, …). Optional column subset; empty means all columns. "
        "Operate Fill Interpolate calls the same Core function."
    ),  # cn:通过插值填充缺失值（NaN）。方法与上游插值对话框一致。可选列子集，空表示全部列。功能区「插值填充」调用同一 Core 函数。
)
class DataFillInterpolateNode:
    """Fill missing values via interpolate_impl."""

    method = Parameter(
        str,
        default="linear",
        enum=list(INTERPOLATE_METHODS),
        description=_("Interpolation method (linear/spline/polynomial/time/…)"),  # cn:插值方法
    )
    order = Parameter(
        int,
        default=3,
        min=1,
        max=10,
        description=_("Order for spline or polynomial interpolation"),  # cn:spline 或 polynomial 的阶数
    )
    limit = Parameter(
        int,
        default=0,
        min=0,
        description=_("Max consecutive NaNs to fill; 0 means no limit"),  # cn:连续缺失的最大填充数；0 表示不限制
    )
    subset = Parameter(
        str,
        default="",
        description=_("Column names to interpolate, comma-separated; empty means all columns"),  # cn:要插值的列名，逗号分隔，空表示全部列
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        interpolated = Output("DataFrame", description=_("Interpolated data"))  # cn:插值后的数据
        filled_count = Output("int", description=_("Number of filled cells"))  # cn:填充的单元格数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        method = normalize_method(params.get("method", "linear"))
        if method is None:
            log.error("Interpolate invalid method=%s", params.get("method"))
            return False
        order = parse_order(params.get("order", 3))
        if order is None:
            log.error("Interpolate invalid order=%s", params.get("order"))
            return False
        limit_ok, limit = parse_limit(params.get("limit", 0))
        if not limit_ok:
            log.error("Interpolate invalid limit=%s", params.get("limit"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Interpolate unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        before = na_cell_count(df)
        try:
            interpolated = interpolate_impl(df, subset=subset, method=method, limit=limit, order=order)
        except Exception:
            log.exception("Interpolate failed")
            return False
        self._output_data["interpolated"] = interpolated
        self._output_data["filled_count"] = before - na_cell_count(interpolated)
        return True
