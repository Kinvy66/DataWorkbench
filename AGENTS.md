# DataWorkbench 项目指南

AI 在本仓库改代码前**必须先读本文**，再读当前阶段对应的 [docs/dev_plan](docs/dev_plan/README.md)。本仓库不是 Qt 版 `data-workbench` 的翻译，不要把 C++/Qt/pybind11/Qwt/Agent 模式搬进来。

## OVERVIEW

桌面数据分析台：有向图工作流 + pandas GUI + 可导出图表。

| 项 | 值 |
|----|-----|
| 界面 | Electron + Vue 3 + TypeScript + Element Plus + `@mlightcad/ribbon` |
| 计算 | 独立 Python 3.11+ sidecar（pandas / numpy / pyarrow） |
| 工作流引擎 | 复用上游纯 Python `DAWorkFlowPy`，**禁止**在 TypeScript 重写 DAG 执行 |
| 进程 | Renderer（Vue）↔ Main（Electron）↔ Sidecar（JSON-RPC stdio） |
| 不做 | 应用层 C++、AI Agent / LLM / 工具调用、打开完整上游 `.dapro` |

**核心价值**（与上游产品意图对齐、实现分离）：

- 工作流驱动重复性实验数据
- GUI 封装 pandas 常用能力
- 图表可改样式并导出矢量图（一期属性面板，不是 Qwt 画布拖一切）

详细目标、非目标、性能合同：[docs/dev_plan/00-goals-and-constraints.md](docs/dev_plan/00-goals-and-constraints.md)。

## 当前阶段

以 [docs/dev_plan/05-roadmap.md](docs/dev_plan/05-roadmap.md) 为准。P0 骨架（窗口 + Ribbon + `host.hello`）已落地。执行顺序：

**P0 骨架（完成） → P1 数据（自动验收完成） → P2 工作流（画布路径完成） → P3 分析节点（进行中） → P4 图表 → P5 工程文件**

P2 任务 1–8 已落地。P3：已 vendor `dw_nodes_analysis/core`，工具箱含 Data Source（从 DataManager 取表）、Query、Drop NA、Fill NA、Sort、Describe 与 Data Export。Ribbon Data → 清洗 → 删除缺失 / 填充缺失 / 查询 / 排序，以及 Data → 分析 → 描述统计，与对应节点共用 Core（Describe 发布新表，不改源表）。Data Export 是工作流写盘节点（Core `export_data`）；功能区导出仍是 `data.export`。不要做图表、自由停靠或 Agent。表格单元格 undo 不与工作流栈合并。File 保存/打开仍属 P5。其余清洗节点仍属 P3 后续。

## STRUCTURE

目标目录（P0 起创建，以 [docs/dev_plan/03-repo-layout.md](docs/dev_plan/03-repo-layout.md) 为准）：

```
DataWorkbench/
├── apps/                  # 唯一前端：Electron main/preload + Vue renderer
│   ├── electron/
│   ├── resources/         # 窗口 ico（从上游 icon.ico 拷贝）
│   └── src/               # commands / layout / ribbon / views / stores / i18n / assets/icons
├── packages/
│   ├── rpc-types/         # 仅类型，无 Element Plus / Electron
│   └── chart-core/        # uPlot 封装；无 Pinia / ipcRenderer
├── python/
│   ├── dw_host/           # RPC 循环、DataManager，取代 da_app / da_data
│   ├── dw_workflow/       # vendor 自 DAWorkFlowPy
│   ├── dw_nodes_system/
│   ├── dw_nodes_analysis/
│   └── tests/
├── docs/dev_plan/         # 架构与排期（人读 / AI 读）
├── scripts/
├── AGENTS.md              # 本文
└── README.md
```

包管理：pnpm workspace + Python **uv**。

### 模块职责（放错目录 = 架构错误）

创建文件前必须回答：它属于哪一层？

| 位置 | 职责 | 禁止 |
|------|------|------|
| `apps/src` | Vue 视图、Pinia、命令总线、Ribbon schema | `child_process`、`fs`、跑 pandas |
| `apps/electron` | 窗口、对话框、spawn/看护 Python、ZIP、RPC 桥 | Vue、业务 DAG |
| `packages/rpc-types` | RPC 方法名与 payload 类型 | 运行时 UI 依赖 |
| `packages/chart-core` | 画布与导出（纯 TS） | 直接 IPC |
| `python/dw_host` | JSON-RPC、DataManager、Host API | 依赖前端 |
| `python/dw_workflow` | DAG / executor / serializer | `import da_app` |
| `python/dw_nodes_*` | `@NodeDef` 节点 | 在 TS 写 execute 逻辑 |

**依赖方向**：上层 UI 可以调 preload RPC；Python 不 import Electron；Main 不跑 pandas；Renderer 不直接 spawn Python。

## ARCHITECTURE

```
Vue Renderer  --invoke-->  Electron Main  --stdio JSON-RPC-->  Python sidecar
     |                         |                                      |
  视图状态                  看护 / ZIP                         DataFrame + DAWorkflow
```

- DataFrame **只存在 sidecar**。表格用 `data.fetchBlock`（默认 512 行）。禁止整表 JSON 进渲染进程。
- 工作流：**Python 模型先于视图**。加载时 `workflow.loadLogic` 后再按 `node_id` **wrap** 图形节点。禁止 load 路径再 `workflow.addNode`（会重复建点）。
- 节点坐标、分隔条、打开的 tab 只存在前端，写入工程 `ui-layout.json`。
- 图表点列走 `chart.buildSeries` 降采样，禁止对百万点 `JSON.parse` 进 Vue。

完整图与时序：[docs/dev_plan/01-architecture.md](docs/dev_plan/01-architecture.md)。协议：[docs/dev_plan/04-ipc-protocol.md](docs/dev_plan/04-ipc-protocol.md)。

## IRON RULES（铁律）

改代码前对照。多数对应上游已踩过的坑，换栈后仍然成立。

### T1. stdout = RPC 通道

Python sidecar 的 **stdout 只能打 JSON-RPC 行**。日志、traceback、`print` 走 **stderr** 或文件。污染 stdout 会导致主进程解析失败。Windows 读行后去掉 `\r`。

### T2. 无应用层 C++

不新增 Qt / pybind11 / Qwt / C++ 插件。CPython、Arrow 等可作为第三方二进制依赖，不是本仓库业务代码。

### T3. 不做 AI Agent

不实现 LLM 对话、LangGraph、工具 RPC、提示词库、权限门。工程 ZIP **没有** `agent_sessions/`。不要把上游 `src/DAAgent` 或 `agent_runner.py` 拷进来。

### T4. 不在 TypeScript 执行工作流

拓扑排序、`execute()`、参数反序列化只在 `dw_workflow`。前端只发 `workflow.execute` 并监听 `workflow.nodeState`。

### T5. Ribbon 不是业务层

`@mlightcad/ribbon` 只展示 tab/group/item。点击 → `commandBus.dispatch(id)`。不要把业务写进 ribbon schema 闭包。插件以后也注册到 command bus。

### T6. 改 RPC 三处同步

同一变更必须改：`packages/rpc-types`、Python pydantic 模型、`docs/dev_plan/04-ipc-protocol.md`。方法名 `域.动作`（如 `data.fetchBlock`）。

### T7. 渲染进程不碰磁盘与子进程

文件对话框、读写 ZIP、spawn Python 只在 **main**。preload 只暴露 `window.dw.rpc.invoke` / `on`。

### T8. i18n

界面英文源 + vue-i18n key，禁止源码硬编码中文 UI。Python 错误用英文 `message` + `i18nKey`，由前端翻译。`@NodeDef(name=...)` 与 `qualified_name` **不翻译**（参与序列化）。

sidecar 诊断日志保持英文。用户可见 `ElMessage` 必须 i18n。

### T9. 节点陷阱（执行仍在 Python）

移植 `@NodeDef` 时遵守上游 `plugins/DASystemNodes/AGENTS.md`：

- `__init__` 必须 `super().__init__()`
- 不要 `params.get("x", self.x.default)`
- `execute(self, inputs=None, params=None)`
- 输出写 `self._output_data[key]`，不要靠 return 当输出
- 禁止顶层 `import da_app`；改为 `dw_host.api`，并在 RPC 线程改 DataManager

带 `# dw:adapted` 的节点文件禁止被上游同步脚本无提示覆盖。

### T10. 工程加载顺序

1. 解压 `.dwproj`  
2. 恢复 DataManager（parquet）  
3. `workflow.loadLogic`  
4. 前端 wrap 画布 + 图表重新 `buildSeries`  

失败则视为未打开，禁止半开状态覆盖用户文件。格式见 [docs/dev_plan/11-project-file.md](docs/dev_plan/11-project-file.md)。扩展名 **`.dwproj`**，不要冒充 `.dapro`。

### T11. 做完就自测、提交并推送

远程仓库：[https://github.com/Kinvy66/DataWorkbench](https://github.com/Kinvy66/DataWorkbench.git)（`origin`）。

**粒度**：完成 **一个可验收功能**（如 `host.hello`、`data.fetchBlock`、虚表滚动）或 **一个路线图阶段**（P0–P5 退出标准满足）就必须交付，不要攒一大包再提交。

**顺序（强制，不可跳过）**：

1. 对照该功能 / 阶段的验收标准实现。  
2. **自测通过**（见下方矩阵）。失败则修到绿，禁止「先提交再测」。  
3. `git add` 仅相关文件；conventional commits，说明写中文、聚焦 why。  
4. `git push -u origin HEAD`（已跟踪分支则 `git push`）。  
5. 在回复里给出 commit hash 与远程链接。

禁止：`--no-verify`、force push 到 `master`/`main`、把未测代码和无关文件塞进同一提交。测试套件还不存在时（例如纯文档），在提交说明里写清「无自动测试 / 已做何种核对」。套件一旦存在，对应层测试必须实际跑过。

自测矩阵：

| 改动范围 | 提交前至少跑 |
|----------|----------------|
| `python/` | `py -3.12 -m pytest python/tests`（或 venv 内 pytest；Windows 可加 `--junitxml=python/pytest.xml` 再读文件） |
| `packages/` 或 renderer TS | `pnpm` workspace 内 vitest |
| RPC 协议 | 契约测试（stdio 或同进程 Host），两端各一正一反 |
| Electron 壳 / sidecar | `pnpm dev`：日志出现 `[window] show` 与 `host.ready` 后关闭窗口（或停掉 Electron 进程） |
| 仅文档 | 打开改过的 md、检查相对链接；不跑应用测试 |
| UI 可见行为 | 已有自动测试全绿；无 E2E 时按该阶段验收做一次手工/脚本冒烟，并在 commit body 写明结果 |

阶段结束另加：该阶段 [05-roadmap.md](docs/dev_plan/05-roadmap.md) 退出标准逐条勾过，再推送。

## WHERE TO LOOK

| 任务 | 位置 |
|------|------|
| 排期与验收 | `docs/dev_plan/05-roadmap.md` |
| 三进程与映射 | `docs/dev_plan/01-architecture.md` |
| 库选型 / 否决 | `docs/dev_plan/02-tech-stack.md` |
| RPC 方法表 | `docs/dev_plan/04-ipc-protocol.md` |
| vendor 上游哪些 py | `docs/dev_plan/06-python-reuse.md` |
| Ribbon / 布局 | `docs/dev_plan/07-ui-shell.md` |
| 虚表 / DataManager | `docs/dev_plan/08-data.md` |
| Vue Flow 同步规则 | `docs/dev_plan/09-workflow.md` |
| 图表一期范围 | `docs/dev_plan/10-chart.md` |
| 测试与日志 | `docs/dev_plan/12-quality.md` |
| 上游 Qt 参考（只读） | 环境变量 `DAWB_UPSTREAM`，默认本机 `F:/Rep/CAE_Code/data-workbench` |

上游必读（移植节点时）：`DAWorkFlowPy`、`plugins/DASystemNodes/AGENTS.md`。不要遵循上游「必须用 VS 生成器编译 C++」等与本栈无关的命令。

## CONVENTIONS

### 命名

- TS：目录 kebab-case，组件 PascalCase，Pinia `useXxxStore`（域：`data` / `workflow` / `chart` / `project` / `ui`）
- Vue：Composition API，禁止新代码 Options API
- Python：包 `dw_*`，模块 snake_case
- 命令 id：`file.save`、`workflow.run`，与 Ribbon item id 一致

### 前端

- 窗口无系统标题栏：`Menu.setApplicationMenu(null)`（非 macOS）+ `titleBarStyle: 'hidden'`；Windows/Linux 用 `titleBarOverlay` 画系统最小化/最大化/关闭。不要用网页按钮盖在 Win11 右上角（点不到）。不要把 Electron 默认 File/View/Window 菜单和 Ribbon 叠两层
- 默认界面语言 `zh-CN`（`DEFAULT_LOCALE`）；源字符串仍是英文 key
- 一期固定 IDE 布局（左列表 / 中 tab / 右属性 / 底日志），不要上 Golden Layout / dockview
- 虚表用虚拟滚动，禁止 `v-for` 整表 DOM
- 单元格编辑 debounce 后批量 `data.patchCells`，禁止一格一次 RPC
- 画布：用户操作先 RPC 成功再改 Vue Flow；拖动坐标除外（`nodeDragStop` 只写 store）

### Python

- 3.11/3.12，禁止 3.8
- pickle 导入默认关闭
- Host 变更在 RPC 事件循环线程执行（替代上游 `callInMainThread`）
- vendor 文件保留 LGPL 版权头

### 图表（P4 才做）

- 一期：line / scatter / bar / hist + 属性面板 + PNG/SVG
- 不做 3D、画布拖标注、与 Qwt `charts.xml` 互导
- 生产降采样以 Python `chart.buildSeries` 为准

## COMMANDS

代码落地前这些命令不存在；落地后按仓库根 `package.json` 为准。预期：

```bash
pnpm install
pnpm dev                 # main spawn sidecar；确认窗口起来后关闭，不要手动先起两套
pnpm --filter @dw/app test   # vitest

cd python
uv sync
uv run pytest
```

Windows 上 pytest 若看不到 stdout，输出到文件：`uv run pytest -o junit_xml=pytest.xml` 或 `--junitxml=...`。

同步上游纯 Python（白名单，见 06）：

```powershell
$env:DAWB_UPSTREAM = "F:\Rep\CAE_Code\data-workbench"
.\scripts\sync-python-from-upstream.ps1
```

**禁止**为本项目使用上游 `scripts/build.ps1` 或 CMake。

### Git

```bash
git remote -v    # origin → https://github.com/Kinvy66/DataWorkbench.git
git add ... && git commit && git push
```

提交信息格式（conventional commits，中文说明）：

```
feat: 实现 data.fetchBlock 虚表窗口

- 自测：uv run pytest python/tests/test_fetch_block.py
- 对应阶段：P1
```

类型常用 `feat` / `fix` / `docs` / `refactor` / `test` / `chore`。

## ANTI-PATTERNS

| 反模式 | 正确做法 |
|--------|----------|
| 在 renderer `spawn('python')` | 只在 electron main |
| 整表 `data.list` 带回所有 cell | `list` 只 meta；cell 走 `fetchBlock` |
| load 工程时 `addNode` | `loadLogic` + wrap |
| TS 里 `for` 跑节点 execute | `workflow.execute` |
| Ribbon `@click` 里写导入逻辑 | `commandBus.dispatch('data.import')` |
| sidecar `print` 到 stdout | stderr |
| UI 字符串写中文 | 英文源 + i18n |
| 翻译 `@NodeDef(name=)` | name 保持英文 |
| 拷贝 `da_app` / `DAAgent` | `dw_host.api`；Agent 不进仓库 |
| P0 引入 ECharts 当主折线 | 等到 P4 用 uPlot |
| 叠一层 Electron File/View/Window 菜单 | `setApplicationMenu(null)` + `titleBarStyle: 'hidden'`，Windows/Linux 用 `titleBarOverlay` |
| 把上游 C++ 工程 git submodule 进来 | 只同步白名单 `.py` |
| 功能做完不测就 commit / 不 push | T11：自测绿 → commit → push origin |
| 整阶段攒一周再交一次 | 按功能切片提交，阶段结束再补验收提交 |
| `--no-verify` / force push 主分支 | 修测试或走新 commit |

## 给 AI 的执行顺序

1. 读本文铁律（含 T11）。  
2. 读 `docs/dev_plan/README.md` 与 `05-roadmap.md` 当前阶段。  
3. 改协议先改 04 + rpc-types + pydantic。  
4. 移植节点先读 `06-python-reuse.md` 与上游 SystemNodes 陷阱。  
5. 阶段验收未过，不提前做下一阶段功能。  
6. 功能或阶段完成后：自测 → commit → push 到 `origin`。
