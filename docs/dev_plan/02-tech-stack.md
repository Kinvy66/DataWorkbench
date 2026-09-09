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
| 表格 | TanStack Vue Virtual + 自绘网格 **或** AG Grid Community | 见下方表格决策 |
| 图表 | uPlot（主） | 大数据折线；导出走 SVG 序列化或离屏 canvas |
| Python | 3.11 或 3.12 | 与上游推荐 3.11 对齐；禁止 3.8 |
| 科学计算 | pandas / numpy / pyarrow / openpyxl | parquet 走 pyarrow |
| 打包 Python | 开发态用仓库 venv；发布用 PyInstaller 或 embeddable + pip | P5 再钉死一种 |

## 表格：为什么先用虚表 + TanStack

AG Grid 交互更像 Excel，但 Community 对「外部窗口数据」要自己喂行。一期核心难度是 **IPC 窗口** 而不是筛选 UI。先做轻量网格：

- 列头、行号、虚拟滚动、当前块高亮
- 单元格编辑走 `data.patchCells` 批量 RPC

二期若交互不够再换 AG Grid，store 接口保持 `getRow(i)` / `ensureWindow(start,end)` 不变。

## 停靠布局：一期降级

上游 ADS 嵌套停靠（图表区内再停靠）实现成本高，且有焦点陷阱类问题。

**一期（P0–P5）固定 IDE 布局：**

- 左：数据列表 / 节点工具箱（tab）
- 中：工作流 | 数据表 | 图表（主 tab）
- 右：属性面板
- 底：日志

用 `splitpanes` 或 CSS grid + 可拖拽分隔条即可。**二期**再引入 Golden Layout（框架无关）做可持久化自由停靠。不要在 P0 上 dockview（偏 React）。

## IPC

- 控制面：JSON-RPC 2.0，**按行** JSON（stdin/stdout），与上游 Agent 协议形态类似但语义不同。
- 数据块：`data.fetchBlock` 的 cell 值优先 **Arrow RecordBatch**（base64 或 length-prefixed 二进制帧）。行数少（≤ 512）时允许 JSON 二维数组，便于调试。
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
| 源码 UI 字符串写中文 | 沿用上游：英文源 + 词条；见 [12-quality.md](./12-quality.md) |

## ML Ribbon 使用边界

Ribbon schema 只描述：tab / group / item id / icon / labelKey。点击后 `item.id` 进入 `commandBus.dispatch(id, payload)`。

插件（后期）注册命令到 bus，再调用 `ribbonApi.addItem(...)`。这样 ML Ribbon 升级或替换时，业务命令仍在。

## 许可注意

- Element Plus：MIT
- Vue Flow：MIT
- Electron：MIT
- uPlot：MIT
- 上游 data-workbench：LGPL。**vendor 其 Python 文件时必须保留版权头与 LGPL 告知**（见 [06-python-reuse.md](./06-python-reuse.md)）。本仓库若以 MIT 发布，需在 NOTICE 中标明上游文件范围。
