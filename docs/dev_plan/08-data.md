# 数据模块

对标上游 `DAData` + `DATableDataSource.fetchBlock` + DataAnalysis 导入。DataFrame **只存在 sidecar**。

## 概念

- **Dataset**：一次导入或节点发布的一张表（pandas DataFrame）。有稳定 `id`（UUID）与可变 `name`。
- **Schema**：列名、dtype、行数。RPC 廉价，UI 启动和切换时拉。
- **Block**：连续行窗口，默认 512 行，与上游块大小对齐，方便以后对照行为。

Series 一期当单列表处理或禁止单独导入，降低分支。

## DataManager 职责（Python）

- 持有 `id → DataFrame`
- 导入/导出/改名/删除
- `fetchBlock`：`iloc[start:start+n]` 转成 Arrow IPC（`arrow-v1` 二进制帧）或 JSON 回退；日期先经 `json_cell` 成 ISO / null
- `patchCells`：按列 dtype 解析字符串，失败返回 1002/校验错误且不部分提交（整批事务）
- 发布接口给节点：`publish_dataframe(name, df)` 同名覆盖

大表 undo：一期 **不** 对整表做 copy-on-write。单元格编辑只记 patch 列表（上限例如 1 万条），超出则提示「历史过长，无法撤销」。这是有意小于上游 QUndo 整表快照。

## 导入格式（P1）

| 格式 | 库 | 注意 |
|------|-----|------|
| csv / txt | pandas `read_csv` | 编码：utf-8 优先，否则 charset-normalizer 限定 CJK 码表（避免短 GB 文件被标成 cp949）；分隔符一期只逗号/制表符/分号 |
| xlsx | pandas + openpyxl | 只第一张 sheet；多 sheet 放 P3 对话框 |
| parquet | pyarrow | |
| pickle | **默认关闭** | 安全；需要时设置页显式打开 |

不支持上游全部 pickle 默认开启。datetime 列：pandas 推断后 schema 标记 `datetime64`，虚表展示 ISO。

## 前端虚表

滚动条位置 → `startRow = floor(scrollRatio * rowCount)` → 对齐到 512 的块边界 → 若缓存未命中则 `fetchBlock`。缓存保留当前块 ±1。

渲染：只用当前缓存的行画可见区（TanStack Virtual）。**禁止** `v-for` 50 万个 `tr`。

列宽拖拽存在前端（像素轨，不使用 `1fr` 拉伸），不回写 Python。切换数据集时列宽重置。

## 与工作流衔接

- **data_source 节点**：参数 `dataset_name` 或 `dataset_id`，`execute` 时从 DataManager 取 df 的**副本**写入 `_output_data`。不是上游那个读文件的 Data Source。
- **Drop NA**：节点输出新 df；Ribbon `data.dropNa` **就地**替换当前数据集（与 `dropna_impl` 同一函数）。需要另存一份时用 Output to DataManager。
- **Fill NA**：节点输出新 df；Ribbon `data.fillNa` **就地**替换当前数据集（与 `fillna_impl` 同一函数）。需要另存一份时用 Output to DataManager。
- **Query**：节点输出新 df；Ribbon `data.query` **就地**替换当前数据集（与 `query_dataframe` 同一函数）。
- **Sort**：节点输出新 df；Ribbon `data.sort` **就地**替换当前数据集（与 `sort_dataframe` 同一函数）。需要另存一份时用 Output to DataManager。
- **Output to DataManager**：见 [06-python-reuse.md](./06-python-reuse.md)。
- 执行结束后前端 `data.list` 刷新。不要靠猜测 df 是否变化。

## 导出

`data.export` 在 sidecar 写盘。路径由主进程文件对话框选出后传入。渲染进程不写文件系统。

## 测试

| 用例 | 断言 |
|------|------|
| `test_fetch_block_range` | 1000 行表取 start=512 count=512 得到 488 行 |
| `test_fetch_block_500k_window_not_full_table` | 50 万行内存表 `fetchBlock` 只返回 512 / 末窗余数，不序列化整表 |
| `test_import_500k_csv_arrow_payload_not_file` | 50 万行 csv 真实导入；窗口 Arrow 载荷 ≪ 文件 |
| `test_fetch_block_caps_row_count` | `rowCount` 上限 2048 |
| `test_patch_rollback` | 非法 float 写入数值列 → error 且原值不变 |
| `test_import_csv_utf8` / `test_import_txt_semicolon` / `test_import_csv_gb18030` | utf-8 / txt 分号 / GB18030 |
| `test_data_dropna_via_rpc` / `test_dropna_node_matches_core` | Ribbon `data.dropNa` 与节点 Drop NA 与 `dropna_impl` 同行数 |
| `test_data_fillna_via_rpc` / `test_fillna_node_matches_core` | Ribbon `data.fillNa` 与节点 Fill NA 与 `fillna_impl` 同填充数 |
| `test_data_query_via_rpc` / `test_query_node_matches_core` | Ribbon `data.query` 与节点 Query 与 `query_dataframe` 同行数 |
| `test_data_sort_via_rpc` / `test_sort_node_matches_core` | Ribbon `data.sort` 与节点 Sort 与 `sort_dataframe` 同顺序 |
| `test_xlsx_roundtrip` / `test_parquet_roundtrip` | 导入再导出内容一致 |
| `test_pickle_rejected` / `test_pickle_import_rejected_via_rpc` | pickle 关（内存路径 + stdio 3001） |
| `test_data_import_list_fetch_via_rpc` | 每个 `data.*` 方法至少一正一反（stdio）；`fetchBlock` 头为 `arrow-v1` |
| `test_arrow_block` | IPC 往返与体积小于同内容 JSON |

手工：`python/.venv/Scripts/python.exe scripts/gen_large_csv.py` 生成 50 万行 csv（**不要提交该文件**），Data → Import 后滚动虚表。无 Electron E2E，此项不进 CI；不阻塞 P2 引擎 vendor。

## 明确延期

- 数据库惰性表（上游 table-data-source 的 SQL 实现）
- 亿行
- 单元格公式引擎
- Excel COM 互刷
