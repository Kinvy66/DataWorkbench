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

随后立刻写 **恰好 `bytes` 字节**的 Arrow streaming 或 IPC file buffer，再继续下一行 JSON。主进程按 `bytes` 读裸二进制，不按行切。

一期实现可先全走 JSON 二维数组（`fetchBlock` 限制 512 行），P1 末期再加 Arrow；接口形状不要改。

## 生命周期方法

| 方法 | 方向 | 说明 |
|------|------|------|
| `host.ready` | Py → Main 通知 | 导入完 pandas 后发，对应上游 `booting`/`ready` 思想 |
| `host.hello` | Main → Py | 交换 `appVersion`、`workspaceRoot` |
| `host.shutdown` | Main → Py | 优雅退出；超时 `kill` |

## data 域

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `data.import` | `{path, format?}` | `{id, name, rows, cols, columns:[{name,dtype}]}` | format 缺省按后缀 |
| `data.list` | `{}` | `{datasets:[{id,name,rows,cols}]}` | |
| `data.getSchema` | `{id}` | `{columns, rowCount}` | 轻量，可频繁调 |
| `data.fetchBlock` | `{id, startRow, rowCount}` | `{startRow, rows: any[][]}` 或 Arrow | `rowCount` 默认 512，上限 2048 |
| `data.patchCells` | `{id, patches:[{row,col,value}]}` | `{ok}` | 批量；禁止单格一轮 RPC |
| `data.rename` | `{id, name}` | `{ok}` | |
| `data.remove` | `{id}` | `{ok}` | |
| `data.export` | `{id, path, format}` | `{ok}` | csv/xlsx/parquet |
| `data.register` | `{name, handle}` | `{id}` | 供节点 DataToManager 内部调用，不直接给 UI |

`id` 为 UUID 字符串。显示名可重复策略：导入时若重名自动 `name (2)`（与 Excel 类似），节点发布同名则**覆盖值**（对齐上游 DataToManager）。

## workflow 域

| 方法 | 参数 | 说明 |
|------|------|------|
| `workflow.create` | `{name}` | 空 DAG |
| `workflow.addNode` | `{qualifiedName, nodeId?, position?}` | 工厂 `create_node`；`nodeId` 省略则 Python 生成 |
| `workflow.removeNode` | `{nodeId}` | |
| `workflow.setParam` | `{nodeId, name, value}` | value 为 JSON 可序列化 |
| `workflow.connect` | `{fromId, fromPort, toId, toPort}` | 重复端口对返回 error |
| `workflow.disconnect` | `{connectionId}` 或四元组 | |
| `workflow.execute` | `{workflowId}` | 异步；立即返回 `{accepted:true}` |
| `workflow.pause` / `resume` / `stop` | `{workflowId}` | 映射 executor API |
| `workflow.dumpLogic` | `{workflowId}` | 返回 serializer dict 或 xml 字符串 |
| `workflow.loadLogic` | `{payload, format: json\|xml}` | 只建模型，不创建 UI |

通知：

| 方法 | payload |
|------|---------|
| `workflow.nodeState` | `{nodeId, state: idle\|running\|ok\|error, message?}` |
| `workflow.finished` | `{ok, error?}` |
| `workflow.log` | `{level, message}` |

## chart 域（P4）

| 方法 | 说明 |
|------|------|
| `chart.buildSeries` | `{dataId, x, y[], maxPoints}` → 降采样后的 `{x:number[], ys:number[][]}` |
| `chart.listTypes` | 一期：`line` / `scatter` / `bar` / `hist` |

前端禁止自己对全列做 `JSON.parse` 百万点；必须走 `buildSeries`。

## project 域（P5）

| 方法 | 说明 |
|------|------|
| `project.packLogic` | 把当前 DataManager 引用 + workflow dump 写到给定目录 |
| `project.unpackLogic` | 从目录恢复 |

ZIP 的压缩/解压在 **Electron 主进程**（Node `yazl`/`yauzl` 或 `adm-zip`），Python 只认已解压目录。不要让 Python 再依赖 QuaZip。

## 错误码

| code | 含义 |
|------|------|
| `-32700` | 解析失败（含 stdout 被 print 污染） |
| `-32601` | 未知方法 |
| `1001` | 数据集不存在 |
| `1002` | 列不存在 |
| `2001` | 节点类型未注册 |
| `2002` | DAG 有环 |
| `2003` | 执行失败（data 带 nodeId） |
| `3001` | 文件 IO |
| `9001` | sidecar 内部未捕获 |

## 前端封装

`preload` 只暴露：

```ts
window.dw.rpc.invoke(method: string, params?: unknown): Promise<unknown>
window.dw.rpc.on(method: string, cb: (params: unknown) => void): () => void
```

渲染进程不得使用 `ipcRenderer` 其它频道。超时：普通 RPC 30s；`workflow.execute` 不超时（用 stop）；`data.import` 120s。

## 调试

开发模式把 sidecar 的 stderr 印到主进程终端，并写 `logs/sidecar.log`。可用环境变量 `DW_RPC_DUMP=1` 打印方法名（**禁止**打印 cell 值与文件全路径中的用户目录以外部分，避免日志爆炸与隐私问题）。
