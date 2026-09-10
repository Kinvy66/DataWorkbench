# dw:adapted — via eval_expression; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataEval — pandas eval assignment on a DataFrame."""

import logging
import os

import pandas as pd

from dw_nodes_analysis.core.operations import eval_expression
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


@NodeDef(
    name="Eval Expression",
    category=_("Data Operations"),  # cn:数据操作
    icon=os.path.join(_ICON_DIR, "eval.svg"),
    description=_(
        "Evaluates a pandas eval assignment on a DataFrame (e.g. 'c = a + b'). "
        "Expressions without assignment return a Series and are rejected. "
        "Ribbon Eval calls the same Core function."
    ),  # cn:在 DataFrame 上执行 pandas eval 赋值（如 'c = a + b'）。无赋值的表达式会返回 Series，会被拒绝。功能区「表达式计算」调用同一 Core 函数。
)
class DataEvalNode:
    """Apply a pandas eval assignment via eval_expression."""

    expression = Parameter(
        str,
        default="",
        layout="below",
        description=_("pandas eval assignment, e.g. 'c = a + b'"),  # cn:pandas eval 赋值，如 'c = a + b'
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input data"))  # cn:输入数据

    class Outputs:
        result = Output("DataFrame", description=_("Computed data"))  # cn:计算后的数据

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        expr = str(params.get("expression", "") or "").strip()
        if df is None or not expr:
            return False
        try:
            computed = eval_expression(df, expr)
        except Exception:
            log.exception("Eval Expression failed")
            return False
        if not isinstance(computed, pd.DataFrame):
            log.error("Eval Expression did not return a DataFrame; use an assignment such as c = a + b")
            return False
        self._output_data["result"] = computed
        return True
