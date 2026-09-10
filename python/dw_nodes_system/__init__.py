# dw:adapted — Start/End/Constant/Delay/IfElse/DataToManager from DASystemNodes.

from .i18n import setup_i18n

setup_i18n()

from .nodes.condition_if import IfElseNode
from .nodes.constant import ConstantNode
from .nodes.data_to_manager import DataToManagerNode
from .nodes.delay import DelayNode
from .nodes.end import EndNode
from .nodes.start import StartNode

__all__ = [
    "ConstantNode",
    "DataToManagerNode",
    "DelayNode",
    "EndNode",
    "IfElseNode",
    "StartNode",
    "register_system_nodes",
]


def register_system_nodes(factory) -> None:
    registry = factory.get_registry()
    for cls in (StartNode, EndNode, ConstantNode, DelayNode, IfElseNode, DataToManagerNode):
        registry.register_node(cls)
