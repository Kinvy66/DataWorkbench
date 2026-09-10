# 上游 Python 复用清单

上游仓库：`F:/Rep/CAE_Code/data-workbench`。原则：**只 vendor 不依赖 `da_*` 扩展模块的纯 Python**；凡 `import da_app` / `da_data` / `da_interface` 的，改为 `dw_host` 适配层。

版权：上游 LGPL。拷贝文件保留原文件头，根目录 `NOTICE` 列出路径。不要把 C++、qrc、ts 翻译文件整棵拷进来。

## 直接 vendor（改包名即可）

| 上游路径 | 目标 | 改动 |
|----------|------|------|
| `src/PyScripts/DAWorkbench/DAWorkFlowPy/*.py` | `python/dw_workflow/` | 包 import 路径；**不要改** serializer 字段名 |
| `src/PyScripts/DAWorkbench/DAWorkFlowPy/nodes/style_demo_nodes.py` | 可选，仅开发 | 可不上生产 |
| `plugins/DataAnalysis/PyScripts/DADataAnalysisCore/` | `python/dw_nodes_analysis/core/` | 保持纯函数、无 i18n。`io.py` 已改为 charset-normalizer（`# dw:adapted`），不要无提示覆盖 |

`DAWorkFlowPy` 声明可脱离 C++ 运行（架构 P1）。P2 引擎、sidecar RPC、DataToManager、dump/load wrap、Delay Stop 与工作流 undo 已落地。P3 已 vendor `dw_nodes_analysis/core`（`9dd298fe`），并接入 **Data Source**（从 DataManager 按名/id 取 df，不是上游读文件节点）、**Query**（`query_dataframe`，Ribbon 走 `data.query`）、**Drop NA**（`dropna_impl`，只删行；Ribbon 走 `data.dropNa`）、**Drop Duplicates**（`drop_duplicates_impl`；Ribbon 走 `data.dropDuplicates`）、**Fill NA**（`fillna_impl`，Ribbon 走 `data.fillNa`）、**Replace Values**（`replace_values_impl`；RPC 走 `data.replaceValues`，**不上 Ribbon**）、**Threshold Filter**（`threshold_filter_impl`；RPC 走 `data.thresholdFilter`，**不上 Ribbon**；直接暴露 Core `filter_type`，不要抄上游 `>`/`>=` 映射）、**Filter by Column**（`filter_by_column_range`；Ribbon 走 `data.filterByColumn`；保留闭区间，空 min/max=无界，**不要把 0 当不限制**）、**Eval**（`eval_expression`；Ribbon 走 `data.eval`；必须赋值，无赋值返回 Series 会被拒绝）、**Search**（`search_dataframe`；Ribbon 走 `data.search`；正则筛行，不要做成 Qt 查找下一个）、**Sort**（`sort_dataframe`，Ribbon 走 `data.sort`）、**Describe**（`describe_dataframe`，Ribbon 走 `data.describe` 发布新统计表，不改源表）与 **Data Export**（`export_data` 写连入的 DataFrame；Ribbon `data.export` 仍写当前 DataManager 表）。尚未做 If/Else、TextViewer、其余清洗节点。**Ribbon**：Data 标签只放数据进出；清洗/过滤/统计在 Operate。Replace Values / Threshold Filter 仅节点 + RPC，不要再塞进 Data。后续只把上游 Cleaning/Filtering/Statistics panel 已有的按钮（插值、IQR、Z-score、偏态转换、透视表）加到 Operate 对应分组。

## 移植并改 Host（必须改）

| 上游 | 问题 | 改法 |
|------|------|------|
| `plugins/DASystemNodes/.../data_to_manager.py` | `import da_app, da_data` + `callInMainThread` | `from dw_host.api import publish_dataframe`；在 RPC 线程执行 |
| `plugins/DASystemNodes/.../text_viewer.py` | `paint()` + QPainter 代理 | 一期可用节点状态文本在 Vue 节点体内显示；`paint` 钩子二期再做 Canvas |
| `src/PyScripts/DAWorkbench/DAPyBase/io.py` | 整文件绑 C++ DataManager | 重写为 `dw_host.io.import_path` |
| `src/PyScripts/DAWorkbench/DAPyBase/app_wrapper.py` | `da_app.getCore()` | 删除或做成 `dw_host.api` 的薄包装以减少节点改动面 |

建议适配层提供**与旧名相近**的门面，降低节点 diff：

```python
# python/dw_host/compat.py
def get_data_manager():
    return current_session().data_manager
```

不要伪造整个 `da_app` 模块名（以免和将来真的上游插件混淆）。节点里明确 `import dw_host.api`。

## 节点文件白名单（System）

从 `plugins/DASystemNodes/PyScripts/DASystemNodes/` 拷贝：

| 文件 | P2 | 备注 |
|------|----|------|
| `nodes/start.py` | 必做 | |
| `nodes/end.py` | 必做 | |
| `nodes/constant.py` | 必做 | `ast.literal_eval` |
| `nodes/delay.py` | 必做 | 验证 stop（`Event.wait` + 会话 cancel，禁止阻塞 `sleep`） |
| `nodes/data_to_manager.py` | 必做 | 改 API |
| `nodes/condition_if.py` | P2 末期 | 菱形样式可用 CSS |
| `nodes/text_viewer.py` | 延期 | 依赖 paint |

P2 必做五项已落地。If/Else、TextViewer 仍可延后。

图标 SVG：可拷贝 `icon/`，注意上游图标规范（200×200）。Vue 工具箱用同一份 SVG。窗口 / Ribbon 按钮已拷到 `apps/src/assets/icons/`，用法见 [07-ui-shell.md](./07-ui-shell.md)。

## 节点文件白名单（Analysis）

`plugins/DataAnalysis/PyScripts/DADataAnalysisNodes/` 下 `*_node.py` 共 21 个。按 [05-roadmap.md](./05-roadmap.md) P3 批次移植。每个文件：

1. 保留 `@NodeDef(name=...)` 英文名（序列化稳定）。
2. `_()` 可先做成恒等函数，P3 再接 gettext。
3. `execute` 签名保持 `(self, inputs=None, params=None)`。
4. 输出仍写 `self._output_data[...]`。
5. 删除任何 `da_app` 导入。

`data_plot_node.py`：**不移植到工作流出图**；注释标明由前端 Chart 模块替代。

**Data Source**：不要移植上游读文件的 `data_source_node.py`。本产品入口是 DataManager 已导入的表（`dataset_name` / `dataset_id`）；读文件继续走 `data.import`。Query 节点包装 `core.operations.query_dataframe`。Drop NA 节点包装 `core.cleaning.dropna_impl`（只删行，不移植上游 `axis=1` 绕过 Core 的删列路径）。Drop Duplicates 节点包装 `core.cleaning.drop_duplicates_impl`（`keep` 为 `first`/`last`/`none`，`false` 视为 `none`）。Fill NA 节点包装 `core.cleaning.fillna_impl`（方法名用 Core：`value`/`forward`/`backward`/`mean`/`median`/`mode`，并接受上游 `constant`/`ffill`/`bfill` 别名）。Replace Values 节点包装 `core.cleaning.replace_values_impl`（`old_values` 逗号分隔；`subset` 空=全部列；`case_sensitive` 默认 true）。Threshold Filter 节点包装 `core.cleaning.threshold_filter_impl`（直接暴露 Core `filter_type`：`greater_than` 用 `upper` 删 `>`；`less_than` 用 `lower` 删 `<`；`in_range`/`out_of_range` 用上下限。`subset` 空=全部数值列。不要抄上游把 `>`/`>=`/`<`/`<=` 映射到 Core 的错误做法）。Filter by Column 节点包装 `core.operations.filter_by_column_range`（**保留** `min <= col <= max`；`None`=该侧不限制。不要抄上游节点把 `0.0` 当成无界）。Eval 节点包装 `core.operations.eval_expression`（必须赋值如 `c = a + b`；无赋值 pandas 返回 Series，节点与 Operate 对话框都拒绝，不要把 Series 当成一列表覆盖当前数据集）。Search 节点包装 `core.operations.search_dataframe`（指定列 `str.contains` 正则；默认不区分大小写。不要抄上游 Qt「查找下一个」高亮对话框）。Sort 节点包装 `core.operations.sort_dataframe`（所有列同一 `ascending`，与 Core 签名一致）。Describe 节点包装 `core.operations.describe_dataframe`（默认数值列；`percentiles` 逗号分隔；输出把统计名展平为 `stat` 列，虚表才能看见 count/mean）。Data Export 节点包装 `core.io.export_data`（csv/json/excel/parquet；`xlsx`→`excel`；**拒绝 pickle**）。Ribbon 导出仍是 `data.export`（主进程选路径，sidecar `_write_frame`，CSV 为 utf-8-sig）；节点写的是工作流连入的 df，不是当前选中的 DataManager 表。

## 不要 vendor

- `src/DAPyBindQt/` 及一切 pybind 模块
- Agent：`src/PyScripts/DAWorkbench/agent/`
- `DAPyBase` 里依赖 C++ 的 GUI 脚本（`dataframe_cleaner` 若在 DataAnalysisGui：可后期把对话框逻辑改成 FastAPI 式函数给 RPC，而不是搬 Qt 对话框）
- C++ `DataAnalysis` Ribbon Worker：改成前端对话框 + RPC 调 Core

## `setup_i18n` 与 `_`

上游节点包要求 `__init__.py` 顶部 `setup_i18n()`。一期：

```python
def _(s: str) -> str:
    return s
```

把 `_` 注入 builtins 或包命名空间，保证装饰器不炸。真正翻译放到 [12-quality.md](./12-quality.md)。

## 同步脚本约定

`scripts/sync-python-from-upstream.ps1`：

- 只覆盖 `dw_workflow` 与 `core` 算法；**节点适配后的文件不要被脚本无提示覆盖**。
- 用文件头标记 `# dw:adapted` 跳过覆盖。
- 每次同步在 PR/提交说明写上游 git commit hash。

## 验证命令（P2 起）

```bash
cd python
uv run pytest tests/test_workflow_roundtrip.py tests/test_constant_execute.py
```

`test_workflow_roundtrip.py`：build 两节点一连接 → `to_dict` → 新 factory `from_dict` → 连接数与参数一致。
