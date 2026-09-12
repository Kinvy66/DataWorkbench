# UI 壳：Ribbon、布局、命令总线

壳层对标上游 `AppMainWindow` + `DAAppRibbonArea` + ADS。工作区用 **Golden Layout** 自由停靠（可把七个面板拖到别的分区）；图表区内再嵌套停靠仍不做。目标是「看起来像专业桌面分析软件」，而不是网页后台。

## 窗口结构

窗口为 **无系统标题栏**（对齐上游 `SARibbonMainWindow`）：`titleBarStyle: 'hidden'`，**禁止**保留默认应用菜单（`File / Edit / View / Window / Help` 会叠在 Ribbon 上面）。Mac 仅保留系统 App/Edit/Window 菜单。标题栏可用区域最左侧固定显示软件 logo，其后才是 File 和 Ribbon 标签；拖动区域是标签行空白处。Windows / Linux 的最小化 / 最大化 / 关闭必须用 Electron **`titleBarOverlay`（系统按钮）**，不要用网页按钮盖在右上角——Win11 把该区域留给系统命中（Snap），HTML 点击到不了。标题行内容放在 `env(titlebar-area-*)` 安全区内。

```text
┌─────────────────────────────────────────────────────────┐
│  ML Ribbon（File | Home | …）              [_] [□] [×] │
├──────────┬──────────────────────────────┬───────────────┤
│ 左 240px │  主区 tabs                    │ 右 280px      │
│ 数据列表 │  Workflow | Table | Figure    │ 属性面板      │
│ 节点箱   │                              │               │
├──────────┴──────────────────────────────┴───────────────┤
│ 日志 120px                                                │
└─────────────────────────────────────────────────────────┘
```

分隔条可拖。默认仍是左 / 中 / 右 / 底四块。面板标签可拖到其它栈。停靠树写入 `ui-layout.json` 的 `docking`（可选；旧文件没有则按 `splits` + 当前 tab 生成默认树）。`header.close` / `header.popout` 关闭，避免面板被关掉或弹出独立窗口。复位路径：视图 → **复位布局**（`view.resetLayout`）。

## Ribbon 信息架构（一期）

常驻标签顺序对齐上游：主页 / 数据 / 视图 / 绘图。**启动时选中主页**，不要一上来就激活上下文「操作」。上下文标签按焦点窗口出现在绘图之后（表格 → 操作；工作流 → 工作流视图 + 工作流运行；绘图 → 图表），用户点过工作区窗口后再切过去。只放已实现的命令，不要为对齐而造空按钮（无插件管理、无 Agent、无 3D/等高线、无表格样式页）。主页配置含设置与关于；帮助菜单打开安装包内 wiki 窗口。

| Tab | 分组 | 命令 id | 阶段 |
|-----|------|---------|------|
| File | | `file.new` `file.open` `file.save` `file.saveAs` `file.exit` | P5 已可用 |
| Home | File | `file.open` `file.save` `file.saveAs` | 对齐上游主页文件面板 |
| Home | Clipboard | `edit.undo` `edit.redo` `edit.cut` `edit.copy` `edit.paste` `edit.delete` `edit.selectAll` | 按焦点：表格单元格 TSV / 工作流节点 / 绘图复制 PNG |
| Home | Create | `data.import` | 对齐上游创建；不上空 Figure / 新建工作流 |
| Home | Sidecar | `host.ping` | 本产品诊断，上游无 |
| Home | Config | `app.settings` `app.about` | 对齐上游主页配置（不上插件管理） |
| Home | Help | `app.help`（菜单内 `help.guide` `help.tutorial` `help.faq`） | 用户手册 / 教程 / FAQ 在非模态窗口渲染安装包内 `docs/wiki` |
| Data | Data Operation | `data.import` `data.remove` `data.rename` | P1（对齐上游 Data：添加/移除/重命名） |
| Data | Export | `data.export` | P1 |
| View | Display | `view.showWorkflow` `view.showNodes` `view.showFigure` `view.showTable` `view.showDatasets` `view.showProperties` `view.showLog` | 对齐上游视图显示；无设置窗/侧栏开关/Agent |
| View | Layout | `view.resetLayout` | 二期停靠 |
| Figure（常驻） | New | `chart.newLine` `chart.newScatter` `chart.newBar` `chart.newHist` `chart.newBox` `chart.newSubplots` | P4 + 二期子图/箱线；对齐上游 Figure |
| Operate（上下文 DataFrame，焦点在表格） | Data Cleaning | `data.dropNa` `data.dropDuplicates` `data.fillNa` `data.interpolate` `data.removeOutliersIqr` `data.removeOutliersZscore` `data.transformSkewed` | P3 |
| Operate | Data Filtering | `data.eval` `data.query` `data.search` `data.filterByColumn` `data.sort` | P3 |
| Operate | Statistics | `data.describe` `data.pivotTable` | P3 |
| Workflow View（上下文，焦点在工作流） | View | `workflow.fitView` `workflow.zoomIn` `workflow.zoomOut` | 对齐上游工作流视图缩放；无网格/导出场景 |
| Workflow（上下文，焦点在工作流） | Run | `workflow.run` `workflow.stop` | P2；`workflow.pause` 未做 |
| Chart（上下文 Chart Operate，焦点在绘图） | Annotate | `chart.annotateText` `chart.annotatePoint` `chart.annotateArrow` `chart.annotateRegion` | 二期标注 |
| Chart | Export | `chart.exportPng` `chart.exportSvg` `chart.exportPdf` | P4 + 二期 PDF |

所有 label 走 i18n key，例如 `ribbon.dataImport`。英文源对齐上游：「Add Data」。默认界面语言 `zh-CN`。

**Ribbon 对齐铁律**：常驻 **Home / Data / View / Figure**（主页 / 数据 / 视图 / 绘图）。上游 `DAAppRibbonArea` 的 Data 标签只有数据进出；Figure 标签常驻（新建图）；View 负责显示停靠面板与复位布局。清洗/过滤/统计在 DataAnalysis 插件挂到 DataFrame **上下文**「操作」页。复刻版用 mlRibbon `contextual` 标签：焦点在表格 → Operate；焦点在工作流 → Workflow View + Workflow Run；焦点在绘图 → Chart Operate（标注/导出）。工作流上下文有两页时仍不要设 `contextualTitle`（页名已经够用）。库默认把每个上下文页画成圆角描边色块（像独立按钮）；`AppRibbon.vue` 用 CSS 改成上游 SARibbon 的顶栏色条 + 浅底，不要改回 pill。**不要把每个 Core / 工作流节点都做成 Data 标签大按钮。** 上游 Ribbon 没有的 action（Replace Values、Threshold Filter）只做节点 + RPC，功能区不放按钮。Home 对齐上游文件/剪贴板/创建（仅已实现的打开/保存/撤销/添加数据）以及配置（设置、关于）和帮助菜单；剪贴板按焦点路由复制/粘贴/删除/全选（及剪切）。不要补插件管理。

File tab 使用 ML Ribbon 的 backstage/file menu（若库支持）；否则用 Element Plus 对话框模拟打开/保存（走 Electron `dialog.showOpenDialog`）。

## 命令总线

```ts
type CommandHandler = (ctx: { payload?: unknown }) => Promise<void>

interface CommandBus {
  register(id: string, handler: CommandHandler): void
  dispatch(id: string, payload?: unknown): Promise<void>
  can(id: string): boolean   // 用于 Ribbon disabled
}
```

Ribbon item `@click` 只 `dispatch(item.id)`。`can()` 根据 Pinia：无数据集时 `chart.newLine` 为 false。

快捷键在 main 或 renderer 用 `window.addEventListener('keydown')` 映射到同一 id（Ctrl+S → `file.save`）。不要在三个地方各写一套保存逻辑。

## 属性面板

单一 `PropertyPanel.vue`，根据 `selection`：

| 选中 | 内容 |
|------|------|
| 数据集 | 名称、shape、dtype 表 |
| 工作流节点 | 由 Python `parameters` 元数据生成字段（见 [09-workflow.md](./09-workflow.md)） |
| 图表曲线 | 颜色、线宽、标题（P4） |
| 无选中 | 空状态 |

不要为每种节点单独做 Vue 面板（上游后来用 DAFormSpec 统一表单，这里直接学）。特殊节点若必须自定义，用 `qualified_name` 注册表覆盖，而不是 if-else 堆在面板里。

## 图标

窗口 ico：`apps/resources/icon.ico`（上游 `src/APP/icon.ico`）。SVG：`apps/src/assets/icons/app/`（上游 `src/APP/Icon`）与 `gui/`（DAGui 按钮子集）。版权见仓库根 `NOTICE`（LGPL-3.0）。

渲染层用 `resolveIconUrl` / `DwIcon` / `ribbonIcon`。**按命令按需 `import '...svg?url'` 写入 `resolveIcon.ts` 的表**，不要 `import.meta.glob` 把整棵图标目录打进 renderer。File 下拉对齐上游 ApplicationMenu：打开=`file.svg`、保存=`save.svg`、另存为=`save-as.svg`；新建用 `appendProject.svg`，退出用 `gui/cancel.svg`（ML Ribbon `FileMenuItemModel` 无 `icon`，在 `AppRibbon.vue` 用 Vite `url()` 画到菜单项上，顺序必须与 `schema.ts` 的 `fileMenuItems` 一致）。**禁止**对传送到 `body` 的 File 下拉使用 Vue CSS `v-bind`：变量挂在组件根上，popper 继承不到，只会留下空白图标位。Classic 面板的 collection 默认是 3 行网格，`size: 'large'` 必须 `grid-row: 1 / -1` 跨满三行，否则按钮贴顶被裁、下面空两行。

## 主题

一期跟随 Element Plus 默认浅色。颜色尽量贴近上游图标规范主蓝 `#5280C1` 作为 Ribbon 强调色（CSS 变量），不要另起一套彩虹色。

## 开发者工具

开发态**默认不**自动弹出 DevTools（`detach` 会多出一个独立窗口）。需要时在窗口内按 `Ctrl+Shift+I` 或 `F12`；或启动前设 `DW_DEVTOOLS=1`。Vue Flow 与表格性能问题用 Performance 面板，不要猜。

## 二期

- **Golden Layout 自由停靠与布局持久化（已落地）**：`golden-layout` 2.6，Vue Teleport `v-if` 挂到面板内 `dw-gl-mount`（不要先丢进 `display:none` 暂存，日志会不更新）；七个面板 `datasets` / `nodes` / `table` / `workflow` / `figure` / `properties` / `log`；工程 `ui-layout.docking` 可选，不 bump `PROJECT_FORMAT`。禁止弹出窗口。
- 图表区内多 figure 分屏（上游 ADS 嵌套）— **未做**
- Ribbon gallery 节点缩略图
