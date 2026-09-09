from dw_nodes_system import ConstantNode, register_system_nodes
from dw_workflow import DANodeFactory, DAWorkflow, DAWorkflowExecutor


def _factory() -> DANodeFactory:
    factory = DANodeFactory()
    register_system_nodes(factory)
    return factory


def test_factory_creates_and_executes_constant() -> None:
    factory = _factory()
    node = factory.create_node(ConstantNode.qualified_name)
    assert node.execute(params={"value": "42"}) is True
    assert node.get_output_data("value") == 42


def test_constant_literal_eval_list() -> None:
    factory = _factory()
    node = factory.create_node(ConstantNode.qualified_name)
    assert node.execute(params={"value": "[1, 2, 3]"}) is True
    assert node.get_output_data("value") == [1, 2, 3]


def test_executor_runs_isolated_constant() -> None:
    factory = _factory()
    node = factory.create_node(ConstantNode.qualified_name)
    node.value = "'ok'"
    workflow = DAWorkflow(name="constant-only")
    workflow.add_node(node)
    executor = DAWorkflowExecutor(workflow)
    assert executor.execute() is True
    assert node.get_output_data("value") == "ok"
