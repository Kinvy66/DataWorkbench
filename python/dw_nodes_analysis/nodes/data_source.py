# dw:adapted — DataManager lookup (not upstream file reader). See docs/dev_plan/08-data.md.
# -*- coding: utf-8 -*-
"""Workflow source: load a DataFrame already in DataManager."""

import logging
import os

from dw_nodes_analysis.i18n import _
from dw_workflow import NodeDef, Output, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_analysis")


@NodeDef(
    name="Data Source",
    category=_("Data Analysis"),  # cn:数据分析
    icon=os.path.join(_ICON_DIR, "dataSource.svg"),
    description=_(
        "Loads a DataFrame from DataManager by display name or dataset id. Import the table first (Data → Import); this node does not read files."
    ),  # cn:按显示名或数据集 id 从 DataManager 取出 DataFrame。请先用「数据 → 导入」导入表；本节点不读文件。
)
class DataSourceNode:
    """Pull an in-memory dataset into the workflow."""

    dataset_name = Parameter(
        str,
        default="",
        description=_("DataManager display name (used when dataset_id is empty)"),  # cn:DataManager 显示名（dataset_id 为空时使用）
    )
    dataset_id = Parameter(
        str,
        default="",
        description=_("Optional dataset UUID; takes precedence over dataset_name"),  # cn:可选数据集 UUID，优先于显示名
    )

    class Outputs:
        data = Output("DataFrame", description=_("Loaded DataFrame"))  # cn:读出的 DataFrame
        row_count = Output("int", description=_("Row count"))  # cn:数据行数

    def execute(self, inputs=None, params=None):
        if params is None:
            params = {}
        dataset_id = str(params.get("dataset_id") or "").strip()
        dataset_name = str(params.get("dataset_name") or "").strip()
        try:
            from dw_host.api import get_dataframe

            df = get_dataframe(dataset_id=dataset_id or None, dataset_name=dataset_name or None)
        except ImportError:
            return False
        except Exception:
            log.exception("Data Source lookup failed")
            return False
        self._output_data["data"] = df
        self._output_data["row_count"] = int(len(df))
        return True
