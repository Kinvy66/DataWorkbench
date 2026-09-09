# dw:adapted — import dw_workflow; `_` from package i18n (directory scan safe).
# -*- coding: utf-8 -*-
"""Workflow start node"""

import os

from dw_nodes_system.i18n import _
from dw_workflow import NodeDef, Output

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")


@NodeDef(
    name="Start",
    category=_("System / Flow Control"),  # cn:系统 / 流程控制
    icon=os.path.join(_ICON_DIR, "start.svg"),
    description=_(
        "Marks the workflow start point. It has no inputs and emits a trigger signal (True) on execution to kick off downstream nodes."
    ),  # cn:标记工作流起点。无输入，执行时输出触发信号（True）启动下游节点。
)
class StartNode:
    """Marks the workflow start point; sends a trigger signal downstream after execution."""

    class Outputs:
        trigger = Output("bool", description=_("Workflow start trigger signal"))  # cn:工作流启动触发信号

    def execute(self, inputs=None, params=None):
        self._output_data["trigger"] = True
        return True
