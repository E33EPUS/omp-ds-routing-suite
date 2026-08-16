# 上强度实验包（全自动，omp -p 非交互模式）

2026-08-16。OMP CLI 支持 `-p` 非交互模式（处理消息后退出，工具循环完整、
扩展照常加载）——**E1/E2/E4 全部自动化**，无需手动操作。目录自动创建，
会话落盘到 `~/.omp/agent/sessions/`（--D--bench-*- 目录）。

## E1 互搏因果对照（6 会话，~25 分钟）

**检验**：互搏是深度的副产物，还是推理质量的部分原因。
**任务**：`bench/cart-task.md` + 尾文本（E1 仅有的条件变量）。

| 会话 | 目录 | 尾文本 |
|---|---|---|
| 1, 4 | bench-hes-1, 4 | （无——中性）|
| 2, 5 | bench-hes-2, 5 | `Do not second-guess yourself. Make decisions quickly and commit.` |
| 3, 6 | bench-hes-3, 6 | `Explicitly list candidate approaches, weigh them, and reject the weaker ones before deciding.` |

## E2 任务泛化（4 会话，~25 分钟）

**检验**：锚定 +160% 深度是否任务特异（购物车 → CSV 解析器，任务文本
`bench/parser-task.md`）。

| 会话 | 目录 | 条件 |
|---|---|---|
| a1, a2 | bench-parser-a1, a2 | 插件默认（weak + 锚定 + 引导）|
| b1, b2 | bench-parser-b1, b2 | native（目录内 settings.json `mode: native`）|

## E3 resident 对照（4 会话，手动，需重启 OMP 后）

**检验**：anchored-standard 的 post-promotion regression 警告是否真实。
会话里先 `/dsr-resident on`（或目录 settings 写 `resident: true`）再贴
`bench/cart-task.md`。目录 `D:\bench-res-1..4`。

## E4 长程相关任务链（4 会话，~60 分钟）

**检验**：论文 P21（相关任务链引导负效应）在我们环境是否成立——插件默认
带引导，真实使用场景是长程多轮，单轮结论不能外推。
**方法**：`omp -p @t1.txt … @t8.txt`——8 轮顺序消息（write → fix → extend
→ fix → extend → fix → extend → fix，parser 任务链），同一会话同一 cwd，
每轮可见前轮产出（真实长程，非一次性规划）。
**消息文本**：`bench/run-e4.sh` 内 t1–t8。

| 会话 | 目录 | 条件 |
|---|---|---|
| a1, a2 | bench-e4-a1, a2 | 插件默认 |
| b1, b2 | bench-e4-b1, b2 | native |

**指标**：每轮路由正确性（fix 轮是否先读后改）、8 轮后测试通过数、深度、
互搏——与论文 P21 表（baseline 63% vs deep 46%）对照。

## 运行

```sh
sh bench/run-experiments.sh   # E1 + E2（约 50 分钟）
sh bench/run-e4.sh            # E4（约 60 分钟，建议 E1/E2 之后）
```

每会话产出目录内 `run.log`；完成标志：`done <dir> exit=0` + 目录内有
`cart.js`/`parser.js` + `test.js`。

## 统计（我这边）

- `bench/analyze-thinking.mjs <session.jsonl>` — 深度/互搏/I will/we/let
- `bench/hes-types.mjs <session.jsonl>` — 互搏类型学（weigh/fault/other）
- 断言数：产出 test.js 的 assert 计数
