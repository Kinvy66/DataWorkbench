from __future__ import annotations


class ErrorCode:
    ParseError = -32700
    InvalidRequest = -32600
    MethodNotFound = -32601
    InvalidParams = -32602
    DatasetNotFound = 1001
    ColumnOrValidation = 1002
    NodeTypeNotFound = 2001
    DagCycle = 2002
    WorkflowExecute = 2003
    FileIo = 3001
    Internal = 9001


class HostError(Exception):
    """JSON-RPC application error with an optional frontend i18n key."""

    def __init__(self, code: int, message: str, i18n_key: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.i18n_key = i18n_key
