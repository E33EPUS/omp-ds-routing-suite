# omp-ds-routing-suite

[English](README.md) | [中文](README.zh-CN.md)

面向 DeepSeek V4 Flash 的 Oh My Pi 扩展：首轮工具锚定、任务分类、逐轮近场
引导。移植自 DeepSeek Harness 生态中已实测的机制：

- [yjh051108/dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)
- [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)

本文档所有测量均于 2026-08-16 在 DeepSeek 官方 API（`deepseek-v4-flash`）上
完成

下文所称"论文"指 dsh-router-standard 的论文（随 dsh-routing-suite 套装分发）：
[paper.md](https://github.com/yjh051108/dsh-router-standard/blob/main/docs/paper.md)
与 [experiments.md](https://github.com/yjh051108/dsh-router-standard/blob/main/docs/experiments.md)

## 1. 安装与快速开始

```powershell
# 1. 克隆本仓库后，在仓库根目录执行：
powershell -ExecutionPolicy Bypass -File install.ps1

# 2. 重启 Oh My Pi
```

安装脚本把扩展拷贝到 `~/.omp/agent/extensions/`，若存在冲突的 SeekAnchor
则移动到 `extensions-disabled/`。默认模式为 `weak`，重启后插件即生效

命令（逃生口）：

```
/dsr-mode weak      模型自分类（默认）
/dsr-mode spec      计划先行 persona（维护/读代码类任务）
/dsr-mode react     执行先行 persona（从零构建类任务）
/dsr-mode native    本会话关闭插件
/dsr-status         打印当前模式、persona 与引导状态
```

卸载：

```powershell
Remove-Item -Recurse $env:USERPROFILE\.omp\agent\extensions\omp-ds-routing-suite
```

对话中每条用户消息后出现的 "Router: ..." 行是注入给模型的引导文本，不是
配置提示。

## 2. 机制

**首轮锚定。** 会话首次 `agent_start` 时，活动工具集缩到两个（`bash`、
`edit`）。首个持久工具调用后恢复全量工具（`restoreNativeTools` 合并回原生
工具集）。原理：两工具表面下，模型无法越出当前任务去探索、读写，只能思考；
对思考深度的实测效应见 3.3。

**任务分类。** 移植 dsh-mode-boost 的三档 persona：`weak`（模型自分类，
默认）、`spec`（计划先行）、`react`（执行先行）。persona 文本按模型区分：
Flash 用 `neutral + classify + session anchors + deep-first`，Pro 用
`spec sentence + classify instruction`。第 3 轮起重分类，新任务不被上一轮
风格带偏（防稀释，"boost" 重分类）。

**逐轮引导。** 每条真实用户消息后，扩展在请求尾部追加一条固定引导文本：
短任务给收敛指令，长任务给深度思考指令。引导文本按任务类固定
（BASE / COMMIT / DEEP），对应 dsh-mode-boost 的缓存引导设计。

**为什么不需要注入器。** DSH 的 system 内容走 messages 层加载，所以
dsh-routing-suite 需要注入器 + `suppressedContextSources` 表。Oh My Pi 中
项目 `AGENTS.md` 位于 system 数组，persona 替换就是整槽替换该数组，无需
运行时注入器

## 3. 测量与证据

本节所有数字均由 `bench/` 与 `probe/` 内脚本机器统计（命令见第 5 节）

### 3.1 工具与计数口径

`bench/analyze-thinking.mjs` 读取 OMP 会话 jsonl，对每个 thinking 块统计：

- **深度** —— thinking 块字符数；
- **互搏** —— 自我推翻标记出现次数（`hmm`、`wait`、`hold on`、
  `but wait`），即 dsh-routing-suite 论文所述"双吸引子"互搏；
- **I will / we / let** —— 思维链中对应开头形态的出现次数

`probe/thinking-probe.mjs` 直连 API（Anthropic 端点 `/anthropic`；persona
必须位于顶层 `system` 字段——P6），把每个 thinking 块首行分类为
`we-track`、`let-track`、`hesitate` 或 `other`

本节所有数字受两个限制。其一，样本量：消融每组 n=1，persona 矩阵每格
n=5。其二，单次波动：同一 C1 条件跑两次，thinking 字符数差约 3 万
（66.9K vs 37.6K，见 3.3）。方向性结论在该波动下成立；数值不成立

### 3.2 双语 persona 矩阵（n=5，官方 API）

同一读型 + 写型微任务，三种 persona 各 5 次请求：

| 条件 | we-track | doer (let/other) | hesitate |
|---|---|---|---|
| 基线（无 persona）| 混合 | 混合 | 0 |
| 英文 weak persona | 3/10 | 7/10 | 0 |
| 中文 persona | 15/15 | 0/15 | 0 |

观察：

1. **persona 语言锁定思维形态。** 中文 persona → 15/15 `we-track`，零 doer
   形态、零互搏。英文 weak persona 保留 doer 放行（7/10）。论文实验全为
   英文，此格在其测试范围之外。
2. **system 语言决定思维链语言。** 中文 `AGENTS.md` 产出中文思维链，与
   persona 语言无关；英文 persona 不会强制英文思维链
3. **语言不拦形态。** 两种语言下 `we-track` 盆地都占主导；doer 形态是次级
   吸引子，被中文 persona 抑制
4. **直连 API 零互搏**（更早 n=2x2 一轮 16/16）。互搏只出现在带工具执行
   的会话中（3.3），与论文"区分度需要工具面"一致

对默认配置的后果：插件默认携带论文原版英文 persona；中文人设来自用户自己的
`AGENTS.md`（system 层），插件不覆盖

### 3.3 四组干净从零实验

**设计。** 同一从零任务（实现一个 JavaScript 购物车模块：8 个指定函数 +
≥10 条 `node:assert` 测试断言，任务文本在 `bench/cart-task.md`），每组
独立 OMP 会话、独立空工作目录，各跑一次

| 组 | persona | 锚定 | DEEP 引导 | 深度（字符）| 互搏 | I will | 测试断言数 |
|---|---|---|---|---|---|---|---|
| B —— native 基线 | 无 | 否 | 否 | 32,102 | 28 | 30 | 25 |
| D1 | 无 | 否 | 手动文本 | 34,300 | 40 | 37 | ~29 |
| C1 | weak | 否 | 插件 | 37,757 | 42 | 40 | ~30 |
| A | weak | **是**（2 工具）| 插件 | 97,917 | 117 | 72 | 41 |

四组全部完成任务并通过测试套件。`we`/`let` 计数只记录了 C1（we=1,
let=29）与 D1（we=1, let=34）；B 与 A 会话早于该计数器。断言数是产出完整
度的代理，随深度上升（25 → 41）

结论：

1. **首轮锚定是唯一强机制。** A vs C1：thinking 多 6 万字符（+160%）。
   两工具表面下模型无法越过 `bash`/`edit` 行动，只能思考
2. **DEEP 引导在 Flash 上中性。** D1（手动 DEEP 文本）vs B：+2.2K，在
   ±30K 噪声带内。论文 P30 深度引导 "+12%" 是 Pro 数据；论文自己对 Flash
   的观察（"c-closed ≈ b-directed"）在真实任务上得到证实
3. **weak persona 叠加效应小。** C1 vs D1：+3.5K，在噪声内
4. **互搏与 "I will" 是深度的副产物。** 两者随深度同步上升（28 → 117，
   30 → 72）。它们是长程推理的指纹，不是需要消除的缺陷

### 3.4 与 DSH 论文谱系的对应

| 论断 | 本仓库状态 |
|---|---|
| Flash 在 weak 优于 spec（P11：+5.7 vs −2.0）| 采纳为默认模式选择；未端到端重测 |
| 深度引导对 Flash 中性，P30（"c-closed ≈ b-directed"）| 在真实从零任务上证实（3.3）|
| 锚定引导 we-track 轨迹（dsh-anchored-standard）| 轨迹未重测；深度效应为新发现（3.3）|
| 语言分层（persona 锁形态、system 定语言）| 新发现，超出论文全英文范围（3.2）|
| DSH 用 `suppressedContextSources` 拦截注入 | 架构差异：OMP 整槽替换 system 数组，无需注入器（2）|

### 3.5 "I will" 触发条件（假设，非严格实验）

两个跑分会话中，`The user → Let me → I will` 形态出现在从零复杂任务的
doer 轨迹产出阶段：B 30 次、A 72 次，Flash 可复现。三个条件同时满足：
native 模式（无 persona 形态锁定）、从零任务（无既有路径）、doer 轨迹
（走出 we 盆地）。n=2 会话，按假设对待

## 4. 边界、环境与免责声明

### 4.1 环境（实测范围）

所有测量与跑分会话均运行于 Windows 11 + Oh My Pi（shell：Git Bash）。
DSH、Linux、WSL 未测试。`install.ps1` 仅使用 Windows PowerShell 5.1 基础
cmdlet（`Join-Path`、`Test-Path`、`New-Item`、`Copy-Item`、`Move-Item`、
`Write-Host`），无 PowerShell 7 专属语法

### 4.2 未验证事项

- **Pro 未实测。** 代码按模型名分支，但本仓库没有任何测量数据
- **anchored-standard on Flash（DSH 侧）未实测。** 与
  `suppressedContextSources` 的配合只在 SeekAnchor 源码层面检查过，没跑过
- **样本量小。** 消融每组 n=1，persona 每格 n=5——与论文 n=2–3 同量级
- **单次运行噪声 ±3 万字符** thinking（3.1）
- **resident catalog 未实现。** 首个工具调用后恢复全量工具集；常驻窄目录
  （anchored-standard 的防回归设计）是未来选项
- **相关任务链（论文 P21）未复现**，那里的引导负效应不在范围内

### 4.3 免责声明

- **行为：** 插件修改模型输入（工具集、persona、引导）。与原生 OMP 不同的
  行为——"Router: ..." 行、persona 形态变化——是设计特性，不是缺陷
- **效果：** 除首轮锚定的深度效应（n=1，3.3）外，路由与引导在 Flash 上的
  独立效应在测量噪声内。本文档不做超出第 3 节的效果承诺
- **时效：** 所有测量基于 2026-08-16 DeepSeek 官方 API 快照；模型更新可能
  使其失效
- **质量：** 插件不保证输出质量、正确性、任务成功

## 5. 复现测量

persona 矩阵：

```sh
DEEPSEEK_API_KEY=sk-xxx DEEPSEEK_API_BASE=https://api.deepseek.com/anthropic \
  node probe/thinking-probe.mjs deepseek-v4-flash 3
```

统计某次会话（隔离目录）：

```sh
node bench/analyze-thinking.mjs ~/.omp/agent/sessions/--D--bench-cart-*/<session>.jsonl
```

规程（四组所做之事）：

1. 每组建一个空目录，启动 OMP 会话
2. 把 `bench/cart-task.md` 的任务文本作为首条消息粘贴。
3. 条件变量：persona（无 vs weak）、锚定（关 vs 开）、DEEP 引导（无 vs
   手动尾文本 vs 插件）。
4. 对结果会话 jsonl 跑 `analyze-thinking.mjs`；数产出 `test.js` 的断言数

## 6. 许可证与致谢

MIT。引导文本与 persona 派生自
[yjh051108/dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)
（内含 dsh-mode-boost），致谢
[xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
的锚定机制。
