"""Host-facing APIs for workflow nodes (replaces da_app / da_data)."""

from __future__ import annotations

import threading
from typing import Any

_bind_lock = threading.Lock()
_manager: Any = None


def bind_data_manager(manager: Any) -> None:
    global _manager
    with _bind_lock:
        _manager = manager


def publish_dataframe(name: str, obj: Any) -> str:
    """Publish a value into DataManager. Same display name overwrites in place."""
    with _bind_lock:
        manager = _manager
    if manager is None:
        raise RuntimeError("DataManager is not bound")
    return manager.publish_dataframe(name, _as_frame(obj))


def _as_frame(obj: Any) -> Any:
    import pandas as pd

    if isinstance(obj, pd.DataFrame):
        return obj
    if isinstance(obj, pd.Series):
        return obj.to_frame()
    if isinstance(obj, dict):
        try:
            return pd.DataFrame(obj)
        except ValueError:
            return pd.DataFrame([obj])
    if isinstance(obj, (list, tuple)):
        return pd.DataFrame({"value": list(obj)})
    return pd.DataFrame({"value": [obj]})
