# 上强度实验包（E1 互搏因果 / E2 任务泛化 / E3 resident 对照）

2026-08-16。全部在 OMP 跑。规矩与消融相同：**空目录 + 新会话 + 首条消息贴任务**
（工作区残留 = 污染，前车之鉴）。

## E1 互搏因果对照（6 会话，~1 小时）

**检验**：互搏是深度的副产物，还是推理质量的部分原因。
**任务**：`bench/cart-task.md` 全文。**目录**：`D:\bench-hes-1` ~ `D:\bench-hes-6`
（每个条件 2 次，每次一个空目录）。

| 会话 | 目录 | 贴任务时末尾追加 |
|---|---|---|
| 1, 4 | bench-hes-1, bench-hes-4 | （无——中性对照）|
| 2, 5 | bench-hes-2, bench-hes-5 | `Do not second-guess yourself. Make decisions quickly and commit.`（抑制互搏）|
| 3, 6 | bench-hes-3, bench-hes-6 | `Explicitly list candidate approaches, weigh them, and reject the weaker ones before deciding.`（鼓励互搏）|

**预期**：若互搏是原因 → 抑制组完成度下降 / 鼓励组上升；若只是副产物 → 三组
完成度无差、互搏数随引导变化。
**跑完把会话目录名报给我**（我机器统计：互搏数/密度、断言数、测试通过）。

## E2 任务泛化（4 会话，~40 分钟）

**检验**：锚定 +160% 深度是否任务特异（购物车 → CSV 解析器）。
**任务**：`bench/parser-task.md` 全文。**目录**：`D:\bench-parser-a1` `a2` `b1` `b2`。

| 会话 | 目录 | 条件 |
|---|---|---|
| a1, a2 | bench-parser-a1, a2 | **插件开**（默认 weak + 锚定 + 引导，settings 默认）|
| b1, b2 | bench-parser-b1, b2 | **native**（会话里先 `/dsr-mode native` 再贴任务）|

**预期**：若锚定效应普遍 → a 组深度显著高于 b 组；若任务特异 → 差异消失。

## E3 resident 对照（4 会话，可选，需先重启 OMP）

**检验**：anchored-standard 的 post-promotion regression 警告是否在我们环境
真实存在（晋升后全量 vs 窄集）。
**前置**：重启 OMP（加载带 `/dsr-resident` 的版本）。
**任务**：`bench/cart-task.md`。**目录**：`D:\bench-res-1` ~ `D:\bench-res-4`。

| 会话 | 目录 | 条件 |
|---|---|---|
| 1, 3 | bench-res-1, 3 | 默认（resident off = 全量放行）|
| 2, 4 | bench-res-2, 4 | 会话里先 `/dsr-resident on` 再贴任务 |

**注意**：/dsr-resident 写入项目 settings.json（生效于下一个锚定阶段）——
先运行命令再贴任务。
**预期**：若回退真实存在 → 全量组晋升后的 thinking 形态/深度劣于窄集组。

## 完成标准

- 每个会话：任务完成 + `node test.js` 全过（E1/E3 购物车 ≥10 断言，E2 解析器
  ≥10 断言）
- 全部跑完报告：各会话目录名 + 是否全过

## 工具（我这边自动统计）

- `bench/analyze-thinking.mjs <session.jsonl>` — 深度/互搏/I will/we/let
- `bench/hes-types.mjs <session.jsonl>` — 互搏类型学（weigh/fault/other）
- `bench/p10-probe.mjs n model` — P10 深收敛复现（直连，自动）
