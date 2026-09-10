from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from dw_host.data_manager import DataManager
from dw_host.errors import ErrorCode, HostError

DEFAULT_MAX_POINTS = 5000

CHART_KINDS = ("line", "scatter", "bar", "hist")

CHART_TYPES = (
    {"id": "line", "name": "Line"},
    {"id": "scatter", "name": "Scatter"},
    {"id": "bar", "name": "Bar"},
    {"id": "hist", "name": "Histogram"},
)


class BuildSeriesParams(BaseModel):
    dataId: str
    x: str | None = None
    y: list[str] = Field(min_length=1)
    kind: str | None = None
    maxPoints: int = DEFAULT_MAX_POINTS
    bins: int | None = None
    xMin: float | None = None
    xMax: float | None = None

    @field_validator("y", mode="before")
    @classmethod
    def coerce_y(cls, value: object) -> object:
        if isinstance(value, str):
            return [value]
        return value

    @field_validator("kind", mode="before")
    @classmethod
    def coerce_kind(cls, value: object) -> object:
        if value in (None, ""):
            return None
        if not isinstance(value, str) or value not in CHART_KINDS:
            raise ValueError("kind must be line, scatter, bar, or hist")
        return value


def list_types() -> dict[str, Any]:
    return {"types": [dict(item) for item in CHART_TYPES]}


def dispatch(method: str, params: dict[str, Any], manager: DataManager, pandas_ok: bool) -> Any:
    if method == "chart.listTypes":
        return list_types()
    if method.startswith("chart.") and not pandas_ok:
        raise HostError(
            ErrorCode.FileIo,
            "pandas is not installed in the Python sidecar",
            "data.pandasRequired",
        )
    if method == "chart.buildSeries":
        from dw_host.chart_series import build_histogram, build_series

        parsed = BuildSeriesParams.model_validate(params)
        if parsed.kind == "hist":
            return build_histogram(
                manager,
                parsed.dataId,
                parsed.y,
                bins=parsed.bins,
                x_min=parsed.xMin,
                x_max=parsed.xMax,
            )
        if not parsed.x:
            raise HostError(ErrorCode.InvalidParams, "x is required", "rpc.invalidParams")
        return build_series(
            manager,
            parsed.dataId,
            parsed.x,
            parsed.y,
            max_points=parsed.maxPoints,
            x_min=parsed.xMin,
            x_max=parsed.xMax,
        )
    raise HostError(ErrorCode.MethodNotFound, f"Method not found: {method}")
