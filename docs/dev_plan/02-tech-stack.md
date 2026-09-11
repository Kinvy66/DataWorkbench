# 技术栈与选型

本节锁定一期依赖。未列入的库默认禁止引入，避免 Electron 体积与许可风险无序膨胀。

## 基线版本

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面壳 | Electron 33+（或 electron-vite 当时的稳定 LTS） | 只走 `electron-vite` 脚手架，不手写两套 webpack |
| UI | Vue 3.5 + TypeScript 5.x + Vite | Composition API，禁止 Options API 新代码 |
| 状态 | Pinia | 按域拆 store：`data` / `workflow` / `chart` / `project` / `ui` |
| 组件库 | Element Plus | ML Ribbon 的底层 primitives |
| Ribbon | `@mlightcad/ribbon` | 只做展示与 key tips；命令不写在 ribbon schema 的闭包里 |
| 节点图 | `@vue-flow/core` + `@vue-flow/background` + `@vue-flow/controls` | Vue 原生，自定义多端口节点 |
| 表格 | AG Grid Community（infinite row model） | 见下方表格决策；禁止 `ag-grid-enterprise` |
| 图表 | uPlot（主） | 大数据折线；导出走 SVG 序列化或离屏 canvas |
| Python | 3.11 或 3.12 | 与上游推荐 3.11 对齐；禁止 3.8 |
| 科学计算 | pandas / numpy / pyarrow / openpyxl | parquet 走 pyarrow |
| 打包 Python | 开发态用仓库 venv。安装包 / 便携目录嵌入 Windows CPython 3.12（`scripts/prepare-python-runtime.ps1`）+ 运行时 wheels；`DW_PYTHON` 可覆盖。不使用 PyInstaller |

## 表格：AG Grid Community + 窗口化 DataFrame

一期先用自绘网格把 `data.fetchBlock` 窗口跑通；二期换成 **AG Grid Community**（MIT）的 infinite row model，交互更接近 Excel（列宽拖拽、单元格编辑），数据合同不变：

- DataFrame 只在 sidecar。Renderer 通过 `IDatasource.getRows` 调 `data.fetchBlock`（512 行块），`cacheBlockSize=512`、`maxBlocksInCache=3`（可见块 ±1）。**禁止** `rowModelType: 'clientSide'` 把整表灌进网格。
- Viewport / Server-Side row model 是 Enterprise，不要引入 `ag-grid-enterprise`。
- 单元格编辑 debounce 后批量 `data.patchCells`。列宽只存在前端像素，切换数据集时重置。
- Pinia `useDataStore()` 仍只暴露 `fetchBlock` / `patchCells` / `schema`；不要为了网格去拉全表。

Community 不做 DataFrame 级筛选/排序：过滤仍走 Operate RPC。不要打开 AG Grid 客户端 filter（那需要全部行）。

## 停靠布局

上游 ADS 嵌套停靠（图表区内再停靠）实现成本高，且有焦点陷阱类问题。**工作区级自由停靠已落地**（`golden-layout` 2.6，不是 dockview）。图表区内再嵌套 figure 仍不做。

默认 IDE 分区：

- 左：数据列表 / 节点工具箱（同一 stack）
- 中：工作流 | 数据表 | 图表（同一 stack）
- 右：属性面板
- 底：日志

用户可把标签拖到其它栈。旧工程没有 `docking` 时仍按 `splits` 生成上述默认树。不要用 dockview（偏 React）。

## IPC

- 控制面：JSON-RPC 2.0，**按行** JSON（stdin/stdout），与上游 Agent 协议形态类似但语义不同。
- 数据块：`data.fetchBlock` 走 **Arrow IPC stream**（JSON 头 `encoding=arrow-v1` + length-prefixed 裸字节）。空窗口或编码失败时回退 JSON 二维数组，便于调试。主进程解码，renderer 仍是 `{startRow, rows}`。
- 禁止：WebSocket 再开端口（防火墙/多实例冲突）；禁止渲染进程直连 TCP。

## 否决项

| 不采用 | 原因 |
|--------|------|
| Ninja/C++ 重写热路径 | 违反「无应用层 C++」 |
| 渲染进程 `child_process` 直接跑 Python | 生命周期与崩溃隔离应在 main |
| ECharts 作为大数据折线唯一方案 | 全量 JSON 点会卡死；最多作小数据统计图备选 |
| JupyterLab 整套嵌入 | 体积与 UX 过重 |
| 在 TS 重写 DAG 执行器 | 与节点 `execute()` 双端分叉，必出 bug |
| Redux | 与 Vue 不匹配 |
| `ag-grid-enterprise` | 许可与体积；Community infinite row model 已覆盖窗口化虚表 |
| 源码 UI 字符串写中文 | 沿用上游：英文源 + 词条；见 [12-quality.md](./12-quality.md) |

## ML Ribbon 使用边界

Ribbon schema 只描述：tab / group / item id / icon / labelKey。点击后 `item.id` 进入 `commandBus.dispatch(id, payload)`。

插件（后期）注册命令到 bus，再调用 `ribbonApi.addItem(...)`。这样 ML Ribbon 升级或替换时，业务命令仍在。

## 许可注意

- Element Plus：MIT
- Vue Flow：MIT
- Electron：MIT
- uPlot：MIT
- AG Grid Community：MIT（`ag-grid-community` / `ag-grid-vue3`）。不要引入 Enterprise。
- Golden Layout：MIT
- 上游 data-workbench：LGPL。**vendor 其 Python 文件时必须保留版权头与 LGPL 告知**（见 [06-python-reuse.md](./06-python-reuse.md)）。本仓库若以 MIT 发布，需在 NOTICE 中标明上游文件范围。
