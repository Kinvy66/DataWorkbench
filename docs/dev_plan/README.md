# DataWorkbench 开发计划

本目录是 **DataWorkbench**（Electron + Vue 3 + Python sidecar）的开发计划与架构决策入口。目标是复刻上游 [data-workbench](https://github.com/czyt1988/data-workbench) 的**工作流 + 数据处理 + 交互图表**能力，技术栈不含应用层 C++，**不做 AI Agent**。

上游参考仓库（本机）：`F:/Rep/CAE_Code/data-workbench`。

## 一句话结论

可行，但是新产品而不是 Qt 翻译：Python 继续持有 DAG 与 DataFrame，Vue 只渲染视图。验收按「科研常用规模可重复分析、可编表、可导出矢量图」写，不对齐「亿级曲线 / 亿行表格 / Qwt 画布拖一切」。

## 文档索引

| 文档 | 内容 |
|------|------|
| [00-goals-and-constraints.md](./00-goals-and-constraints.md) | 目标、非目标、验收红线 |
| [01-architecture.md](./01-architecture.md) | 三进程架构与和上游的模块映射 |
| [02-tech-stack.md](./02-tech-stack.md) | 库选型、否决项、版本基线 |
| [03-repo-layout.md](./03-repo-layout.md) | 仓库目录与包边界 |
| [04-ipc-protocol.md](./04-ipc-protocol.md) | 主进程 ↔ Python JSON-RPC + 块取数 |
| [05-roadmap.md](./05-roadmap.md) | 分阶段任务、工期、里程碑验收 |
| [06-python-reuse.md](./06-python-reuse.md) | 从上游复用哪些 Python、改哪些绑定 |
| [07-ui-shell.md](./07-ui-shell.md) | ML Ribbon、停靠区、命令总线 |
| [08-data.md](./08-data.md) | 数据管理、虚表、导入导出 |
| [09-workflow.md](./09-workflow.md) | 节点画布、执行、与 Python 引擎同步 |
| [10-chart.md](./10-chart.md) | 图表一期/二期范围 |
| [11-project-file.md](./11-project-file.md) | 工程 ZIP 格式与加载顺序 |
| [12-quality.md](./12-quality.md) | 测试、日志、i18n、发布 |

## 阶段总览

```mermaid
flowchart LR
    P0["P0 骨架\nRPC 打通"] --> P1["P1 数据\n导入 + 虚表"]
    P1 --> P2["P2 工作流\n画布 + 执行"]
    P2 --> P3["P3 分析节点\n清洗 GUI"]
    P3 --> P4["P4 图表一期\n2D + 导出"]
    P4 --> P5["P5 工程文件\n安装包"]
```

默认人力假设：**1 名全职**（Vue + Python 都熟），日历约 **20–24 周** 到可内部使用的 MVP。两人并行可压到约 14–16 周。细节见 [05-roadmap.md](./05-roadmap.md)。

## 当前状态

P0 骨架已落地。P1 数据自动验收已完成。P2 画布路径已完成。P3 已 vendor 分析 Core，并接入 Data Source、Query、Drop NA、Drop Duplicates、Fill NA、Sort、Describe 与 Data Export（Ribbon 对话框分别共用 `query_dataframe` / `dropna_impl` / `drop_duplicates_impl` / `fillna_impl` / `sort_dataframe` / `describe_dataframe`；Describe 发布新表；Export 节点写连入的 df，Ribbon 导出仍走 `data.export`）。远程：[https://github.com/Kinvy66/DataWorkbench](https://github.com/Kinvy66/DataWorkbench.git)。其余清洗节点仍属 P3。每完成一个功能或阶段：自测 → commit → push（[AGENTS.md T11](../../AGENTS.md)）。
