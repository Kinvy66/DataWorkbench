from __future__ import annotations

import json
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from dw_host.errors import ErrorCode, HostError
from dw_nodes_analysis import register_analysis_nodes
from dw_nodes_system import register_system_nodes
from dw_workflow import (
    DAConnection,
    DANodeFactory,
    DAWorkflow,
    DAWorkflowExecutor,
    DAWorkflowSerializer,
)

Notify = Callable[[str, dict[str, Any]], None]


@dataclass
class DeferredStart:
    result: dict[str, Any]
    start: Callable[[], None]


def _node_params(node: Any) -> dict[str, Any]:
    params: dict[str, Any] = {}
    for name in getattr(node, "parameters", {}) or {}:
        if not name:
            continue
        value = getattr(node, name, None)
        if value is not None:
            params[name] = value
    return params


def _runtime_state_wire(node: Any) -> dict[str, Any]:
    raw: dict[str, Any] = {}
    if hasattr(node, "serialize_runtime_state"):
        try:
            raw = node.serialize_runtime_state() or {}
        except Exception:
            raw = {}
    if "display_text" not in raw:
        return {}
    return {"displayText": str(raw.get("display_text") or "")}


_STATE_WIRE = {
    "idle": "idle",
    "waiting": "idle",
    "running": "running",
    "success": "ok",
    "error": "error",
    "skipped": "idle",
}


def _param_wire(name: str, param: Any) -> dict[str, Any]:
    if hasattr(param, "to_dict"):
        raw = param.to_dict(name)
    else:
        raw = {"name": name, "type": "str"}
    props = raw.pop("properties", None) or {}
    out: dict[str, Any] = {
        "name": raw.get("name", name),
        "type": raw.get("type", "str"),
        "description": raw.get("description", ""),
    }
    if "default" in raw:
        out["default"] = raw["default"]
    for key in ("min", "max", "step", "decimals", "layout", "height"):
        if key in props:
            out[key] = props[key]
    enum = props.get("enum")
    if enum:
        out["choices"] = list(enum)
    return out


class _Session:
    def __init__(self, workflow: DAWorkflow) -> None:
        self.workflow = workflow
        self.executor: DAWorkflowExecutor | None = None
        self.thread: threading.Thread | None = None
        self.positions: dict[str, dict[str, float]] = {}
        self.cancel: threading.Event | None = None


class WorkflowRuntime:
    """In-process workflow sessions for JSON-RPC. Layout stays out of the DAG."""

    def __init__(self, notify: Notify, factory: DANodeFactory | None = None) -> None:
        self._notify = notify
        self._factory = factory or DANodeFactory()
        register_system_nodes(self._factory)
        register_analysis_nodes(self._factory)
        self._serializer = DAWorkflowSerializer(self._factory)
        self._sessions: dict[str, _Session] = {}
        self._lock = threading.Lock()

    def list_node_types(self) -> dict[str, Any]:
        types: list[dict[str, Any]] = []
        for cls in self._factory.get_registry().get_all_descriptors():
            inputs = [
                {
                    "name": port["name"],
                    "type": port.get("data_type", "any"),
                    "required": bool(port.get("required", True)),
                }
                for port in (getattr(cls, "inputs", None) or [])
            ]
            outputs = [
                {"name": port["name"], "type": port.get("data_type", "any")}
                for port in (getattr(cls, "outputs", None) or [])
            ]
            parameters = []
            for name, param in (getattr(cls, "parameters", None) or {}).items():
                parameters.append(_param_wire(name, param))
            item: dict[str, Any] = {
                "qualifiedName": getattr(cls, "qualified_name", ""),
                "name": getattr(cls, "name", ""),
                "category": getattr(cls, "category", ""),
                "inputs": inputs,
                "outputs": outputs,
                "parameters": parameters,
            }
            display = getattr(cls, "_node_display", None)
            body_shape = getattr(display, "body_shape", None) if display is not None else None
            if body_shape:
                item["bodyShape"] = str(body_shape)
            types.append(item)
        types.sort(key=lambda item: (str(item["category"]), str(item["name"])))
        return {"types": types}

    def create(self, name: str) -> dict[str, Any]:
        workflow_id = str(uuid.uuid4())
        session = _Session(DAWorkflow(name=name))
        with self._lock:
            self._sessions[workflow_id] = session
        return {"workflowId": workflow_id, "name": name}

    def add_node(
        self,
        workflow_id: str,
        qualified_name: str,
        node_id: str | None = None,
        position: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        session = self._session(workflow_id)
        self._ensure_idle(session)
        try:
            node = self._factory.create_node(qualified_name)
        except KeyError as exc:
            raise HostError(ErrorCode.NodeTypeNotFound, str(exc), "workflow.unknownType") from exc
        if node_id:
            node.node_id = node_id
        try:
            assigned = session.workflow.add_node(node)
        except (KeyError, ValueError) as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.invalidNode") from exc
        self._hook_node(node, workflow_id)
        if position:
            session.positions[assigned] = position
        return {"nodeId": assigned, "qualifiedName": qualified_name}

    def remove_node(self, workflow_id: str, node_id: str) -> dict[str, Any]:
        session = self._session(workflow_id)
        self._ensure_idle(session)
        try:
            session.workflow.remove_node(node_id)
        except (KeyError, ValueError) as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.nodeNotFound") from exc
        session.positions.pop(node_id, None)
        return {"ok": True}

    def set_param(self, workflow_id: str, node_id: str, name: str, value: Any) -> dict[str, Any]:
        session = self._session(workflow_id)
        self._ensure_idle(session)
        try:
            node = session.workflow.get_node_by_id(node_id)
        except KeyError as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.nodeNotFound") from exc
        parameters = getattr(node, "parameters", {})
        if name not in parameters:
            raise HostError(ErrorCode.InvalidParams, f"Unknown parameter '{name}'", "workflow.unknownParam")
        setattr(node, name, value)
        return {"ok": True}

    def connect(
        self,
        workflow_id: str,
        from_id: str,
        from_port: str,
        to_id: str,
        to_port: str,
        connection_id: str | None = None,
    ) -> dict[str, Any]:
        session = self._session(workflow_id)
        self._ensure_idle(session)
        try:
            conn = DAConnection(from_id, from_port, to_id, to_port, connection_id)
            assigned = session.workflow.add_connection(conn)
        except ValueError as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.duplicateConnection") from exc
        except KeyError as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.nodeNotFound") from exc
        return {"connectionId": assigned}

    def disconnect(
        self,
        workflow_id: str,
        connection_id: str | None = None,
        from_id: str | None = None,
        from_port: str | None = None,
        to_id: str | None = None,
        to_port: str | None = None,
    ) -> dict[str, Any]:
        session = self._session(workflow_id)
        self._ensure_idle(session)
        resolved = connection_id
        if not resolved:
            if not all((from_id, from_port, to_id, to_port)):
                raise HostError(
                    ErrorCode.InvalidParams,
                    "disconnect requires connectionId or a port quadruple",
                    "workflow.invalidDisconnect",
                )
            for conn in session.workflow.get_connections():
                if (
                    conn.source_node_id == from_id
                    and conn.source_output_channel == from_port
                    and conn.target_node_id == to_id
                    and conn.target_input_channel == to_port
                ):
                    resolved = conn.connection_id
                    break
            if not resolved:
                raise HostError(ErrorCode.InvalidParams, "Connection not found", "workflow.connectionNotFound")
        try:
            session.workflow.remove_connection(resolved)
        except KeyError as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.connectionNotFound") from exc
        return {"ok": True}

    def dump_logic(self, workflow_id: str, fmt: str = "json") -> dict[str, Any]:
        session = self._session(workflow_id)
        kind = (fmt or "json").strip().lower()
        if kind == "xml":
            return {"format": "xml", "payload": self._serializer.to_xml(session.workflow)}
        if kind != "json":
            raise HostError(ErrorCode.InvalidParams, f"Unsupported dump format '{fmt}'", "workflow.invalidFormat")
        return {"format": "json", "payload": self._serializer.to_dict(session.workflow)}

    def load_logic(self, payload: Any, fmt: str = "json", workflow_id: str | None = None) -> dict[str, Any]:
        kind = (fmt or "json").strip().lower()
        try:
            if kind == "xml":
                if not isinstance(payload, str):
                    raise HostError(ErrorCode.InvalidParams, "XML payload must be a string", "workflow.invalidFormat")
                workflow = self._serializer.from_xml(payload, self._factory)
            elif kind == "json":
                data = payload
                if isinstance(payload, str):
                    data = json.loads(payload)
                if not isinstance(data, dict):
                    raise HostError(ErrorCode.InvalidParams, "JSON payload must be an object", "workflow.invalidFormat")
                workflow = self._serializer.from_dict(data, self._factory)
            else:
                raise HostError(ErrorCode.InvalidParams, f"Unsupported load format '{fmt}'", "workflow.invalidFormat")
        except HostError:
            raise
        except KeyError as exc:
            raise HostError(ErrorCode.NodeTypeNotFound, str(exc), "workflow.unknownType") from exc
        except Exception as exc:
            raise HostError(ErrorCode.InvalidParams, str(exc), "workflow.invalidFormat") from exc

        assigned = workflow_id or str(uuid.uuid4())
        with self._lock:
            existing = self._sessions.get(assigned)
        if existing is not None:
            self._ensure_idle(existing)
        session = _Session(workflow)
        for node in workflow.get_nodes():
            self._hook_node(node, assigned)
        with self._lock:
            self._sessions[assigned] = session
        return {"workflowId": assigned, "name": workflow.name}

    def get_graph(self, workflow_id: str) -> dict[str, Any]:
        """View snapshot for wrap. Positions stay on the frontend."""
        session = self._session(workflow_id)
        nodes: list[dict[str, Any]] = []
        for node in session.workflow.get_nodes():
            node_id = getattr(node, "node_id", "")
            item: dict[str, Any] = {
                "nodeId": node_id,
                "qualifiedName": getattr(node, "qualified_name", ""),
                "parameters": _node_params(node),
            }
            runtime_state = _runtime_state_wire(node)
            if runtime_state:
                item["runtimeState"] = runtime_state
            nodes.append(item)
        connections: list[dict[str, Any]] = []
        for conn in session.workflow.get_connections():
            connections.append(
                {
                    "connectionId": conn.connection_id,
                    "fromId": conn.source_node_id,
                    "fromPort": conn.source_output_channel,
                    "toId": conn.target_node_id,
                    "toPort": conn.target_input_channel,
                }
            )
        return {
            "workflowId": workflow_id,
            "name": session.workflow.name,
            "nodes": nodes,
            "connections": connections,
        }

    def schedule_execute(self, workflow_id: str) -> DeferredStart:
        run = self.begin_execute(workflow_id)
        session = self._session(workflow_id)

        def kick() -> None:
            thread = threading.Thread(target=run, name=f"dw-wf-{workflow_id[:8]}", daemon=True)
            session.thread = thread
            thread.start()

        return DeferredStart(result={"accepted": True, "workflowId": workflow_id}, start=kick)

    def begin_execute(self, workflow_id: str) -> Callable[[], None]:
        session = self._session(workflow_id)
        self._ensure_idle(session)
        if not session.workflow.is_valid_dag():
            raise HostError(ErrorCode.DagCycle, "Workflow contains a cycle", "workflow.cycle")
        executor = DAWorkflowExecutor(session.workflow)
        session.executor = executor
        self._bind_cancel(session)

        def run() -> None:
            ok = False
            error: str | None = None
            try:
                ok = bool(executor.execute())
                if not ok:
                    msgs = list(getattr(executor, "_error_messages", []) or [])
                    error = msgs[0] if msgs else "Workflow execution failed"
            except Exception as exc:
                error = str(exc)
                ok = False
            stopped = session.cancel is not None and session.cancel.is_set()
            params: dict[str, Any] = {"workflowId": workflow_id, "ok": ok}
            if stopped:
                params["ok"] = False
                params["cancelled"] = True
            elif error:
                params["error"] = error
            self._notify("workflow.finished", params)

        return run

    def pause(self, workflow_id: str) -> dict[str, Any]:
        session = self._session(workflow_id)
        if session.executor is not None:
            session.executor.pause()
        return {"ok": True}

    def resume(self, workflow_id: str) -> dict[str, Any]:
        session = self._session(workflow_id)
        if session.executor is not None:
            session.executor.resume()
        return {"ok": True}

    def stop(self, workflow_id: str) -> dict[str, Any]:
        session = self._session(workflow_id)
        if session.cancel is not None:
            session.cancel.set()
        if session.executor is not None:
            session.executor.terminate()
        return {"ok": True}

    def _bind_cancel(self, session: _Session) -> None:
        cancel = session.cancel
        if cancel is None:
            cancel = threading.Event()
            session.cancel = cancel
        else:
            cancel.clear()
        for node in session.workflow.get_nodes():
            setattr(node, "_dw_cancel", cancel)

    def _session(self, workflow_id: str) -> _Session:
        with self._lock:
            session = self._sessions.get(workflow_id)
        if session is None:
            raise HostError(ErrorCode.InvalidParams, f"Workflow '{workflow_id}' is not found", "workflow.notFound")
        return session

    def _ensure_idle(self, session: _Session) -> None:
        thread = session.thread
        if thread is not None and thread.is_alive():
            raise HostError(ErrorCode.WorkflowExecute, "Workflow is running", "workflow.busy")

    def _hook_node(self, node: Any, workflow_id: str) -> None:
        if getattr(node, "_dw_state_hooked", False):
            return
        original = node.set_node_state

        def hooked(state: str) -> None:
            original(state)
            node_id = getattr(node, "node_id", None)
            if not node_id:
                return
            payload: dict[str, Any] = {
                "workflowId": workflow_id,
                "nodeId": node_id,
                "state": _STATE_WIRE.get(state, state),
            }
            if state in ("success", "error"):
                payload.update(_runtime_state_wire(node))
            self._notify("workflow.nodeState", payload)

        node.set_node_state = hooked
        node._dw_state_hooked = True
