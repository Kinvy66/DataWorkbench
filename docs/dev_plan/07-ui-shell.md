# UI 壳：Ribbon、布局、命令总线

壳层对标上游 `AppMainWindow` + `DAAppRibbonArea` + ADS，但一期不做自由停靠。目标是「看起来像专业桌面分析软件」，而不是网页后台。

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

分隔条可拖。尺寸写入 `ui-layout.json` 的 `split` 字段。

## Ribbon 信息架构（一期）

| Tab | 分组 | 命令 id | 阶段 |
|-----|------|---------|------|
| File | | `file.new` `file.open` `file.save` `file.saveAs` `file.exit` | P5 真正可用，P0 可 disabled |
| Home | Clipboard | `edit.undo` `edit.redo` | P2 起 |
| Data | Import | `data.import` | P1 |
| Data | Export | `data.export` | P1 |
| Data | Dataset | `data.rename` `data.remove` | P1 |
| Data | Clean | `data.dropNa` `data.query` | P3 |
| Workflow | Run | `workflow.run` `workflow.stop` `workflow.pause` | P2 |
| Chart | New | `chart.newLine` `chart.newScatter` `chart.newBar` | P4 |
| Chart | Export | `chart.exportPng` `chart.exportSvg` | P4 |

所有 label 走 i18n key，例如 `ribbon.data.import`。英文源：「Import」。默认界面语言 `zh-CN`。

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

渲染层用 `resolveIconUrl` / `DwIcon` / `ribbonIcon`。**按命令按需 `import '...svg?url'` 写入 `resolveIcon.ts` 的表**，不要 `import.meta.glob` 把整棵图标目录打进 renderer。File 菜单项当前无 `icon` 字段，保持纯文字。Classic 面板的 collection 默认是 3 行网格，`size: 'large'` 必须 `grid-row: 1 / -1` 跨满三行，否则按钮贴顶被裁、下面空两行。

## 主题

一期跟随 Element Plus 默认浅色。颜色尽量贴近上游图标规范主蓝 `#5280C1` 作为 Ribbon 强调色（CSS 变量），不要另起一套彩虹色。

## 开发者工具

开发态**默认不**自动弹出 DevTools（`detach` 会多出一个独立窗口）。需要时在窗口内按 `Ctrl+Shift+I` 或 `F12`；或启动前设 `DW_DEVTOOLS=1`。Vue Flow 与表格性能问题用 Performance 面板，不要猜。

## 二期（不在 MVP）

- Golden Layout 自由停靠与布局持久化
- 图表区内多 figure 分屏（上游 ADS 嵌套）
- Ribbon gallery 节点缩略图
