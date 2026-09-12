# 工程文件

扩展名建议 **`.dwproj`**（ZIP），避免与上游 `.dapro` 混淆。若未来要做导入器，再单独写 `importDaproLogic`。

ZIP 由 **Electron 主进程** 读写。Python 只处理已解压目录中的逻辑文件。

## 目录布局

```text
project.dwproj
├── manifest.json              # magic, version, appVersion
├── workflow-logic.json        # DAWorkflowSerializer.to_dict 产物
├── ui-layout.json             # 节点坐标、split 比例、打开的 tab、可选 docking
├── charts.json                # 图表绑定与样式（含标注坐标、可选 figures / palette），无点数据
├── data-manager.json          # [{id, name, store: "inline-parquet"}]
├── datas/
│   └── <id>.parquet           # 一期默认物化；小 csv 工程也可 parquet
└── workspace/                 # P5 可空；脚本工作区后期
```

**没有** `agent_sessions/`。**没有** C++ `workflow.xml` 图元树。

## manifest.json

```json
{
  "magic": "DataWorkbenchProject",
  "format": 1,
  "appVersion": "1.0.0"
}
```

`format` 整数，不兼容时拒绝打开并提示升级/备份。

## 保存顺序

1. 前端把 `ui-layout.json`、`charts.json` 经 IPC 交给 main。
2. main 调 `workflow.dumpLogic` 写 `workflow-logic.json`。
3. main 调 `project.packLogic`：sidecar 把每个 dataset 写成 `datas/<id>.parquet`，写 `data-manager.json`。
4. main 把 staging 目录打 ZIP，替换目标文件（先写 `*.tmp` 再 rename，避免写坏原文件）。

## 加载顺序（铁律）

1. 解压到临时目录。
2. 校验 magic/format；主进程先解析 `ui-layout.json` / `charts.json` / `workflow-logic.json`。
3. `project.unpackLogic`：把 parquet 与 workflow JSON **全部读进内存**，成功后再一次性替换 DataManager **和** workflow sessions。解析失败则当前应用状态不变。
4. 渲染进程 `data.refreshList` + wrap 画布（`getGraph`，用文件里的节点坐标，禁止 `addNode`）+ 恢复 split/tab/`docking` + `chart.buildSeries` 重建图（不读入库里的点）。
5. 删除临时目录。任一步失败：工程视为未打开，临时目录删除，报错。不要半开状态允许保存覆盖用户文件。

## 与上游 `.dapro` 的关系

| 上游条目 | 本格式 | 一期 |
|----------|--------|------|
| `workflow-data.xml` CDATA 内 Python XML | `workflow-logic.json` | 可另写转换器 XML→dict（P5 可选） |
| `workflow.xml` 视图 | `ui-layout.json` | 不兼容 |
| `data-manager.xml` + `datas/` | parquet + json | 不兼容二进制 |
| `charts.xml` | `charts.json` | 不兼容 |
| `agent_sessions/` | 无 | 忽略 |

不要承诺「打开旧 DA 工程」。文档对外写「新格式」。

## 工作区

上游 `workspace/` 脚本缓存与冲突策略较复杂。MVP 可省略。若 P5 有余量：解压 `workspace/` 到用户数据目录，CWD 指向该处，提供「Run script」RPC（无 Agent）。默认不做。

## 测试

- 保存再加载：节点数、连接四元组、两个单元格值、一张图的 y 列名一致。
- 写盘中途 kill：原 `.dwproj` 仍可开（tmp+rename）。
