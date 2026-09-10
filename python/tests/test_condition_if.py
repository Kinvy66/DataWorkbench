from dw_host.api import bind_data_manager
from dw_host.data_manager import DataManager
from dw_nodes_system import ConstantNode, DataToManagerNode, IfElseNode, register_system_nodes
from dw_workflow import DAConnection, DANodeFactory, DAWorkflow, DAWorkflowExecutor


def _factory() -> DANodeFactory:
    factory = DANodeFactory()
    register_system_nodes(factory)
    return factory


def _if_else():
    return _factory().create_node(IfElseNode.qualified_name)


def test_true_forwards_data_and_clears_false_port() -> None:
    node = _if_else()
    assert node.execute(inputs={"condition": True, "data": "hello"}) is True
    assert node.get_output_data("true") == "hello"
    assert node.get_output_data("false") is None


def test_false_forwards_data_and_clears_true_port() -> None:
    node = _if_else()
    assert node.execute(inputs={"condition": False, "data": "hello"}) is True
    assert node.get_output_data("true") is None
    assert node.get_output_data("false") == "hello"


def test_missing_condition_takes_false_branch() -> None:
    node = _if_else()
    assert node.execute(inputs={"data": 1}) is True
    assert node.get_output_data("true") is None
    assert node.get_output_data("false") == 1


def test_zero_data_is_forwarded_not_treated_as_missing() -> None:
    node = _if_else()
    assert node.execute(inputs={"condition": True, "data": 0}) is True
    assert node.get_output_data("true") == 0
    assert node.get_output_data("false") is None


def _run_branch(condition_literal: str) -> list[str]:
    manager = DataManager()
    bind_data_manager(manager)
    factory = _factory()
    workflow = DAWorkflow(name="if-else")
    cond = factory.create_node(ConstantNode.qualified_name)
    payload = factory.create_node(ConstantNode.qualified_name)
    branch = factory.create_node(IfElseNode.qualified_name)
    taken = factory.create_node(DataToManagerNode.qualified_name)
    skipped = factory.create_node(DataToManagerNode.qualified_name)
    cond.value = condition_literal
    payload.value = "'hello'"
    taken.data_name = "taken"
    skipped.data_name = "skipped"
    cond_id = workflow.add_node(cond)
    payload_id = workflow.add_node(payload)
    branch_id = workflow.add_node(branch)
    taken_id = workflow.add_node(taken)
    skipped_id = workflow.add_node(skipped)
    workflow.add_connection(DAConnection(cond_id, "value", branch_id, "condition"))
    workflow.add_connection(DAConnection(payload_id, "value", branch_id, "data"))
    workflow.add_connection(DAConnection(branch_id, "true", taken_id, "data"))
    workflow.add_connection(DAConnection(branch_id, "false", skipped_id, "data"))
    assert DAWorkflowExecutor(workflow).execute() is True
    return [item["name"] for item in manager.list_datasets()]


def test_executor_runs_only_true_sink() -> None:
    names = _run_branch("True")
    assert names == ["taken"]


def test_executor_runs_only_false_sink() -> None:
    names = _run_branch("False")
    assert names == ["skipped"]
