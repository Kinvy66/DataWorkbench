# dw:adapted — Data Source / Query / DropNA / FillNA / Sort; Core lives in .core (vendored DADataAnalysisCore).

from .i18n import setup_i18n

setup_i18n()

from .nodes.data_dropna import DataDropNaNode
from .nodes.data_fillna import DataFillNaNode
from .nodes.data_query import DataQueryNode
from .nodes.data_sort import DataSortNode
from .nodes.data_source import DataSourceNode

__all__ = [
    "DataDropNaNode",
    "DataFillNaNode",
    "DataQueryNode",
    "DataSortNode",
    "DataSourceNode",
    "register_analysis_nodes",
]


def register_analysis_nodes(factory) -> None:
    registry = factory.get_registry()
    for cls in (DataSourceNode, DataQueryNode, DataDropNaNode, DataFillNaNode, DataSortNode):
        registry.register_node(cls)
