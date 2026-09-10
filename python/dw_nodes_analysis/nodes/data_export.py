# dw:adapted — via export_data; pickle blocked; super().__init__ via NodeDef MRO.
# -*- coding: utf-8 -*-
"""DataExport — write a DataFrame to a file."""

import logging
import os
from pathlib import Path

from dw_nodes_analysis.core.io import export_data
from dw_nodes_analysis.i18n import _
from dw_workflow import Input, NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")

EXPORT_FORMATS = ("csv", "json", "excel", "parquet")
EXPORT_ALIASES = {
    "xlsx": "excel",
    "xls": "excel",
}
_PICKLE = frozenset({"pickle", "pkl"})


def normalize_format(raw: object) -> str | None:
    """Map aliases to Core export_data types. Pickle is never allowed."""
    key = str(raw or "csv").strip().lower().lstrip(".")
    if key in _PICKLE:
        return None
    key = EXPORT_ALIASES.get(key, key)
    if key not in EXPORT_FORMATS:
        return None
    return key


@NodeDef(
    name="Data Export",
    category=_("Data Analysis"),  # cn:数据分析
    icon=os.path.join(_ICON_DIR, "dataExport.svg"),
    description=_(
        "Exports a DataFrame to CSV, JSON, Excel, or Parquet. Specify the output path and format; "
        "the directory is created if missing. Pickle is disabled. Ribbon Export still writes the "
        "selected DataManager table via data.export; this node writes the connected pipeline frame."
    ),  # cn:将 DataFrame 导出为 CSV、JSON、Excel 或 Parquet。指定路径和格式；目录不存在时自动创建。已禁用 pickle。功能区「导出」仍经 data.export 写当前 DataManager 表；本节点写工作流连入的表。
)
class DataExportNode:
    """Write a DataFrame via Core export_data."""

    file_path = Parameter(
        str,
        default="",
        layout="below",
        description=_("Export file path"),  # cn:导出文件路径
    )
    export_format = Parameter(
        str,
        default="csv",
        enum=["csv", "json", "excel", "parquet"],
        description=_("Export format (excel also accepts xlsx)"),  # cn:导出格式（excel 亦接受 xlsx）
    )

    class Inputs:
        data = Input("DataFrame", required=True, description=_("Input DataFrame"))  # cn:输入 DataFrame

    class Outputs:
        success = Output("bool", description=_("Whether export succeeded"))  # cn:导出是否成功
        file_path_out = Output("str", description=_("Actual export file path"))  # cn:实际导出文件路径

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}
        df = inputs.get("data")
        file_path = str(params.get("file_path") or "").strip()
        fmt = normalize_format(params.get("export_format", "csv"))
        if df is None or not file_path or fmt is None:
            return False
        try:
            dest = Path(file_path)
            if dest.parent and not dest.parent.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
            export_data(df, str(dest), fmt)
        except Exception:
            log.exception("Data Export failed")
            return False
        self._output_data["success"] = True
        self._output_data["file_path_out"] = str(dest)
        return True
