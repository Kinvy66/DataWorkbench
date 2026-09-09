# dw:adapted — da_app/da_data replaced by dw_host.api.publish_dataframe.
# -*- coding: utf-8 -*-
"""System node: publish data to the DataManager panel."""

import logging
import os

from dw_nodes_system.i18n import _
from dw_workflow import Input, NodeDef, Parameter

_ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icon")
log = logging.getLogger("dw_nodes_system")


@NodeDef(
    name="Output to DataManager",
    category=_("System / Data"),  # cn:系统 / 数据
    icon=os.path.join(_ICON_DIR, "dataToManager.svg"),
    description=_(
        "Publishes input data to the DataManager panel. If data with the same name already exists, it is updated in place; otherwise a new entry is created. Scalars and lists are wrapped as a one-column DataFrame."
    ),  # cn:将输入数据发布到 DataManager 面板。若同名数据已存在则原地更新，否则新建条目。标量和列表会包成单列 DataFrame。
)
class DataToManagerNode:
    """Publish input data (DataFrame recommended) to the DataManager panel."""

    data_name = Parameter(
        str,
        default="workflow_output",
        description=_("Display name of the data in the DataManager panel"),  # cn:数据在 DataManager 面板中的显示名称
    )

    class Inputs:
        data = Input("any", required=True, description=_("Data to publish to DataManager"))  # cn:要发布到 DataManager 的数据

    def execute(self, inputs=None, params=None):
        if inputs is None:
            inputs = {}
        if params is None:
            params = {}

        value = inputs.get("data")
        if value is None:
            return False

        data_name = params.get("data_name", "workflow_output") or "workflow_output"
        try:
            from dw_host.api import publish_dataframe

            publish_dataframe(data_name, value)
            return True
        except ImportError:
            return False
        except Exception:
            log.exception("DataToManager publish failed")
            return False
