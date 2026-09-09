# 质量：测试、日志、i18n、发布

质量要求对齐上游的精神（协议干净、模型先于视图、用户可见字符串可翻译），实现按 Web/Python 栈改写。

## 测试金字塔

| 层 | 工具 | 必保 |
|----|------|------|
| Python 单元 | pytest | serializer roundtrip、fetchBlock、节点 execute、降采样点数上限 |
| RPC 契约 | pytest + 真实 stdio 子进程 或 同进程 Host | 每个 data/workflow 方法至少一正一反 |
| TS 单元 | vitest | commandBus、虚表窗口计算、Ribbon dispatch |
| 手工 | 里程碑演示脚本 | 每阶段退出 |

UI E2E（Playwright）不进 MVP 门禁，P5 若有时间可加「打开 fixture 工程」。

Windows 上 pytest 输出若被吞，用 `--junitxml=pytest.xml` 再读文件，对齐上游 Qt Test 的教训。

## 提交前自测与推送（强制）

与 [AGENTS.md T11](../../AGENTS.md) 一致。远程 `origin` 为 [https://github.com/Kinvy66/DataWorkbench.git](https://github.com/Kinvy66/DataWorkbench.git)。

- 一个可独立验收的功能，或一个 P0–P5 阶段结束 → 自测绿 → `git commit` → `git push`。
- AI 必须**实际执行**对应测试命令，把结果写进 commit body（如 `自测：uv run pytest … 通过`），不得只声称「应该能过」。
- 无测试框架的文档改动：核对链接后提交，body 注明「仅文档」。
- 测试失败：修复后重新跑；**禁止**带红测试推送。

## 日志

| 通道 | 写哪里 | 内容 |
|------|--------|------|
| sidecar stdout | **仅 JSON-RPC** | 禁止日志 |
| sidecar stderr | 主进程转发 → 日志面板 + `userData/logs/sidecar.log` | 英文技术信息 |
| 主进程 | `userData/logs/main.log` | spawn/重启/ZIP |
| 渲染进程 | 日志面板 | 用户可读；走 i18n |

用户可见失败用 Element Plus `ElMessage`，文案 i18n；细节进日志。不要把 Python traceback 整段作为唯一 UI 文案（可折叠「详情」）。

## i18n

- Vue：`vue-i18n`，源语言 English。key 分层 `ribbon.*` `data.*` `workflow.*`。
- Python 用户消息：RPC `error.i18nKey` + `params`，由前端翻译。sidecar 不要返回中文。
- 节点 `name`、`qualified_name`：**不翻译**。
- 一期可只 en + zh_CN 两份 json，缺 key 显示 English。

## 类型与协议同步

`packages/rpc-types` 手写 TS interface。Python 用 pydantic v2 建同样的 params 模型。字段改名必须同一 PR 改三处：TS、pydantic、本文档 [04-ipc-protocol.md](./04-ipc-protocol.md)。

## 安全

- pickle 导入默认关。
- `data.import` / `export` 路径来自文件对话框；仍要拒绝 `\\?\` 诡异路径与空盘符。一期不做完整 ACL。
- 不执行工作流里的任意 `eval` 节点以外的用户代码；`eval` 节点若移植须限制在 pandas `DataFrame.eval` 并文档警告。
- 无 Agent，故无 `run_code` 工具。若 P5 加脚本工作区，按「用户明示点击运行」处理，与 Agent 自动跑代码分开。

## 发布检查单（P5）

- [ ] `pnpm build` 产物可在干净 Windows 10 上打开
- [ ] Python 依赖锁定 `uv.lock` 或 `requirements.txt`
- [ ] 未打进安装包：测试 csv 大文件、`.env`、上游整个 C++ 仓库
- [ ] NOTICE / LICENSE（含 LGPL vendor 说明）
- [ ] 崩溃：杀 python.exe 后 UI 提示且主窗口仍在

## 给后续 AI 的执行顺序

1. 读本目录 `README.md` → `00` → `05` 当前阶段。  
2. 改协议先改 `04` 与 `rpc-types`。  
3. 移植节点前读 `06` 与上游 `DASystemNodes/AGENTS.md` 陷阱。  
4. 不把 Agent、C++、亿级性能写进当期提交。  
5. 自测通过后立即 commit 并 push `origin`。
