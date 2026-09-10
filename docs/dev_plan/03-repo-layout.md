# 仓库目录

pnpm workspace：`apps` 是**唯一应用包**（`@dw/app`），`packages/*` 是共享库。本仓库不做 web/mobile 第二入口，因此不设 `apps/desktop` 这一层。

## 目标树

```text
DataWorkbench/
├── apps/                        # 唯一前端包 @dw/app（Electron + Vue）
│   ├── electron/                # main + preload
│   ├── resources/               # 窗口 icon.ico（上游拷贝）
│   ├── src/                     # renderer Vue
│   │   ├── assets/icons/        # 上游 SVG：app/ + gui/
│   │   ├── commands/            # 命令总线
│   │   ├── layout/              # 一期固定分区
│   │   ├── ribbon/              # ML Ribbon schema
│   │   ├── views/
│   │   │   ├── data/
│   │   │   ├── workflow/
│   │   │   └── chart/
│   │   ├── stores/
│   │   └── i18n/
│   └── package.json
├── packages/
│   ├── rpc-types/               # TS 与 Python 共用的 RPC 方法名/payload 类型
│   └── chart-core/              # uPlot 封装、降采样、导出（纯 TS，无 Electron）
├── python/
│   ├── dw_host/                 # RPC 循环、DataManager、取代 da_app
│   ├── dw_workflow/             # vendor 自 DAWorkFlowPy，包名可保留内部 API
│   ├── dw_nodes_system/         # 从 DASystemNodes 移植
│   ├── dw_nodes_analysis/       # 从 DADataAnalysisNodes + Core 移植
│   ├── pyproject.toml
│   └── tests/
├── docs/
│   └── dev_plan/                # 本计划
├── scripts/                     # 上游同步、便携打包（pack-portable.ps1）、P1 烟测 csv
├── pnpm-workspace.yaml
├── package.json
├── AGENTS.md                    # 给后续 AI 的仓库约定（P0 补写，不在本期计划范围内强制）
└── README.md
```

## 包边界

| 包 | 允许依赖 | 禁止 |
|----|----------|------|
| `packages/rpc-types` | 无运行时依赖（types only） | Element Plus、Electron |
| `packages/chart-core` | uPlot | Pinia、ipcRenderer |
| `apps/src` renderer | 上述 packages、Vue、Element Plus、Ribbon、Vue Flow | `child_process`、`fs`（一律 preload API） |
| `apps/electron` main | Electron、spawn | Vue、pandas |
| `python/dw_host` | dw_workflow、pandas、pyarrow | 任何 frontend |

## 命名

- TS：文件夹 kebab-case，组件 PascalCase，Pinia `useXxxStore`。
- Python：包 `dw_*`，模块 snake_case。节点 `@NodeDef(name=...)` **保持英文且不翻译**（与上游序列化约定一致）。
- RPC 方法：`域.动作`，如 `data.fetchBlock`、`workflow.execute`。

## 上游对照拷贝（只读参考，不进 git submodule 强制）

开发机可设置环境变量 `DAWB_UPSTREAM=F:/Rep/CAE_Code/data-workbench`，`scripts/sync-python-from-upstream.ps1` 按 [06-python-reuse.md](./06-python-reuse.md) 白名单拷贝。拷贝后必须能跑 `python -m pytest python/tests`。不要 submodule 整个 C++ 仓库。
