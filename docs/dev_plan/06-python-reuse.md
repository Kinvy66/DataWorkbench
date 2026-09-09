# 上游 Python 复用清单

上游仓库：`F:/Rep/CAE_Code/data-workbench`。原则：**只 vendor 不依赖 `da_*` 扩展模块的纯 Python**；凡 `import da_app` / `da_data` / `da_interface` 的，改为 `dw_host` 适配层。

版权：上游 LGPL。拷贝文件保留原文件头，根目录 `NOTICE` 列出路径。不要把 C++、qrc、ts 翻译文件整棵拷进来。

## 直接 vendor（改包名即可）

| 上游路径 | 目标 | 改动 |
|----------|------|------|
| `src/PyScripts/DAWorkbench/DAWorkFlowPy/*.py` | `python/dw_workflow/` | 包 import 路径；**不要改** serializer 字段名 |
| `src/PyScripts/DAWorkbench/DAWorkFlowPy/nodes/style_demo_nodes.py` | 可选，仅开发 | 可不上生产 |
| `plugins/DataAnalysis/PyScripts/DADataAnalysisCore/` | `python/dw_nodes_analysis/core/` | 保持纯函数、无 i18n |

`DAWorkFlowPy` 声明可脱离 C++ 运行（架构 P1）。P2 引擎与 sidecar RPC 已落地：`python/dw_workflow` vendor 自上游 `9dd298fe`，`python/dw_nodes_system` 含 Start/End/Constant/Delay；`workflow.*` 经 stdio 可 create/addNode/connect/`dumpLogic`/`loadLogic`/`execute`。尚未做 DataToManager 与 Vue Flow。

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
| `nodes/delay.py` | 必做 | 验证 stop |
| `nodes/data_to_manager.py` | 必做 | 改 API |
| `nodes/condition_if.py` | P2 末期 | 菱形样式可用 CSS |
| `nodes/text_viewer.py` | 延期 | 依赖 paint |

图标 SVG：可拷贝 `icon/`，注意上游图标规范（200×200）。Vue 工具箱用同一份 SVG。窗口 / Ribbon 按钮已拷到 `apps/src/assets/icons/`，用法见 [07-ui-shell.md](./07-ui-shell.md)。

## 节点文件白名单（Analysis）

`plugins/DataAnalysis/PyScripts/DADataAnalysisNodes/` 下 `*_node.py` 共 21 个。按 [05-roadmap.md](./05-roadmap.md) P3 批次移植。每个文件：

1. 保留 `@NodeDef(name=...)` 英文名（序列化稳定）。
2. `_()` 可先做成恒等函数，P3 再接 gettext。
3. `execute` 签名保持 `(self, inputs=None, params=None)`。
4. 输出仍写 `self._output_data[...]`。
5. 删除任何 `da_app` 导入。

`data_plot_node.py`：**不移植到工作流出图**；注释标明由前端 Chart 模块替代。

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
