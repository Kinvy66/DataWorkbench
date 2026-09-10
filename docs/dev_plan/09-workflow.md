# 工作流模块

对标上游 Python-first 工作流：逻辑在 `DAWorkFlowPy`，视图用 Vue Flow 替换 `DAPyNodeGraphicsItem`。

## 所有权

| 数据 | 位置 |
|------|------|
| 节点实例、参数值、连接、runtime_state | Python `DAWorkflow` |
| 节点 `x,y`、缩放、选中 | 前端 Pinia `workflowUi` |
| 端口形状、分类、图标路径 | 从节点类元数据经 RPC `workflow.listNodeTypes` 拉到工具箱 |

## 节点元数据 RPC

启动或插件扫描后调用一次：

```json
{
  "types": [
    {
      "qualified_name": "DASystemNodes.Delay",
      "name": "Delay",
      "category": "System / Flow Control",
      "inputs": [{"name": "trigger", "type": "any", "required": false}],
      "outputs": [{"name": "out", "type": "any"}],
      "parameters": [{"name": "seconds", "type": "float", "default": 1.0, "min": 0}]
    }
  ]
}
```

`qualified_name` 必须与上游一致，便于以后互导逻辑 XML。移植时尽量保持装饰器 `name=` 与包结构。

## 画布同步规则

用户操作 → **先 RPC 成功 → 再改 Vue Flow**。RPC 失败则不改图（或回滚）。

例外：拖动位置只改前端，不打 RPC（避免拖一次发几十次）。位置在 `nodeDragStop` 写 store。保存工程时前端提交 `ui-layout.json`。

加载（线协议字段一律 camelCase）：

1. `workflow.loadLogic` `{payload, format, workflowId?}` —— 有当前 `workflowId` 则原地替换会话，不要先 `workflow.create` 再灌图
2. `workflow.getGraph` `{workflowId}` 返回 `nodes`/`connections`（无坐标）
3. 前端按 `nodeId` wrap Vue Flow；Pinia 已有布局则复用 `{x,y}`，缺坐标则自动排列（`80+i*36`）

**禁止** load 路径调用 `workflow.addNode`（会工厂再建一份 Python 节点）。P5 工程打开时 layout 来自 `ui-layout.json`，走 `adoptWorkflow`（`getGraph` + wrap）；当前 `loadAndWrap` 仍用画布现有节点位置。

## Vue Flow 节点外观

- 矩形主体、顶部标题 = `name`
- 左侧输入柄、右侧输出柄，id = 端口名
- 状态：idle 灰 / running 蓝 / ok 绿 / error 红（左边框）
- Delay 等：不要用 Python `paint()`；用状态文字即可
- Text Viewer：不要用 Python `paint()`；`execute()` 缓存文本到 `runtime_state.display_text`，Vue 节点体显示。`font` 参数用 family/size/color 简易编辑，不要做 Qt 字体对话框

If/Else：已落地。未匹配分支输出 `None`，执行器不向下游传播（不要另发明 skip 协议）。画布用菱形 CSS `clip-path`（`#E3F2FD` / `#2196F3`），不要用 Python `paint()`。

## 执行

映射 `DAWorkflowExecutor.execute()`（sidecar 后台线程）。通知 `workflow.nodeState` 更新颜色。`stop` 置位会话 `cancel` Event 并调 `terminate()`。Delay 用 `Event.wait` 而不是阻塞 `time.sleep`，因此执行中途 Stop 能立刻打断等待。停止后 `workflow.finished` 带 `{ok:false, cancelled:true}`，日志走「已停止」而不是失败。

执行中禁用 `addNode`/`connect`（`commandBus.can` 返回 false），避免边跑边改图。

## 属性表单生成

| Parameter type | 控件 |
|----------------|------|
| str 默认 | ElInput |
| str layout=below | ElInput type=textarea |
| int/float | ElInputNumber（min/max/step） |
| bool | ElSwitch |
| choices | ElSelect |
| code | textarea，sidecar 用 `ast.literal_eval`（Constant 已有） |

改值 debounce 300ms 后 `workflow.setParam`。不要每键一次 RPC。

## 撤销（P2 最小）

只覆盖：加节点、删节点、连线、断线、参数、移动。每条命令保存 RPC 正反方法（移动只改 Pinia 坐标）。Home「剪贴板」走 `edit.undo` / `edit.redo`，快捷键 Ctrl+Z / Ctrl+Y（输入框内不抢）。

不与表格 patch undo 混为一条全局栈（一期只工作流可撤销）。`loadAndWrap` 清空历史。

## 运行时状态

上游 `serialize_runtime_state`（如 TextViewer 文本）已接到画布：`getGraph.runtimeState.displayText` + `nodeState.displayText`。serializer 钩子原样保留。

## 测试

- Python：roundtrip、有环 `execute` 失败、Constant `literal_eval`；`loadLogic` 后 `getGraph` 的 `nodeId`/端口与 dump 一致；Delay 执行中 `stop` 在超时前结束并带 `cancelled`；导入表 → Data Source → Query → DataToManager 后 `data.list` 有筛选结果
- 前端：Vitest 测 RPC mock 失败时不插入节点；`loadAndWrap` 只调 `loadLogic`+`getGraph`；undo/redo 走反向 RPC 且不插入额外历史

## 和上游文档的对应阅读

实现前必读上游：

- `src/DAPyWorkFlow/AGENTS.md` 持久化 wrap vs create
- `plugins/DASystemNodes/AGENTS.md` 六个陷阱（`super().__init__`、不要 `self.x.default`、execute 签名等）

这些陷阱在 Electron 里**仍然成立**，因为执行仍在同一套 Python 节点类上。
