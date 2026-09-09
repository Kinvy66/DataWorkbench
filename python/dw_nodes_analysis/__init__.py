# dw:adapted — Data Source / Query; Core lives in .core (vendored DADataAnalysisCore).

from .i18n import setup_i18n

setup_i18n()

from .nodes.data_query import DataQueryNode
from .nodes.data_source import DataSourceNode

__all__ = [
    "DataQueryNode",
    "DataSourceNode",
    "register_analysis_nodes",
]


def register_analysis_nodes(factory) -> None:
    registry = factory.get_registry()
    for cls in (DataSourceNode, DataQueryNode):
        registry.register_node(cls)
