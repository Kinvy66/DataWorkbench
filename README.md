# DataWorkbench

Electron + Vue 3 + Python 的桌面数据分析工作台：用有向图把重复清洗固定成工作流，用 GUI 操作 pandas，用可导出的图表出论文插图。

计算与模型在 **Python sidecar**，界面在 **Electron / Vue**。应用层不写 C++，**不做 AI Agent**。

仓库：[Kinvy66/DataWorkbench](https://github.com/Kinvy66/DataWorkbench) · [开发计划](docs/dev_plan/README.md) · [给 AI 的仓库约定](AGENTS.md)

<p>
<img src="https://img.shields.io/badge/Electron-33+-47848F" alt="Electron"/>
<img src="https://img.shields.io/badge/Vue-3-42b883" alt="Vue 3"/>
<img src="https://img.shields.io/badge/Python-3.11+-3776AB" alt="Python"/>
<img src="https://img.shields.io/badge/pandas-supported-150458" alt="pandas"/>
<img src="https://img.shields.io/badge/AI%20Agent-not%20in%20scope-lightgrey" alt="No Agent"/>
</p>

## 它解决什么问题

科研与工程里同一套清洗往往要对 n 组数据重复做。Python 能做，但要熟 pandas；MATLAB / matplotlib 能出图，但改一个标签位置就要改坐标重跑。本软件把三件事收进同一个桌面程序：

1. **工作流**：节点拖连、一键重跑（引擎复用上游 `DAWorkFlowPy`）。
2. **数据**：导入表格、虚表浏览与编辑，常用清洗用对话框和节点，不必翻文档。
3. **图表**：折线 / 散点 / 柱状 / 直方，属性面板改样式，导出 PNG / SVG。

## 和 DAWorkBench（Qt 版）的关系

能力对标开源项目 [data-workbench](https://github.com/czyt1988/data-workbench)（C++17 / Qt / Qwt / 内嵌 Python / LangGraph Agent）。本仓库是 **另一套实现**：

| | 上游 DAWorkBench | 本仓库 DataWorkbench |
|--|------------------|----------------------|
| 界面 | Qt + SARibbon + ADS | Electron + Vue 3 + ML Ribbon + Element Plus |
| 工作流视图 | QGraphicsView | Vue Flow |
| 图表 | Qwt | uPlot + 属性面板 |
| Python | 同进程 pybind11 | 独立 sidecar，JSON-RPC |
| AI Agent | 内置 | **不做** |
| 工程文件 | `.dapro` | `.dwproj`（不承诺打开旧工程） |

不是把 Qt 代码翻译成 TypeScript。DataFrame 与 DAG 留在 Python，前端只持有视图（当前表窗口、节点坐标、降采样后的点）。

一期性能合同是「科研常用规模」（例如 50 万行虚表、百万点折线降采样），**不对齐**上游宣传的亿级曲线 / 亿行表 / 画布上拖标注。

## 技术栈

- **壳**：Electron（electron-vite）、Vue 3、TypeScript、Pinia、Element Plus、[@mlightcad/ribbon](https://github.com/mlightcad/ribbon)
- **工作流画布**：@vue-flow/core
- **表 / 图**：TanStack Vue Virtual（虚表）、uPlot
- **计算**：Python 3.11+、pandas、numpy、pyarrow
- **进程间**：JSON-RPC 2.0（stdio 按行）；块数据可走 Arrow

选型、否决项与包边界见 [docs/dev_plan/02-tech-stack.md](docs/dev_plan/02-tech-stack.md)。

## 当前状态

**P0 完成，P1 自动验收完成，P2 画布路径完成，P3 已接入 Data Source、Query、Drop NA 与 Sort**：`pnpm install` 后 `pnpm dev` 可打开窗口。Home → Ping；Data → Import / Export / 删除缺失 / 查询 / 排序。虚表块走 Arrow IPC。左侧「节点」可拖 Constant / Data Source / Query / Drop NA / Sort / Output to DataManager。导入表后，Data Source（填显示名）→ Query、Drop NA 或 Sort → Output to DataManager → 运行，数据列表会出现结果。Delay 执行中可 Stop；Home 撤销/重做可回退画布编辑。File 保存/打开尚未做。

阶段验收见 [docs/dev_plan/05-roadmap.md](docs/dev_plan/05-roadmap.md)。

## 开发环境（P0 起）

| 依赖 | 版本 |
|------|------|
| Node.js | 20 LTS 或以上 |
| pnpm | 9+ |
| Python | 3.11 或 3.12（不要 3.8） |
| uv | 推荐，用于 `python/` 依赖 |

Windows 为主要开发平台；Linux 作为后续验证，不阻塞 P0。

### 仓库就绪后的预期命令

```bash
pnpm install
py -3.12 -m pip install -r python/requirements.txt
pnpm test
pnpm dev
```

Python sidecar 由 Electron 主进程拉起，不要单独在渲染进程 `spawn`。开发态优先使用 `python/.venv`，否则 Windows 上用 `py -3.12`。

若 `pnpm dev` 报 `spawn ...\electron\dist\electron.exe ENOENT`：二进制没下下来（常见于 `checksums.json` 缺失或 GitHub 发布页超时）。仓库 `.npmrc` 已设 `electron_use_remote_checksums` 与 npmmirror。补救：

```powershell
$env:electron_use_remote_checksums = "1"
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
node node_modules/electron/install.js
```

仍失败时从 `https://cdn.npmmirror.com/binaries/electron/v33.4.11/electron-v33.4.11-win32-x64.zip` 下载 zip，解压进 `node_modules/electron/dist/`，直到 `electron.exe --version` 打出 `v33.4.11`。


上游 Qt 仓库若在本机，可设 `DAWB_UPSTREAM` 指向该路径，按 [docs/dev_plan/06-python-reuse.md](docs/dev_plan/06-python-reuse.md) 同步纯 Python 引擎（不要 submodule 整个 C++ 工程）。

## 文档

| 文档 | 读者 |
|------|------|
| [docs/dev_plan/README.md](docs/dev_plan/README.md) | 架构与排期 |
| [AGENTS.md](AGENTS.md) | 在本仓库改代码的人 / AI |
| [docs/dev_plan/00-goals-and-constraints.md](docs/dev_plan/00-goals-and-constraints.md) | 做什么、不做什么、验收红线 |
| [docs/dev_plan/04-ipc-protocol.md](docs/dev_plan/04-ipc-protocol.md) | 主进程 ↔ Python 协议 |

## 许可

应用程序为 [MIT](LICENSE)。从上游拷贝的图标与 `python/dw_workflow` 见 [NOTICE](NOTICE)（LGPL-3.0）。

## 贡献

实现与重构前先读 [AGENTS.md](AGENTS.md)。改 RPC 必须同一变更里更新 TypeScript 类型、Python pydantic 模型与 `docs/dev_plan/04-ipc-protocol.md`。

远程：`https://github.com/Kinvy66/DataWorkbench.git`。完成**一个功能**或**一个开发阶段**后必须：先按 [AGENTS.md T11](AGENTS.md) **自测通过**，再 commit，并 **push** 到 `origin`。不要攒多周改动一次提交；测试失败禁止推送。
