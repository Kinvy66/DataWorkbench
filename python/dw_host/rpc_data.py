from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from dw_host.arrow_block import maybe_arrow
from dw_host.data_manager import BLOCK_DEFAULT, DataManager
from dw_host.errors import ErrorCode, HostError


class DataImportParams(BaseModel):
    path: str
    format: str | None = None


class ColumnSchema(BaseModel):
    name: str
    dtype: str


class DatasetListItem(BaseModel):
    id: str
    name: str
    rows: int
    cols: int


class DataIdParams(BaseModel):
    id: str


class FetchBlockParams(BaseModel):
    id: str
    startRow: int = 0
    rowCount: int = BLOCK_DEFAULT


class CellPatch(BaseModel):
    row: int
    col: int
    value: Any = None


class PatchCellsParams(BaseModel):
    id: str
    patches: list[CellPatch] = Field(default_factory=list)


class RenameParams(BaseModel):
    id: str
    name: str


class ExportParams(BaseModel):
    id: str
    path: str
    format: str | None = None


class RegisterParams(BaseModel):
    name: str
    handle: Any | None = None


class DropNaParams(BaseModel):
    id: str
    how: str = "any"
    subset: list[str] | str | None = None
    minNonNa: int = 0


class DropDuplicatesParams(BaseModel):
    id: str
    keep: str | bool = "first"
    subset: list[str] | str | None = None


class QueryParams(BaseModel):
    id: str
    queryString: str


class EvalParams(BaseModel):
    id: str
    expression: str


class SearchParams(BaseModel):
    id: str
    column: str
    pattern: str
    caseSensitive: bool = False


class SortParams(BaseModel):
    id: str
    columns: list[str] | str
    ascending: bool = True


class FillNaParams(BaseModel):
    id: str
    method: str = "value"
    subset: list[str] | str | None = None
    value: Any = 0.0


class InterpolateParams(BaseModel):
    id: str
    method: str = "linear"
    subset: list[str] | str | None = None
    limit: int | None = None
    order: int = 3


class RemoveOutliersIqrParams(BaseModel):
    id: str
    multiplier: float = 1.5
    action: str = "remove"
    customValue: float = 0.0
    reindex: bool = True
    subset: list[str] | str | None = None


class RemoveOutliersZscoreParams(BaseModel):
    id: str
    threshold: float = 3.0
    robust: bool = False
    action: str = "remove"
    customValue: float = 0.0
    reindex: bool = True
    subset: list[str] | str | None = None


class TransformSkewedParams(BaseModel):
    id: str
    method: str = "log"
    lambdaValue: float = 0.5
    addOne: bool = True
    subset: list[str] | str | None = None


class ReplaceValuesParams(BaseModel):
    id: str
    oldValues: list[Any] | str | None = None
    newValue: Any = ""
    subset: list[str] | str | None = None
    caseSensitive: bool = True


class ThresholdFilterParams(BaseModel):
    id: str
    filterType: str = "greater_than"
    lower: float = 0.0
    upper: float = 100.0
    subset: list[str] | str | None = None
    rowLogic: str = "any"
    treatNan: bool = False


class FilterByColumnParams(BaseModel):
    id: str
    column: str
    min: Any = None
    max: Any = None


class DescribeParams(BaseModel):
    id: str
    percentiles: list[float] | str | None = "0.25,0.5,0.75"
    name: str | None = None


class PivotTableParams(BaseModel):
    id: str
    index: list[str] | str | None = None
    columns: list[str] | str | None = None
    values: list[str] | str | None = None
    aggfunc: str = "mean"
    margins: object = False
    marginsName: str = "All"
    sort: object = False
    name: str | None = None


def _subset_list(raw: list[str] | str | None) -> list[str] | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        items = [part.strip() for part in raw.split(",") if part.strip()]
        return items or None
    items = [str(part).strip() for part in raw if str(part).strip()]
    return items or None


def dispatch(method: str, params: dict[str, Any], manager: DataManager, pandas_ok: bool) -> Any:
    if method.startswith("data.") and method != "data.list" and not pandas_ok:
        raise HostError(
            ErrorCode.FileIo,
            "pandas is not installed in the Python sidecar",
            "data.pandasRequired",
        )
    if method == "data.import":
        parsed = DataImportParams.model_validate(params)
        return manager.import_path(parsed.path, parsed.format)
    if method == "data.list":
        return {"datasets": manager.list_datasets()}
    if method == "data.getSchema":
        parsed = DataIdParams.model_validate(params)
        return manager.get_schema(parsed.id)
    if method == "data.fetchBlock":
        parsed = FetchBlockParams.model_validate(params)
        return maybe_arrow(manager.fetch_block(parsed.id, parsed.startRow, parsed.rowCount))
    if method == "data.patchCells":
        parsed = PatchCellsParams.model_validate(params)
        manager.patch_cells(parsed.id, [p.model_dump() for p in parsed.patches])
        return {"ok": True}
    if method == "data.rename":
        parsed = RenameParams.model_validate(params)
        manager.rename(parsed.id, parsed.name)
        return {"ok": True}
    if method == "data.remove":
        parsed = DataIdParams.model_validate(params)
        manager.remove(parsed.id)
        return {"ok": True}
    if method == "data.export":
        parsed = ExportParams.model_validate(params)
        manager.export_path(parsed.id, parsed.path, parsed.format)
        return {"ok": True}
    if method == "data.register":
        parsed = RegisterParams.model_validate(params)
        import pandas as pd

        dataset_id = manager.publish_dataframe(parsed.name, pd.DataFrame())
        return {"id": dataset_id}
    if method == "data.dropNa":
        parsed = DropNaParams.model_validate(params)
        return manager.dropna(
            parsed.id,
            how=parsed.how,
            subset=_subset_list(parsed.subset),
            min_non_na=parsed.minNonNa,
        )
    if method == "data.dropDuplicates":
        parsed = DropDuplicatesParams.model_validate(params)
        return manager.drop_duplicates(
            parsed.id,
            keep=parsed.keep,
            subset=_subset_list(parsed.subset),
        )
    if method == "data.query":
        parsed = QueryParams.model_validate(params)
        return manager.query(parsed.id, parsed.queryString)
    if method == "data.eval":
        parsed = EvalParams.model_validate(params)
        return manager.evaluate(parsed.id, parsed.expression)
    if method == "data.search":
        parsed = SearchParams.model_validate(params)
        return manager.search(
            parsed.id,
            column=parsed.column,
            pattern=parsed.pattern,
            case_sensitive=parsed.caseSensitive,
        )
    if method == "data.sort":
        parsed = SortParams.model_validate(params)
        return manager.sort(
            parsed.id,
            columns=_subset_list(parsed.columns) or [],
            ascending=parsed.ascending,
        )
    if method == "data.fillNa":
        parsed = FillNaParams.model_validate(params)
        return manager.fillna(
            parsed.id,
            method=parsed.method,
            subset=_subset_list(parsed.subset),
            value=parsed.value,
        )
    if method == "data.interpolate":
        parsed = InterpolateParams.model_validate(params)
        return manager.interpolate(
            parsed.id,
            method=parsed.method,
            subset=_subset_list(parsed.subset),
            limit=parsed.limit,
            order=parsed.order,
        )
    if method == "data.removeOutliersIqr":
        parsed = RemoveOutliersIqrParams.model_validate(params)
        return manager.remove_outliers_iqr(
            parsed.id,
            multiplier=parsed.multiplier,
            action=parsed.action,
            custom_value=parsed.customValue,
            reindex=parsed.reindex,
            subset=_subset_list(parsed.subset),
        )
    if method == "data.removeOutliersZscore":
        parsed = RemoveOutliersZscoreParams.model_validate(params)
        return manager.remove_outliers_zscore(
            parsed.id,
            threshold=parsed.threshold,
            robust=parsed.robust,
            action=parsed.action,
            custom_value=parsed.customValue,
            reindex=parsed.reindex,
            subset=_subset_list(parsed.subset),
        )
    if method == "data.transformSkewed":
        parsed = TransformSkewedParams.model_validate(params)
        return manager.transform_skewed(
            parsed.id,
            method=parsed.method,
            lambda_value=parsed.lambdaValue,
            add_one=parsed.addOne,
            subset=_subset_list(parsed.subset),
        )
    if method == "data.replaceValues":
        parsed = ReplaceValuesParams.model_validate(params)
        return manager.replace_values(
            parsed.id,
            old_values=parsed.oldValues,
            new_value=parsed.newValue,
            subset=_subset_list(parsed.subset),
            case_sensitive=parsed.caseSensitive,
        )
    if method == "data.thresholdFilter":
        parsed = ThresholdFilterParams.model_validate(params)
        return manager.threshold_filter(
            parsed.id,
            filter_type=parsed.filterType,
            lower=parsed.lower,
            upper=parsed.upper,
            subset=_subset_list(parsed.subset),
            row_logic=parsed.rowLogic,
            treat_nan=parsed.treatNan,
        )
    if method == "data.filterByColumn":
        parsed = FilterByColumnParams.model_validate(params)
        return manager.filter_by_column(
            parsed.id,
            column=parsed.column,
            min_val=parsed.min,
            max_val=parsed.max,
        )
    if method == "data.describe":
        parsed = DescribeParams.model_validate(params)
        return manager.describe(parsed.id, percentiles=parsed.percentiles, name=parsed.name)
    if method == "data.pivotTable":
        parsed = PivotTableParams.model_validate(params)
        return manager.pivot_table(
            parsed.id,
            index=_subset_list(parsed.index),
            columns=_subset_list(parsed.columns),
            values=_subset_list(parsed.values),
            aggfunc=parsed.aggfunc,
            margins=parsed.margins,
            margins_name=parsed.marginsName,
            sort=parsed.sort,
            name=parsed.name,
        )
    raise HostError(ErrorCode.MethodNotFound, f"Method not found: {method}")
