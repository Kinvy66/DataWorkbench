# dw:adapted — Start/End/Constant/Delay/IfElse/TextViewer/DataToManager from DASystemNodes.

from .i18n import setup_i18n

setup_i18n()

from .nodes.condition_if import IfElseNode
from .nodes.constant import ConstantNode
from .nodes.data_to_manager import DataToManagerNode
from .nodes.delay import DelayNode
from .nodes.end import EndNode
from .nodes.start import StartNode
from .nodes.text_viewer import TextViewerNode

__all__ = [
    "ConstantNode",
    "DataToManagerNode",
    "DelayNode",
    "EndNode",
    "IfElseNode",
    "StartNode",
    "TextViewerNode",
    "register_system_nodes",
]


def register_system_nodes(factory) -> None:
    registry = factory.get_registry()
    for cls in (
        StartNode,
        EndNode,
        ConstantNode,
        DelayNode,
        IfElseNode,
        TextViewerNode,
        DataToManagerNode,
    ):
        registry.register_node(cls)
