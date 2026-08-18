# 致谢 + 移植通知（草稿，未提交）

> 用途：发往 https://github.com/yjh051108/dsh-routing-suite/issues
> 状态：草稿，未提交。如需提交，检查以下内容后再发。

---

## 标题

移植致谢 + 实测反馈：omp-ds-routing-suite（OMP 扩展，移植 dsh-routing-suite 的任务路由机制）

## 正文

你好！我们是 omp-ds-routing-suite（Oh My Pi 扩展，https://github.com/E33EPUS/omp-ds-routing-suite），基于你们的工作做的移植，先致谢，再汇报实测发现。

**移植内容**

- 任务感知 persona 路由：weak/spec/react 分类（来自你们 README 的 P8-Flash 路由窗口结论：weak 区 neutral +2.00 / react-weak +4.67 方向，以及显式分类 +5.7 声明）
- 逐轮引导：BASE/COMMIT/DEEP 按任务复杂度分派（第 3 轮起 boost 重分类）
- 融合 dsh-anchored-standard（xiaobright）的首轮工具锚定：首轮 2 工具（bash+edit）+ 纯 persona，首个持久信号（工具调用或文字首答）后恢复全量工具

**实测发现**（2026-08，官方 API，13 组实验，全部机器统计，README 可复现）

1. 锚定是唯一强深度机制：设计密集任务 +160% 思考深度、中密度 +142%、规格确定任务 0%——任务设计密度是调节变量；深度增益 ≠ 完成度增益（两者必须分开报告）
2. 互搏（but wait/等等）是深度指纹不是缺陷：抑制它 → 深度 −55%、完整度 −20%（n=4）；262 标记零断层；密度长程稳定。真实代价是墙钟时间（超线性，0 次 29s → 119 次 220s）——社区观感本质是时间成本直觉，不是质量直觉
3. 轨迹形态由 persona 锁定：语义形态指令（I/we-need 规则）不改变 we 计数（0-3，独立交叉验证）；中文 persona 首轮直注 15/15 锁 we 形态
4. 长程链：插件 vs native +78% 断言（8 轮修复/扩展链），差距主要来自后期轮（native 思考后期变浅，插件保持）
5. 预算决定深度区分度：8K token 直连预算下所有条件饱和（~31K 字符），OMP 64K 预算留出余量（P10 复现：深度区分度需要预算余量，同轨迹区分度需要工具面）
6. 直连时敏：API 模板化前缀（"We need respond to user"）会吞掉形态信号（08-16 晚漂移实测）——时效免责在实践中的应验

**验证了你们的结论**：P8-Flash 的弱 persona 路由窗口在我们环境（Flash + OMP）方向一致；显式分类方向成立。你们论文的"首轮注入拦截是锚定成败关键"（anchored-standard issue#11 同源结论）在我们这复现：注入在场时锚定失败（0/9 → 我们 E1 系列亦见抑制效应）。

**范围**：Windows 11 + OMP + Flash；n=1-4/格，方向性结论；DeepSWE 类权威分数因 API 成本未跑。

再次感谢你们的工作——没有 dsh-routing-suite 和论文的路由窗口分析，我们的扩展不会是这个形状。如果你们感兴趣，README 里有全部实验方法和数据（含双语/时敏声明）。

---
