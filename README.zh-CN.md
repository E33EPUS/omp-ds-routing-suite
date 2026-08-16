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

**速览。** 装完（第 1 节）直接用：插件自动分类任务、首轮锚定两工具、逐轮注入
引导。Flash 实测（2026-08-16，官方 API）：首轮锚定是唯一强深度机制
（设计密集从零任务 +160%，3.3、E2）；随附 DEEP 尾文本在其上中性（3.3），
而行为类引导尾文本（抑制/鼓励互搏，E1）强烈影响深度与完整度。仅 Windows
11 + OMP（4.1）。证据见第 3 节

## 1. 安装与快速开始

```powershell
# 1. 克隆本仓库后，在仓库根目录执行：
powershell -ExecutionPolicy Bypass -File install.ps1

# 2. 重启 Oh My Pi
```

安装脚本把扩展拷贝到 `~/.omp/agent/extensions/`，若存在冲突的 SeekAnchor
则移动到 `extensions-disabled/`。默认模式为 `weak`，重启后插件即生效

命令（高级选项，日常不需要——默认配置开箱即用）：

| 命令 | 作用 | 什么时候用 |
|---|---|---|
| （默认）| weak：模型自己判断任务类型（build 直接干 / fix 先查）| 永远——默认就够 |
| `/dsr-mode spec` | 计划先行 | 维护/读代码类任务，想先看方案 |
| `/dsr-mode react` | 执行先行 | 从零大项目，想直接写 |
| `/dsr-mode native` | 完全关闭插件 | 对比实验 / 想用原生行为 |
| `/dsr-resident on` | 第二轮起只留 4 个工具 | 不建议——E3 实测无差异 |
| `/dsr-status` | 查看模式/persona/引导状态 | 想确认插件在做什么 |

卸载：

```powershell
Remove-Item -Recurse $env:USERPROFILE\.omp\agent\extensions\omp-ds-routing-suite
```

对话中每条用户消息后出现的 "Router: ..." 行是注入给模型的引导文本，不是
配置提示

### Linux / macOS（手动安装）

扩展就是普通目录，手动拷贝：

```sh
mkdir -p ~/.omp/agent/extensions/omp-ds-routing-suite
cp index.ts core.ts state.ts commands.ts tools.ts \
  ~/.omp/agent/extensions/omp-ds-routing-suite/
# 若装了 SeekAnchor：
mv ~/.omp/agent/extensions/deepseek-rl-anchor \
  ~/.omp/agent/extensions-disabled/
```

Linux/macOS 未实测（4.1）；运行时无平台相关代码。`install.ps1` 面向
Windows PowerShell（5.1+）；Linux 的 PowerShell Core 不设 `$env:USERPROFILE`，
请用手动步骤

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

指标可比性：论文的 lexicon 口径——首行形态分类（minimal-like /
standard-like / ambiguous）、每块 we/letMe 比例、planScore（we − letMe）、
`Interesting` 晋升瞬态、收敛率——**未**在消融会话中复现。我们的计数
（深度字符、互搏标记、词频）用的是另一把尺子。3.2–3.3 的数字彼此可比，
**不与论文表格直接可比**；凡映射到论文实验的论断，3.4 会明确说明

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

时效注记（2026-08-16 晚）：n=10 复测遇直连 API 漂移——所有条件（含纯基线）
产出模板化开头（"We need respond to user…"），形态判别被吞平。n=5 与
n=10 不可比；OMP 会话的 thinking（3.3、E1/E2）未漂移。直连形态分类是
时敏的（4.3 时效免责在实践中应验）

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
   A 的首个 thinking 块单块 97.9K 字符（约 2.45 万 tokens，远低于 OMP 的
   64K 预算，4.1）：两工具表面下模型无法行动，持续推理直到信息完备
2. **DEEP 引导无独立效果。** D1（手动 DEEP 文本）vs B：+2.2K，在
   ±30K 噪声带内。范围：B 的 32.1K 是自愿收敛点，不是预算上限——OMP
   thinking 预算为 64K tokens（models.yml `maxTokens`），A 单块达到
   2.45 万 tokens。本 README 早期版本称 B 匹配论文预算耗尽上限
   （P10：32.5K）——那是数字巧合（论文的 32.5K 来自 8K token probe
   预算，机制不同，见 3.7）
3. **weak persona 叠加效应小。** C1 vs D1：+3.5K，在噪声内
4. **互搏与 "I will" 是深度的副产物。** 两者随深度同步上升（28 → 117，
   30 → 72）。它们是长程推理的指纹，不是需要消除的缺陷

### 3.4 与 DSH 论文谱系的对应

| 论断 | 本仓库状态 |
|---|---|
| Flash 的弱 persona 区是路由窗口（P8-Flash：neutral +2.00、react-weak +4.67 判别）| 采纳为默认模式；未端到端重测 |
| deep-react 从低基线使 Flash 深度翻倍，P10（9.7K → 18.4K，100% 收敛）| 未复现——8K 预算直连下所有条件全部吃满预算（3.7）；翻倍依赖论文的 react persona 文本提前收敛，与我们的 persona 文本不同 |
| 锚定引导 we-track 轨迹（dsh-anchored-standard）；Flash 轨迹层对目录免疫（论文 §5.2）| 轨迹未重测；深度效应（3.3）是另一维度——目录改深度、不改形态 |
| 语言分层（persona 锁形态、system 定语言）| 新发现，超出论文全英文范围（3.2）|
| DSH 用 `suppressedContextSources` 拦截注入 | 架构差异：OMP 整槽替换 system 数组，无需注入器（2）|

### 3.5 "I will" 触发条件（假设，非严格实验）

两个跑分会话中，`The user → Let me → I will` 形态出现在从零复杂任务的
doer 轨迹产出阶段：B 30 次、A 72 次，Flash 可复现。三个条件同时满足：
native 模式（无 persona 形态锁定）、从零任务（无既有路径）、doer 轨迹
（走出 we 盆地）。n=2 会话，按假设对待

### 3.6 与上游实现的移植差异

我们的移植与 dsh-anchored-standard 有四处已记录差异：

| 上游（dsh-anchored-standard）| 我们 | 后果 |
|---|---|---|
| bootstrap 工具对：`bash` + `str_replace_editor`（Minimal 逐字节一致）| `bash` + `edit`（OMP 的 Anthropic 系 edit 工具）| 论文 B1（minimal + edit）2/2 锚定；非逐字节一致 |
| 晋升：首次持久 `tool/call` **或** `assistant/message`（`promoteOn: either`）| 2026-08-16 起一致（纯文字首答也在请求 #2 晋升）| 已对齐 |
| 晋升后目录：resident 集（bootstrap 对 + 发现工具 + 已解锁；重型工具一次 `dev_tool_search` 取用）| 晋升时恢复全量目录 | 上游"晋升后回退"警告适用（倒出完整目录会把轨迹拉回 standard-like）；我们的深度效应（3.3）在全量恢复下测得，晋升后轨迹形态未计数 |
| bootstrap 上下文：只剥离 `agent-instructions` + `skill-catalog`，保留 Minimal persona system | 首轮整槽替换 system 数组为插件 persona；放行后恢复新鲜原生 system（`AGENTS.md` 等）| 比上游更激进；放行后保留用户记忆/AGENTS.md（这也是此前全替换记忆丢失 bug 的修复方式）|

输出预算杠杆（`bootstrapMaxTokens`）未使用；工具 schema 杠杆与注入剥离
杠杆均已生效

### 3.7 P10 复现：固定预算下的深收敛（2026-08-16）

直连 API 复现论文 L 表条件（Anthropic 端点，thinking 开启，预算 8000
tokens，`max_tokens` 8192，购物车任务，每条件 n=3）：

| 条件 | 深度（字符）| finish |
|---|---|---|
| react | 31,943 / 32,056 / 30,264 | max_tokens ×3 |
| deep-react（react + "think deeply first, then produce"）| 31,355 / 31,790 / 31,455 | max_tokens ×3 |
| deep1（"think deeply"）| 31,408 / 29,974 / 30,796 | max_tokens ×3 |
| deep2（两阶段）| 30,031 / 31,348 | max_tokens ×2 |

所有条件全部吃满 8K token 预算（约 3.1 万字符）；persona 与引导文本对
深度的影响 <1%。两点后果：

1. **固定小预算下，深度由预算决定，不由条件决定。** 论文的 deep-react
   翻倍（9.7K → 18.4K）测自 API 自身 8192 `max_tokens` + 提前收敛的
   react persona；我们移植的 react persona 文本不提前收敛，所有条件
   撞同一上限。翻倍是 persona 文本特性，不是"think deeply"句子本身
2. **OMP 会话消融（3.3）与此扫描不可比。** OMP thinking 预算 64K
   tokens（4.1）；条件差异（32K → 98K）只在预算有余量时可见。8K
   预算下所有条件饱和、差异消失——深度区分度需要预算余量，正如轨迹
   区分度需要工具面（论文 §5.2）

Pro 半程（n=2，同预算，2026-08-16）：react ≈29.4K vs deep-react ≈31.0K
（finish max_tokens ×2）；上游自己的 Pro deep-converge 扫描仍未完成，
我们的 n=2 不足以对 Pro 下结论

### 3.8 因果、泛化、长程（2026-08-16 晚）

`omp -p` 无头运行（非交互 OMP 会话，扩展照常加载——诊断日志证实；
会话落盘 `~/.omp/agent/sessions/`）

**互搏类型学。** `bench/hes-types.mjs` 按上下文把每个互搏标记分类为
方案比较（weigh）、we 盆地内断层反转（fault）或其他。四个消融/跑分
会话（A、污染 A、C1、D1；共 262 个标记）的 fault 类计数为**零**——
论文的"断层"互搏在 Flash 从零任务中从不出现；Flash 的互搏全在 doer
轨迹上做方案比较。Flash 的互搏是决策权衡，不是轨迹不稳定

**E1——互搏因果（每引导 n=4）。** 同一购物车任务，插件默认（weak +
锚定 + 引导），只变尾文本：

| 组 | 尾文本 | 深度 | 互搏 | 密度(/K) | 测试数 |
|---|---|---|---|---|---|
| 中性 | （无）| 77.0K / 35.2K / 24.4K / 7.9K | 119 / 27 / 18 / 7 | 1.55 / 0.77 / 0.74 / 0.89 | 20 / 19 / 21 / 10 |
| 抑制 | "Do not second-guess…commit." | 0.8K / 26.9K / 6.0K / 31.9K | 0 / 12 / 2 / 45 | 0 / 0.45 / 0.33 / 1.41 | 13 / 16 / 15 / 12 |
| 鼓励 | "List candidates, weigh, reject…" | 38.4K / 36.4K / 36.5K / 41.0K | 59 / 33 / 21 / 21 | 1.54 / 0.91 / 0.58 / 0.51 | 10 / 21 / 17 / 20 |

均值（中性/抑制/鼓励）：深度 36.1K / 16.4K / 38.1K；互搏 42.8 / 14.8 /
33.5；I will 38.0 / 12.3 / 40.5；测试 17.5 / 14.0 / ~17.0。**抑制互搏在
n=4 下四项全降**（深度 −55%、互搏 −65%、I will −68%、测试 −20%）——
互搏不是可移除的噪音。鼓励 vs 中性无稳定差异。组内波动仍大（±35K），
但抑制 vs 中性方向在全部 4 个样本中一致

**E2——任务泛化（n=2）。** 同条件换 CSV 解析器任务（规格确定：
parse/toCSV/引号规则，设计歧义小）：

| 组 | 深度 | 互搏 | 断言 |
|---|---|---|---|
| 插件（weak+锚定+引导）| 16.0K / 42.7K | 13 / 47 | 20 / 25 |
| native | 31.8K / 28.7K | 36 / 54 | 26 / 17 |

锚定效应（购物车 +160%，3.3）**未复现**：均值 29.4K vs 30.3K。购物车有
设计歧义（discount/coupon 语义、快照独立性），解析器规格确定——
**任务设计密度是锚定效应的调节变量**（与论文 P2"简单任务饱和"同构）。
+160% 声明范围收窄到设计密集的从零任务

**E3——resident 目录对照（n=4）。** 购物车任务，插件默认；变量：晋升后
目录 = 全量 vs 窄集（`/dsr-resident on` / settings `{"resident": true}`，
诊断日志证实：`restoreNativeTools resident -> [bash,edit,read,write]`）：

| 会话 | 晋升后目录 | 深度 | 互搏 | 测试/断言 |
|---|---|---|---|---|
| res1 / 2 / 5 / 6 | 全量（off）| 20.5 / 37.8 / 12.6 / 39.7K | 35 / 32 / 10 / 31 | 25 / 27 / 19 / 10 |
| res3 / 4 / 7 / 8 | 窄集（on）| 13.9 / 73.1 / 34.0 / 9.6K | 4 / 90 / 26 / 7 | 38 / 38 / 17 / 10 |

早期 n=2 读数曾声称窄集完整度优势（38 vs 25/27，+46%）。**n=4 撤回该
结论**：新增样本（on 17/10 vs off 19/10）方向相反，且各会话 test.js
报告口径不同（断言数 vs 测试数 vs checks），数字跨会话不可比。8 个
会话全部完成任务并通过测试。深度（27.7K vs 32.7K）与互搏（27 vs 32）
在 n=4 下无稳定差异

**E4——长程相关任务链（论文 P21 设计）。** 解析器任务 8 轮顺序
（write → fix → extend → fix → extend → fix → extend → fix），插件 vs
native 各 n=2。跑了两个变体：初版批处理（8 条消息合入单请求——有混杂：
模型看到未来指令与前轮代码）与干净逐轮重跑（E4-R：每轮独立进程、同
cwd、冷启动、必须读磁盘）。批处理版作废，采用 E4-R：

| 链 | 条件 | 每轮深度 | read 类调用 | 断言 |
|---|---|---|---|---|
| a1 / a2 | 插件 | 32K / 50K | 38% / 42% | 106 / 102 |
| b1 / b2 | native | 23K / 18.5K | 55% / 53% | 57 / 60 |

干净条件下：插件链读得更少（40% vs 54%）、每轮想得更深（+75%）、
断言近乎翻倍（104 vs 58.5，+78%）。论文 P21 方向（引导降读连续性）
复现；"相关链引导为负"未在产出层面复现。机制 = think-then-targeted-
read：深度引导用推理替代探索式工具使用。注意指标与论文不同
（修复轮成功率 vs 断言数）

## 4. 边界、环境与免责声明

### 4.1 环境（实测范围）

所有测量与跑分会话均运行于 Windows 11 + Oh My Pi（shell：Git Bash）。
OMP 模型配置（`models.yml`）经 `maxTokens: 65536` + `defaultThinkingLevel:
max` 设定 thinking 预算为 64K tokens——所有实测 thinking 块均远未触及
（最深为 A 首块约 2.45 万 tokens，3.3）。DSH、Linux、WSL 未测试。
`install.ps1` 仅使用 Windows PowerShell 5.1 基础 cmdlet（`Join-Path`、
`Test-Path`、`New-Item`、`Copy-Item`、`Move-Item`、`Write-Host`），无
PowerShell 7 专属语法

### 4.2 未验证事项

- **Pro 仅半程。** 代码按模型名分支；唯一 Pro 数据是 P10 复现半程（n=2，3.7）
- **anchored-standard on Flash（DSH 侧）未实测。** 与
  `suppressedContextSources` 的配合只在 SeekAnchor 源码层面检查过，没跑过
- **样本量小。** 消融 n=1（3.3），E1/E2/E3/E4 n=2（3.8）——与论文 n=2–3 同量级
- **单次运行噪声 ±3 万字符** thinking（3.1）；E3 组内波动达 ±6 万
- **resident 模式已实现但默认关**（`/dsr-resident on`）；E3 n=4 显示窄集与
  全量在深度/互搏/完成度上无显著差异（早期 n=2 的 +46% 已撤回）
- **论文 P21 原样（逐轮交互会话）未复现**；E4-R 测的是逐轮独立进程（3.8），
  引导未损害产出

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

MIT

引导文本与 persona 派生自
[yjh051108/dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)（内含 dsh-mode-boost）

致谢
[xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
的锚定机制。
