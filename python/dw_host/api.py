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


def _require_manager() -> Any:
    with _bind_lock:
        manager = _manager
    if manager is None:
        raise RuntimeError("DataManager is not bound")
    return manager


def publish_dataframe(name: str, obj: Any) -> str:
    """Publish a value into DataManager. Same display name overwrites in place."""
    return _require_manager().publish_dataframe(name, _as_frame(obj))


def get_dataframe(*, dataset_id: str | None = None, dataset_name: str | None = None) -> Any:
    """Return a copy of a DataManager frame. dataset_id wins when both are set."""
    ident = (dataset_id or "").strip()
    name = (dataset_name or "").strip()
    if not ident and not name:
        raise ValueError("dataset_id or dataset_name is required")
    manager = _require_manager()
    ds = manager.get(ident) if ident else manager.find_by_name(name)
    return ds.df.copy()


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
