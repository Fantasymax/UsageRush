# UsageRush

[English](README.md) | **简体中文**

按**你**选定的时间表，维持 **Claude** 和 **Codex** 的用量窗口。

订阅版 CLI（Claude Code、Codex）用**滚动的 5 小时窗口**计量：窗口从你的**第一条消息**开始，5 小时后刷新。如果你总是想起来才用，刷新时刻就会无规律地漂移，没用到的窗口也白白浪费。

UsageRush 在每次刷新**之后**发一条极短的 “ping”，让下一个窗口在**可预测、好记的钟点**开启，而不是等你下次出现才开。它只在你**空闲**时填补空档——当你正在用某个工具时，你自己的活动已经维持着窗口，UsageRush 不会插手。

> 状态：**v0.1** — Windows（Task Scheduler）+ Claude 已完成并经作者实跑。macOS（launchd）和 Linux（cron）已实现但为 **beta**（作者未实测，欢迎反馈）。Codex 已接入（5h 窗口已确认）且**默认关闭**：它的 `codex exec` ping 会消耗你的 Codex **周**限额，仅在有周额度余量时再开。

## 工作原理

- **滚动窗口检测**：UsageRush 读取你的 CLI 本来就写在会话日志里的时间戳（`~/.claude/projects/**/*.jsonl`、`~/.codex/sessions/**/*.jsonl`），算出当前窗口何时刷新——不抓屏、不需要 API key。
- **无状态 tick**：你的操作系统调度器每隔几分钟跑一次 `usagerush tick`。每次运行判断是否该 ping、该则 ping、自检、退出。没有常驻进程会崩；重启和休眠都由操作系统调度器兜底。
- **刷新之后才发**：ping 落在刷新点**之后**一个小缓冲（默认 90 秒），绝不提前——这样 ping 明确是新窗口的第一条消息，干净地锚定它。

### 两种模式（每个 provider 独立）

| 模式 | 你得到什么 | 代价 |
|------|-----------|------|
| **fixed**（默认） | 刷新点落在**每天相同的钟点**（如 `09:00 / 15:00 / 21:00 / 03:00`）。可预测、好规划。 | 每个窗口约 1h 空档（5h 窗口放在 6h 网格上）。 |
| **chain** | 背靠背窗口，覆盖最大化（约 4.8 个/天）。 | 刷新时刻**每天漂移约 +1h**（5h 除不尽 24h）。 |

因为 5 小时窗口无法整齐铺满 24 小时一天，你得二选一。`usagerush setup` 会在你确认前，把算出来的刷新表显示给你看。

### 当你自己的使用“抢占”了锚点

如果锚点时刻到来时你正在用 Claude，是**你的**消息开启了窗口，不是我们的 ping。这没问题：你有一个活窗口，只是没落在锚点钟点上。UsageRush **不会**冗余 ping、也不会唠叨；它会显示真实的时间表，并在你下一个空闲的锚点自动拽回网格。`usagerush status` 始终会打印“假设你此后空闲”的刷新投影，包括何时收敛回网格。

## 安装

**一行，免克隆**（需要 Node >= 18）：

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Fantasymax/UsageRush/master/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/Fantasymax/UsageRush/master/install.ps1 | iex
```

或者从源码 / npm：

```sh
git clone https://github.com/Fantasymax/UsageRush.git && cd UsageRush && npm link
# （发布到 npm 后）npm install -g usagerush
```

需要 Node.js >= 18，以及你想保活的 provider CLI（`claude`、`codex`）已安装并登录。UsageRush 本身零依赖、无需构建——纯 Node。

## 快速开始

```sh
usagerush setup        # 检测窗口，选模式+锚点，看刷新表
usagerush install      # 安排定时 tick（加 --no-login 用免登录任务；需管理员）
usagerush status       # 窗口、刷新表、空闲投影、近期 ping
usagerush doctor       # 自检 + 自愈 + 需你处理的事项
```

非交互（脚本 / CI）：

```sh
usagerush setup --provider claude --mode fixed --anchors 09:00,15:00,21:00,03:00 --enable --yes
usagerush install --interval 5
```

> ### ⚠️ Codex 为实验性，且默认关闭
> Codex 的保活 ping（`codex exec`）会跑一个真实回合，计入你的 Codex **周**限额——且有报告称单条 Codex prompt 可能吃掉周预算中相当一块。所以按计划自动 ping Codex，可能比你预想的更快烧光周额度。
>
> **仅在有周额度余量时**才启用，然后盯住你的用量（Codex TUI 里的 `/status`）。随时可调小或关闭：
> ```sh
> usagerush setup --provider codex --anchors 09:00,21:00 --yes   # 更少 ping（2 次/天）
> usagerush setup --provider codex --disable --yes               # 关闭
> ```
> Claude 的 ping 只几分钱，相比之下可忽略。

## 命令

| 命令 | 说明 |
|------|------|
| `setup` | 向导（或用 flags）配置 provider、模式、锚点。 |
| `install` / `uninstall` | 添加/移除操作系统调度 tick。`--no-login` 用 S4U 任务（Windows，需管理员），无人登录也运行。 |
| `tick` | 跑一次引擎（调度器调用的就是它）。`--force` 立即 ping。 |
| `ping` | 立即为所有启用的 provider 强制 ping 一次。 |
| `status` | 只读：健康、刷新表、投影。 |
| `doctor` | 诊断漏刷/漂移/认证问题，自愈，汇总。 |

## 配置

一切都在 `~/.usagerush/` 下（可用 `USAGERUSH_DIR` 覆盖）：

- `config.json` — tick 间隔、buffer、每个 provider 的模式/锚点/窗口、通知。
- `state-<provider>.json` — 上次 ping、检测到的窗口、近期 ping 环形缓冲。
- `usagerush.log` — 滚动活动日志。

诊断会静默自愈；只有**需要你出手**时（如某 provider 登录失效）才弹一个跨平台桌面通知。

## 隐私与安全

UsageRush 从不硬编码机器路径或凭据——它在运行时解析你的 home 目录，只读取你本来就有的日志里的时间戳。Ping 走你已认证的 CLI（你的订阅），不用裸 API key。一次 ping 花几分钱、开启/维持一个窗口；这就是它的全部足迹。

## 平台支持

| 系统 | 调度 | 状态 |
|------|------|------|
| Windows | Task Scheduler（含 S4U 免登录） | ✅ |
| macOS | launchd LaunchAgent | ✅ beta（作者未实测，欢迎反馈） |
| Linux | cron | ✅ beta（作者未实测，欢迎反馈） |

> macOS 说明：LaunchAgent 在你登录时运行。真正的免登录需要 LaunchDaemon（root），不会自动安装。
>
> Linux 说明：cron 条目通过 cron 守护进程运行，与是否登录无关（需安装并运行 `cron`）；`usagerush install` 会编辑你的用户 crontab 并保留你的其他条目。

## 许可证

MIT © FantasyMax
