# IPC 协议

主进程与 Python sidecar 使用 **JSON-RPC 2.0**。每一条消息占 stdout/stdin 的**一行**（UTF-8）。Windows 下 Python 若走文本模式，主进程读行后必须去掉 `\r`（上游 Agent 踩过的坑）。

日志、traceback、print **禁止写 stdout**。sidecar 日志写 stderr 或文件，由主进程转发到渲染进程日志面板。

## 帧格式

### 文本帧（默认）

```text
{"jsonrpc":"2.0","id":1,"method":"data.list","params":{}}
{"jsonrpc":"2.0","id":1,"result":{"datasets":[]}}
```

服务端主动通知：无 `id`，有 `method`（JSON-RPC notification）。

### 二进制帧（Arrow 块，P1 启用）

当 `result` 含大型列数据时，先发一行 JSON 头：

```json
{"jsonrpc":"2.0","id":3,"result":{"encoding":"arrow-v1","bytes":12004,"meta":{"rows":512,"startRow":0}}}
```

随后立刻写 **恰好 `bytes` 字节**的 Arrow IPC stream（不是按行切）。空窗口仍走 JSON `{startRow, rows:[]}`；编码失败时同样 JSON 回退。主进程按 `bytes` 读裸二进制并解码，渲染层只见 `{startRow, rows}`。

## 生命周期方法

| 方法 | 方向 | 说明 |
|------|------|------|
| `host.ready` | Py → Main 通知 | sidecar 启动完成后发（尝试导入 pandas 之后）。无 `id`。params：`{pid, pandasAvailable}` |
| `host.hello` | Main → Py | 交换版本与工作区路径 |
| `host.shutdown` | Main → Py | 优雅退出；超时 `kill` |
| `host.crashed` | Main → Renderer 通知 | sidecar **意外**退出后由主进程发出（不是 Python 协议；故意 `host.shutdown` 不发）。params：`{code, signal, willRestart}`。`willRestart=true` 时再拉起一次；第二次意外退出为 `false` |

`host.hello` params：`{appVersion, workspaceRoot}`。result：`{ok: true, pythonVersion, appVersion, workspaceRoot, pandasAvailable}`。

`host.shutdown` result：`{ok: true}`，随后进程以退出码 0 结束。

pandas 未安装时仍发 `host.ready`，`pandasAvailable` 为 `false`（P0 不阻塞骨架）。

### P0 验收：stdout 污染

若 sidecar 在 JSON-RPC 行之间向 stdout 打印非 JSON（例如 `oops`），主进程必须记为 **protocol pollution** 并继续解析后续合法行，而不是阻塞等待。测试可用环境变量 `DW_POLLUTE_AFTER_READY=1` 在 `host.ready` 后故意写一行 `oops`。

## data 域

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `data.import` | `{path, format?}` | `{id, name, rows, cols, columns:[{name,dtype}]}` | format 缺省按后缀；**pickle 默认拒绝**（3001）。渲染进程可省略 `path`：主进程弹出打开对话框后再转发给 sidecar；用户取消返回 `{cancelled:true}`（不是 JSON-RPC error）。超时 120s |
| `data.list` | `{}` | `{datasets:[{id,name,rows,cols}]}` | |
| `data.getSchema` | `{id}` | `{columns, rowCount}` | 轻量，可频繁调 |
| `data.fetchBlock` | `{id, startRow, rowCount}` | `{startRow, rows: any[][]}` | `rowCount` 默认 512，上限 2048。wire 为 Arrow IPC（`arrow-v1`）或 JSON 空窗/回退；主进程解码，renderer 形状不变 |
| `data.patchCells` | `{id, patches:[{row,col,value}]}` | `{ok}` | 批量事务；非法 dtype → 1002，整批不提交 |
| `data.rename` | `{id, name}` | `{ok}` | 重名时自动 `name (2)` |
| `data.remove` | `{id}` | `{ok}` | |
| `data.export` | `{id, path, format}` | `{ok}` | csv/xlsx/parquet。渲染进程可省略 `path`：主进程弹出保存对话框 |
| `data.register` | `{name, handle?}` | `{id}` | 供节点 DataToManager 内部调用；同名覆盖。JSON-RPC 一期仅 `{name}` 建空表 |
| `data.dropNa` | `{id, how?, subset?, minNonNa?}` | `{id, name, rows, cols, columns, removedCount}` | **就地**改写当前表，调用 Core `dropna_impl`（只删行）。`how` 为 `any`/`all`（默认 `any`）；`subset` 为列名数组或逗号分隔字符串，空=全部列；`minNonNa` 为最少非缺失值，`0` 表示不启用。未知列 → 1002/`data.columnNotFound` |
| `data.dropDuplicates` | `{id, keep?, subset?}` | `{id, name, rows, cols, columns, removedCount}` | **就地**改写当前表，调用 Core `drop_duplicates_impl`。`keep` 为 `first`/`last`/`none`（默认 `first`；JSON `false`/`"false"` 视为 `none`）；`subset` 为列名数组或逗号分隔字符串，空=全部列。非法 keep → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound` |
| `data.fillNa` | `{id, method?, subset?, value?}` | `{id, name, rows, cols, columns, filledCount}` | **就地**改写当前表，调用 Core `fillna_impl`。`method` 为 `value`/`forward`/`backward`/`mean`/`median`/`mode`（默认 `value`，亦接受 `constant`/`ffill`/`bfill`）；`subset` 空=全部列；`value` 在 `method=value` 时生效（数字或字符串，默认 `0`）。非法 method → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound` |
| `data.interpolate` | `{id, method?, subset?, limit?, order?}` | `{id, name, rows, cols, columns, filledCount}` | **就地**改写当前表，调用 Core `interpolate_impl`。`method` 与上游插值对话框一致（默认 `linear`）；`subset` 空=全部列；`limit` 省略/`null`/`0`=不限制连续 NaN；`order` 默认 `3`（spline/polynomial）。非法 method/order/limit → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound`。不要加 `inplace` 参数（Operate 始终就地改当前表） |
| `data.removeOutliersIqr` | `{id, multiplier?, action?, customValue?, reindex?, subset?}` | `{id, name, rows, cols, columns, action, removedCount, replacedCount}` | **就地**改写当前表，调用 Core `remove_outliers_iqr_impl`。参数对齐上游 IQR 对话框：`multiplier` 默认 `1.5`（须 `> 0`）；`action` 为 `remove`/`replace_mean`/`replace_median`/`replace_boundary`/`replace_custom`（默认 `remove`）；`customValue` 仅 `replace_custom` 使用（默认 `0`）；`reindex` 默认 `true`（删行后重置行号）；`subset` 空=全部数值列。非法 action/multiplier → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound`。不要加 `inplace` |
| `data.removeOutliersZscore` | `{id, threshold?, robust?, action?, customValue?, reindex?, subset?}` | `{id, name, rows, cols, columns, action, robust, removedCount, replacedCount}` | **就地**改写当前表，调用 Core `remove_outliers_zscore_impl`。参数对齐上游 Z-score 对话框：`threshold` 默认 `3`（须 `> 0`）；`robust` 默认 `false`（中位数/MAD）；`action` 同 IQR；`customValue` 默认 `0`；`reindex` 默认 `true`；`subset` 空=全部数值列。非法 action/threshold → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound`。不要加 `inplace` |
| `data.transformSkewed` | `{id, method?, lambdaValue?, addOne?, subset?}` | `{id, name, rows, cols, columns, method, transformedCount, changedCount}` | **就地**改写当前表，调用 Core `transform_skewed_impl`。方法对齐上游对话框并含 Core 的 `boxcox`：`log`/`sqrt`/`reciprocal`/`power`/`boxcox`（默认 `log`）；`lambdaValue` 仅 `power` 使用（默认 `0.5`，须有限）；`addOne` 默认 `true`（log/sqrt/boxcox 处理零值）；`subset` 空=全部数值列。非法 method/lambda → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound`。不要加 `inplace` |
| `data.replaceValues` | `{id, oldValues?, newValue?, subset?, caseSensitive?}` | `{id, name, rows, cols, columns, replacedCount}` | **就地**改写当前表，调用 Core `replace_values_impl`。`oldValues` 为字符串数组或逗号分隔字符串（必填）；`newValue` 默认空串；`subset` 空=全部列；`caseSensitive` 默认 `true`（文本列）。空 oldValues → 1002/`data.replaceOldEmpty`；未知列 → 1002/`data.columnNotFound` |
| `data.thresholdFilter` | `{id, filterType?, lower?, upper?, subset?, rowLogic?, treatNan?}` | `{id, name, rows, cols, columns, removedCount}` | **就地**改写当前表，调用 Core `threshold_filter_impl`。`filterType` 为 `greater_than`/`less_than`/`in_range`/`out_of_range`（默认 `greater_than`；别名 `gt`/`>`/`greater`、`lt`/`<`/`less`、`between`/`inside`、`outside`，**不要**把 `>=` 当别名）。`greater_than` 用 `upper` 删除 `>` 上限的行；`less_than` 用 `lower` 删除 `<` 下限的行。`subset` 空=全部数值列；`rowLogic` 为 `any`/`all`（默认 `any`）；`treatNan` 默认 `false`。无数值列 → 1002/`data.thresholdNoNumeric`；指定非数值列或非法类型 → 1002/`data.invalidValue`；未知列 → 1002/`data.columnNotFound` |
| `data.filterByColumn` | `{id, column, min?, max?}` | `{id, name, rows, cols, columns, matchedCount, removedCount}` | **就地**改写当前表，调用 Core `filter_by_column_range`（**保留**闭区间内的行，与 `thresholdFilter` 删行相反）。`column` 必填；`min`/`max` 省略或 `null`=该侧不限制（**0 是真实边界**，不要把 0 当「不限制」）。空列名 → 1002/`data.filterByColumnColumnEmpty`；未知列 → 1002/`data.columnNotFound`；非数值列或非法边界 → 1002/`data.invalidValue` |
| `data.eval` | `{id, expression}` | `{id, name, rows, cols, columns}` | **就地**改写当前表，调用 Core `eval_expression`。表达式必须是赋值（如 `c = a + b`）；pandas `eval` 无赋值会返回 Series，不能覆盖整表。空表达式 → 1002/`data.evalEmpty`；非法表达式或 Series 结果 → 1002/`data.invalidEval` |
| `data.search` | `{id, column, pattern, caseSensitive?}` | `{id, name, rows, cols, columns, matchedCount, removedCount}` | **就地**改写当前表，调用 Core `search_dataframe`（`str.contains` 正则，**保留**匹配行）。不要做成上游 Qt 的「查找下一个」高亮。空列 → 1002/`data.searchColumnEmpty`；空模式 → 1002/`data.searchPatternEmpty`；未知列 → 1002/`data.columnNotFound`；非文本列或非法正则 → 1002/`data.invalidSearch`。`caseSensitive` 默认 `false` |
| `data.query` | `{id, queryString}` | `{id, name, rows, cols, columns, matchedCount, removedCount}` | **就地**改写当前表，调用 Core `query_dataframe`。空表达式 → 1002/`data.queryEmpty`；非法 pandas query → 1002/`data.invalidQuery` |
| `data.sort` | `{id, columns, ascending?}` | `{id, name, rows, cols, columns}` | **就地**改写当前表，调用 Core `sort_dataframe`。`columns` 为列名数组或逗号分隔字符串；`ascending` 默认 `true`（所有列同一方向）。空列 → 1002/`data.sortColumnsEmpty`；未知列 → 1002/`data.columnNotFound` |
| `data.describe` | `{id, percentiles?, name?}` | `{id, name, rows, cols, columns}` | **发布新数据集**，调用 Core `describe_dataframe`（不改源表）。`percentiles` 为 `[0,1]` 数组或逗号分隔字符串，默认 `"0.25,0.5,0.75"`，空=pandas 默认；非法/越界/重复 → 1002/`data.invalidValue`。结果名默认 `{源表} describe`，重名走 `name (2)`。返回表把统计名展平为首列 `stat`，供虚表显示 |
| `data.pivotTable` | `{id, index, columns?, values?, aggfunc?, margins?, marginsName?, sort?, name?}` | `{id, name, rows, cols, columns, aggfunc}` | **发布新数据集**，调用 Core `create_pivot_table`（不改源表）。`index` 必填（数组或逗号分隔）；`columns`/`values` 空=`None`（值列空则用其余数值列）。`aggfunc` 对齐上游对话框：`mean`/`sum`/`count`/`size`/`min`/`max`/`median`/`std`/`var`/`first`/`last`/`prod`（默认 `mean`）。`margins` 默认 `false`；`marginsName` 空=`All`；`sort` 默认 `false`。空 index → 1002/`data.pivotIndexEmpty`；未知列 → 1002/`data.columnNotFound`；同一列出现在多个角色或非法 aggfunc → 1002/`data.invalidValue`。结果名默认 `{源表}_PivotTable`，重名走 `name (2)`。返回表把 MultiIndex 列展平（`_` 连接）并 `reset_index()`，供虚表显示。不要加 `inplace` |

`id` 为 UUID 字符串。显示名可重复策略：导入时若重名自动 `name (2)`（与 Excel 类似），节点发布同名则**覆盖值**（对齐上游 DataToManager）。

## workflow 域

| 方法 | 参数 | 说明 |
|------|------|------|
| `workflow.create` | `{name?}` | `{workflowId, name}` 空 DAG |
| `workflow.listNodeTypes` | `{}` | `{types:[{qualifiedName,name,category,inputs,outputs,parameters,bodyShape?}]}` 供工具箱与属性表单。`bodyShape` 可选（如 If/Else 的 `Diamond`）。无 workflowId |
| `workflow.addNode` | `{workflowId, qualifiedName, nodeId?, position?}` | 工厂 `create_node`；`nodeId` 省略则 Python 生成。`position` 仅会话缓存，不进逻辑 dump |
| `workflow.removeNode` | `{workflowId, nodeId}` | |
| `workflow.setParam` | `{workflowId, nodeId, name, value}` | value 为 JSON 可序列化 |
| `workflow.connect` | `{workflowId, fromId, fromPort, toId, toPort, connectionId?}` | 重复端口对 → error（`workflow.duplicateConnection`）。`connectionId` 供 undo 恢复同一条边 |
| `workflow.disconnect` | `{workflowId, connectionId}` 或同字段四元组 | |
| `workflow.execute` | `{workflowId}` | 异步；先回 `{accepted:true, workflowId}`，再发通知。有环立即 `2002`，不启动线程 |
| `workflow.pause` / `resume` / `stop` | `{workflowId}` | 映射 executor `pause`/`resume`/`terminate` |
| `workflow.dumpLogic` | `{workflowId, format?: json\|xml}` | `{format, payload}`：json 为 serializer dict，xml 为字符串 |
| `workflow.loadLogic` | `{payload, format: json\|xml, workflowId?}` | **只** `serializer.from_dict`/`from_xml` 建模型，返回 `{workflowId, name}`。已有 `workflowId` 且空闲则原地替换会话。禁止随后再走 `addNode` 复制同一批节点 |
| `workflow.getGraph` | `{workflowId}` | wrap 用快照：`{workflowId, name, nodes:[{nodeId, qualifiedName, parameters, runtimeState?}], connections:[{connectionId, fromId, fromPort, toId, toPort}]}`。`runtimeState.displayText` 供 Text Viewer 等在画布上显示缓存文本。无坐标 |

通知：

| 方法 | payload |
|------|---------|
| `workflow.nodeState` | `{workflowId, nodeId, state: idle\|running\|ok\|error, displayText?}`（引擎 `success` 映射为 `ok`）。Text Viewer 在 ok/error 时附带缓存文本 |
| `workflow.finished` | `{workflowId, ok, error?, cancelled?}`。用户 Stop 时 `ok=false` 且 `cancelled=true`（无 `error`） |
| `workflow.log` | `{level, message}` |

## chart 域（P4）

| 方法 | 说明 |
|------|------|
| `chart.listTypes` | `{types:[{id,name}]}`，id：`line` / `scatter` / `bar` / `hist` / `box` |
| `chart.buildSeries` | `{dataId, x?, y[], kind?, maxPoints?, bins?, binWidth?, histStat?, histCumulative?, xMin?, xMax?}` → `{x, ys, pointCount, sourceCount, downsampled, xKind, maxPoints, boxes?}`。`kind:"hist"` 时 `x` 可省略，`y` 为要分箱的数值列；Python 返回箱中心 + 计数。默认 50 箱（钳制 5…200）。`binWidth>0` 时按箱宽分箱（箱数仍封顶 200）。`histStat`：`count`（默认）/`density`/`probability`/`percent`；`histCumulative` 对箱值做累加。`kind:"box"` 时同样省略 `x`；Python 按 Tukey（1.5×IQR）返回 `boxes`（四分位、须、封顶 200 个离群点/列），`ys` 仅为刻度范围，渲染进程不得用原始列再算箱线。 |
| `chart.saveExport` | **仅 Electron 主进程**（不转发 sidecar）。`{format:'png'\|'svg'\|'pdf', content, suggestedName?, path?}` → `{ok:true}` 或 `{cancelled:true}`。PNG 的 `content` 为 `data:image/png;base64,...`；SVG 与 PDF 的 `content` 均为 UTF-8 SVG 标记（PDF 由主进程 hidden `BrowserWindow` `printToPDF` 转换后再写盘）。无 `path` 时弹出另存对话框。写失败 **3001** `data.ioError`。 |

## app 域（仅主进程）

| 方法 | 说明 |
|------|------|
| `app.openUrl` | **仅 Electron 主进程**（不转发 sidecar）。`{url}` → `{ok:true}`。用 `shell.openExternal` 打开关于页的仓库链接。只允许 `https://github.com/Kinvy66/DataWorkbench` 及其子路径；其它 URL **−32602** `help.urlBlocked`。渲染进程禁止自己开浏览器。帮助正文**不要**走这条，用 `app.openHelp`。 |
| `app.openHelp` | **仅 Electron 主进程**。`{page?}` → `{ok:true}`。打开（或聚焦）非模态帮助窗口，渲染安装包内 `docs/wiki` 的 Markdown。缺省 `README.md`。非法页名 **−32602** `help.pageNotFound`。 |
| `help.list` | **仅 Electron 主进程**。`{}` → `{pages:[{id,title}]}`。标题取各页 `#` 标题。 |
| `help.read` | **仅 Electron 主进程**。`{page}` → `{id,title,markdown}`。只允许白名单 `.md`。图片改写为 `dwhelp://bundle/...`，由主进程协议从 `docs/assets/wiki` 读盘。缺页 **3001** `help.pageNotFound`。 |
| `app.clipboardWrite` | **仅 Electron 主进程**。`{text?}` 或 `{pngDataUrl?}` → `{ok:true}`。表格复制写 TSV 文本；绘图复制写 PNG。渲染进程禁止自己碰系统剪贴板。 |
| `app.clipboardRead` | **仅 Electron 主进程**。`{}` → `{text}`。表格粘贴读 TSV。 |

- `maxPoints` 默认 5000，钳制到 2…20000。生产降采样只在 Python（LTTB），前端禁止对百万点 `JSON.parse`。直方分箱同样只在 Python，不要把原始列拉到渲染进程再 `histogram`。箱宽/统计量/累计由 `binWidth`/`histStat`/`histCumulative` 下发，缺省行为与一期相同（50 箱、count）。箱线（`kind:"box"`）同样只在 Python 算 Tukey 统计，离群点每列最多 200 个（`CHART_BOX_OUTLIERS_MAX`）。
- 非数值 y（或既非数值也非日期的 x）：error **1002**，`i18nKey=chart.nonNumeric`。缺列：1002 `chart.columnNotFound`。缺数据集：1001 `data.notFound`。
- 非有限 x 的行丢弃；y 的 NaN 变成 JSON `null`（uPlot 断线）。datetime x 为 epoch **毫秒**，`xKind:"time"`；uPlot 时间轴自行 ÷1000。
- uPlot 视口停止 **150ms**（`CHART_VIEWPORT_DEBOUNCE_MS`）后带 `xMin`/`xMax` 再请求 `chart.buildSeries`，仍受 `maxPoints=5000` 限制，不要把窗口内百万点拉进渲染进程。小数据（未降采样且未窗口）不重复请求。直方缩放会按值轴窗口重新分箱；**箱线不按视口重算**（统计已是整列）。时间轴 scale 是秒，协议用毫秒。复位视图省略 `xMin`/`xMax` 拉回全列。
- SVG 由当前图的采样点生成矢量（含标题/轴/图例/网格）；PNG 抓当前 uPlot 画布（含缩放）。渲染进程不得 `fs` 写盘。


## project 域

| 方法 | 说明 |
|------|------|
| `project.save` | **仅 Electron 主进程**。无路径则 Save 对话框；`workflow.dumpLogic` → sidecar `project.packLogic` 写 parquet → 主进程打 ZIP，`*.tmp` 再 rename。`{ path?, workflowId, uiLayout, charts }` → `{ ok: true, path }` 或 `{ cancelled: true }` |
| `project.open` | **仅 Electron 主进程**。对话框；解压；校验 magic/format；sidecar `project.unpackLogic` **先解析再整体替换**。返回 `{ path, workflowId, uiLayout, charts }` |
| `project.packLogic` | sidecar：把当前 DataManager 写成 `datas/<id>.parquet` + `data-manager.json`（主进程调用，渲染进程不可达） |
| `project.unpackLogic` | sidecar：读 parquet + `workflow-logic.json` 进内存，成功后再 `replace_all` / 替换 sessions |
| `project.clearLogic` | sidecar：清空数据集并丢弃全部 workflow session（File → New） |

ZIP 的压缩/解压在 **Electron 主进程**（`fflate`），Python 只认已解压目录。不要让 Python 再依赖 QuaZip。清单文件是 **`manifest.json`**（`magic: DataWorkbenchProject`, `format: 1`），不是 `project.json`。扩展名 `.dwproj`。不打开上游 `.dapro`。

`uiLayout` 由渲染进程写入 ZIP 的 `ui-layout.json`（Python sidecar **不**建模）。字段含 `centerTab` / `leftTab` / `splits` / `nodes`，以及可选 `docking`（Golden Layout JSON）。缺 `docking` 的旧工程按 `splits` + tab 生成默认停靠树，**不 bump** `format`。

`project.save` / `project.open` / `project.packLogic` / `project.unpackLogic` 超时 **120s**。失败码沿用 **3001** `data.ioError`，另有 `project.invalid` / `project.unsupportedFormat` / `project.dirMissing`。

## 错误码

| code | 含义 |
|------|------|
| `-32700` | 解析失败（含 stdout 被 print 污染） |
| `-32601` | 未知方法 |
| `1001` | 数据集不存在 |
| `1002` | 列不存在 |
| `2001` | 节点类型未注册 |
| `2002` | DAG 有环 |
| `2003` | 工作流忙或执行失败（异步失败走 `workflow.finished`，不占用 RPC error） |
| `3001` | 文件 IO |
| `9001` | sidecar 内部未捕获 |

## 前端封装

`preload` 只暴露：

```ts
window.dw.rpc.invoke(method: string, params?: unknown): Promise<unknown>
window.dw.rpc.on(method: string, cb: (params: unknown) => void): () => void
```

渲染进程不得使用 `ipcRenderer` 其它频道。超时：普通 RPC 30s；`workflow.execute` 不超时（用 stop）；`data.import` / `chart.buildSeries` / `project.*` 120s。`chart.saveExport`、`project.save`、`project.open`、`app.openUrl`、`app.openHelp`、`help.list`、`help.read`、`app.clipboardWrite`、`app.clipboardRead` 由主进程处理，不把 ZIP 丢给 sidecar。

## 调试

开发模式把 sidecar 的 stderr 印到主进程终端，并写 `logs/sidecar.log`。可用环境变量 `DW_RPC_DUMP=1` 打印方法名（**禁止**打印 cell 值与文件全路径中的用户目录以外部分，避免日志爆炸与隐私问题）。
