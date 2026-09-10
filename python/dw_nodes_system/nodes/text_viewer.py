# dw:adapted — no Python paint(); Vue reads runtime_state.display_text.
# -*- coding: utf-8 -*-
"""Text viewer node: stringify input and cache it for the canvas."""

import logging
import os

from dw_nodes_system.i18n import _
from dw_workflow import Input, NodeDef, NodeDisplay, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_system")

_DEFAULT_FONT = {
    "family": "sans-serif",
    "size": 9,
    "bold": False,
    "italic": False,
    "color": "#282828",
}


@NodeDef(
    name="Text Viewer",
    category=_("System / Display"),  # cn:系统 / 显示
    icon=os.path.join(_ICON_DIR, "textViewer.svg"),
    description=_(
        "Displays input data as text directly on the node body. Supports font customization, auto-wrap, text truncation, and optional console logging. Useful for inspecting intermediate data during workflow execution."
    ),  # cn:将输入数据以文本形式直接显示在节点体上。支持字体自定义、自动换行、文本截断和可选的控制台日志输出。用于检查工作流执行过程中的中间数据。
    style=NodeDisplay(
        background_color="#FDFDFD",
        border_color="#AAAAAA",
        min_body_width=150,
        min_body_height=80,
    ),
)
class TextViewerNode:
    """Receive any data, stringify it, and cache the text for the Vue node body."""

    font = Parameter(
        "font",
        default=_DEFAULT_FONT,
        description=_("Text font (family/size/bold/italic/color)"),  # cn:文本字体（族/字号/粗体/斜体/颜色）
    )
    max_text_length = Parameter(
        int,
        default=200,
        min=1,
        description=_("Maximum text character count, excess is truncated with …"),  # cn:文字最大字符数，超出部分以 … 截断
    )
    wrap_text = Parameter(
        bool,
        default=True,
        description=_("Auto-wrap text by node body width; off for single line, excess is clipped"),  # cn:是否按节点体宽度自动换行；关闭则单行显示，超出部分被裁剪
    )
    log_to_console = Parameter(
        bool,
        default=False,
        description=_("Print input data to log/console"),  # cn:是否将输入数据打印到日志/控制台
    )

    class Inputs:
        value = Input("any", required=True, description=_("Data to display"))  # cn:要显示的数据

    def __init__(self):
        super().__init__()
        self._display_text = ""

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}

        value = inputs.get("value")
        try:
            self._display_text = str(value) if value is not None else ""
        except Exception:
            self._display_text = _("<unprintable>")  # cn:<不可打印>

        if params.get("log_to_console", False):
            log.info("%s", self._display_text)

        return True

    def serialize_runtime_state(self) -> dict:
        return {"display_text": getattr(self, "_display_text", "")}

    def deserialize_runtime_state(self, state: dict) -> None:
        self._display_text = state.get("display_text", "")
