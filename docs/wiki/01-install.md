# 01 安装与启动

目标：让窗口出现，底部日志出现类似「Sidecar 已就绪」。做不到后面都没法测。

## 电脑需要什么

| 必须有 | 说明 |
|--------|------|
| Windows 10/11（64 位） | 当前主要支持平台 |
| Python **3.11 或 3.12** | 在命令行执行 `py -3.12 --version` 能打印版本。不要用 3.8 |
| 本手册示例表 | 仓库里的 `docs/wiki/samples/wiki-demo.csv` |

可选：Node.js 20 + pnpm（只有走「开发模式」才需要）。

## 方式 A：开发模式（仓库里试）

适合：你已经克隆了 GitHub 仓库，或开发者让你 `pnpm dev`。

1. 打开 PowerShell，进入仓库根目录（有 `package.json` 的那一层，例如 `F:\Rep\DataWorkbench`）。
2. 安装界面依赖：

```powershell
pnpm install
```

3. 安装 Python 计算依赖（推荐用仓库自带虚拟环境；若没有，用系统 Python）：

```powershell
py -3.12 -m pip install -r python/requirements.txt
```

4. 启动：

```powershell
pnpm dev
```

5. **不要**用浏览器打开 `http://localhost:5173`。必须等 Electron 窗口自己弹出。
6. 看窗口**底部「日志」**：出现「Sidecar 已就绪」且提到 `pandas` 为真，才算成功。
7. 顶部 **主页** 有 **Ping** 时，点一下。日志应出现 `host.hello 成功`。

关掉窗口即可退出。再开仍执行 `pnpm dev`。

`spawn electron.exe ENOENT` 等开发环境问题见根目录 [README.md](../../README.md)，一般用户改走方式 B。

## 方式 B：便携目录（不装安装包）

适合：别人给了打好的 `win-unpacked` 文件夹。

1. 确认本机有 Python 3.11/3.12。
2. 打开产物目录：`apps/dist/win-unpacked/`（开发者可用 `pnpm pack:portable` 生成）。
3. 安装 sidecar 依赖（只需做一次）：

```powershell
py -3.12 -m pip install -r apps\dist\win-unpacked\resources\python\requirements.txt
```

4. 双击 `DataWorkbench.exe`。
5. 同样看底部日志是否「Sidecar 已就绪」。

若系统里 Python 不在默认路径，启动前设置：

```powershell
$env:DW_PYTHON = "C:\Path\To\python.exe"
```

然后再开 `DataWorkbench.exe`。

当前**没有**「下一步下一步」的安装向导，也不会把 Python 打进软件里。

## 启动自检（30 秒）

- [ ] 窗口可见（标题栏有软件图标，顶部有「文件 / 主页 / 数据 …」）。
- [ ] 底部日志有就绪信息，没有一直停在报错。
- [ ] 点 **主页 → Ping**（若有），日志成功。
- [ ] 不要在 Chrome 里打开 Vite 地址（否则会提示「桌面桥接未加载」）。

失败先看 [10 常见问题](./10-faq.md)。通过后去做 [08 15 分钟跟做](./08-tutorial.md)。
