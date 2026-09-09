from __future__ import annotations

from typing import Any

from pydantic import BaseModel, model_validator

from dw_host.errors import ErrorCode, HostError
from dw_host.workflow_runtime import WorkflowRuntime


class CreateParams(BaseModel):
    name: str = ""


class WorkflowIdParams(BaseModel):
    workflowId: str


class AddNodeParams(BaseModel):
    workflowId: str
    qualifiedName: str
    nodeId: str | None = None
    position: dict[str, float] | None = None


class RemoveNodeParams(BaseModel):
    workflowId: str
    nodeId: str


class SetParamParams(BaseModel):
    workflowId: str
    nodeId: str
    name: str
    value: Any = None


class ConnectParams(BaseModel):
    workflowId: str
    fromId: str
    fromPort: str
    toId: str
    toPort: str


class DisconnectParams(BaseModel):
    workflowId: str
    connectionId: str | None = None
    fromId: str | None = None
    fromPort: str | None = None
    toId: str | None = None
    toPort: str | None = None

    @model_validator(mode="after")
    def require_id_or_ports(self) -> DisconnectParams:
        if self.connectionId:
            return self
        if self.fromId and self.fromPort and self.toId and self.toPort:
            return self
        raise ValueError("disconnect requires connectionId or fromId/fromPort/toId/toPort")


class DumpParams(BaseModel):
    workflowId: str
    format: str = "json"


class LoadParams(BaseModel):
    payload: Any
    format: str = "json"
    workflowId: str | None = None


class ExecuteParams(BaseModel):
    workflowId: str


def dispatch(method: str, params: dict[str, Any], runtime: WorkflowRuntime) -> Any:
    if method == "workflow.listNodeTypes":
        return runtime.list_node_types()
    if method == "workflow.create":
        parsed = CreateParams.model_validate(params)
        return runtime.create(parsed.name)
    if method == "workflow.addNode":
        parsed = AddNodeParams.model_validate(params)
        return runtime.add_node(parsed.workflowId, parsed.qualifiedName, parsed.nodeId, parsed.position)
    if method == "workflow.removeNode":
        parsed = RemoveNodeParams.model_validate(params)
        return runtime.remove_node(parsed.workflowId, parsed.nodeId)
    if method == "workflow.setParam":
        parsed = SetParamParams.model_validate(params)
        return runtime.set_param(parsed.workflowId, parsed.nodeId, parsed.name, parsed.value)
    if method == "workflow.connect":
        parsed = ConnectParams.model_validate(params)
        return runtime.connect(parsed.workflowId, parsed.fromId, parsed.fromPort, parsed.toId, parsed.toPort)
    if method == "workflow.disconnect":
        parsed = DisconnectParams.model_validate(params)
        return runtime.disconnect(
            parsed.workflowId,
            parsed.connectionId,
            parsed.fromId,
            parsed.fromPort,
            parsed.toId,
            parsed.toPort,
        )
    if method == "workflow.dumpLogic":
        parsed = DumpParams.model_validate(params)
        return runtime.dump_logic(parsed.workflowId, parsed.format)
    if method == "workflow.loadLogic":
        parsed = LoadParams.model_validate(params)
        return runtime.load_logic(parsed.payload, parsed.format, parsed.workflowId)
    if method == "workflow.execute":
        parsed = ExecuteParams.model_validate(params)
        return runtime.schedule_execute(parsed.workflowId)
    if method == "workflow.pause":
        parsed = WorkflowIdParams.model_validate(params)
        return runtime.pause(parsed.workflowId)
    if method == "workflow.resume":
        parsed = WorkflowIdParams.model_validate(params)
        return runtime.resume(parsed.workflowId)
    if method == "workflow.stop":
        parsed = WorkflowIdParams.model_validate(params)
        return runtime.stop(parsed.workflowId)
    raise HostError(ErrorCode.MethodNotFound, f"Method not found: {method}")
