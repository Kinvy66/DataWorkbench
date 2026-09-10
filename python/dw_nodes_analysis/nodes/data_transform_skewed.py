# dw:adapted — via transform_skewed_impl; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataTransformSkewed — skewed-data transformation."""

import logging
import math
import os

import pandas as pd

from dw_nodes_analysis.core.cleaning import transform_skewed_impl
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

TRANSFORM_METHODS = ("log", "sqrt", "reciprocal", "power", "boxcox")


def parse_subset(text: object) -> list[str] | None:
    """Comma-separated column names; empty means all numeric columns."""
    parts = [s.strip() for s in str(text or "").split(",") if s.strip()]
    return parts or None


def normalize_method(raw: object) -> str | None:
    key = str(raw or "log").strip().lower()
    if key not in TRANSFORM_METHODS:
        return None
    return key


def parse_lambda(raw: object) -> float | None:
    try:
        value = float(raw if raw is not None and raw != "" else 0.5)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    return value


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


def numeric_column_count(df, subset: list | None) -> int:
    cols = subset if subset else list(df.columns)
    return sum(1 for col in cols if col in df.columns and pd.api.types.is_numeric_dtype(df[col]))


@NodeDef(
    name="Transform Skewed",
    category=_("Data Cleaning"),  # cn:数据清洗
    icon=os.path.join(_ICON_DIR, "transformSkewed.svg"),
    description=_(
        "Transforms skewed numeric columns (log / sqrt / reciprocal / power / boxcox) to improve "
        "distribution. Methods match the upstream dialog plus Core boxcox. Empty column list means "
        "all numeric columns. Operate Transform Skewed calls the same Core function."
    ),  # cn:转换偏态数值列（对数/平方根/倒数/幂/Box-Cox）以改善分布。方法对齐上游对话框并含 Core 的 boxcox。列名为空表示全部数值列。功能区「转换偏态数据」调用同一 Core 函数。
)
class DataTransformSkewedNode:
    """Transform skewed columns via transform_skewed_impl."""

    method = Parameter(
        str,
        default="log",
        enum=list(TRANSFORM_METHODS),
        description=_("Transformation method (log/sqrt/reciprocal/power/boxcox)"),  # cn:转换方法
    )
    lambda_value = Parameter(
        float,
        default=0.5,
        min=-5.0,
        max=5.0,
        description=_("Power lambda; only used when method is power"),  # cn:幂转换的 lambda；仅 method 为 power 时使用
    )
    add_one = Parameter(
        bool,
        default=True,
        description=_("Add 1 before log/sqrt/boxcox to handle zeros"),  # cn:对数/平方根/Box-Cox 前加 1 以处理零值
    )
    subset = Parameter(
        str,
        default="",
        description=_("Column names to transform, comma-separated; empty means all numeric columns"),  # cn:要转换的列名，逗号分隔，空表示全部数值列
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        transformed = Output("DataFrame", description=_("Transformed data"))  # cn:变换后的数据
        transformed_count = Output("int", description=_("Number of numeric columns transformed"))  # cn:转换的数值列数
        changed_count = Output("int", description=_("Number of changed cells"))  # cn:改变的单元格数

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        if df is None:
            return False
        method = normalize_method(params.get("method", "log"))
        if method is None:
            log.error("Transform Skewed invalid method=%s", params.get("method"))
            return False
        lambda_value = parse_lambda(params.get("lambda_value", 0.5))
        if lambda_value is None:
            log.error("Transform Skewed invalid lambda_value=%s", params.get("lambda_value"))
            return False
        add_one = parse_bool(params.get("add_one", True), default=True)
        if add_one is None:
            log.error("Transform Skewed invalid add_one=%s", params.get("add_one"))
            return False
        subset = parse_subset(params.get("subset", ""))
        if subset:
            mapping = {str(col): col for col in df.columns}
            missing = [name for name in subset if name not in mapping]
            if missing:
                log.error("Transform Skewed unknown columns: %s", missing)
                return False
            subset = [mapping[name] for name in subset]
        try:
            transformed = transform_skewed_impl(
                df,
                columns=subset,
                method=method,
                lambda_value=lambda_value,
                add_one=add_one,
            )
        except Exception:
            log.exception("Transform Skewed failed")
            return False
        self._output_data["transformed"] = transformed
        self._output_data["transformed_count"] = numeric_column_count(df, subset)
        self._output_data["changed_count"] = changed_cell_count(df, transformed)
        return True
