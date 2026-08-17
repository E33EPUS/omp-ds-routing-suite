# OMP Discussion Post — omp-ds-routing-suite

Publish at: https://github.com/can1357/oh-my-pi/discussions/new?category=show-and-tell

Category: Show and tell

---

## Title

omp-ds-routing-suite — first-turn anchoring + task routing for DeepSeek V4 Flash, with measured evidence

## Body

An omp extension that gives DeepSeek V4 Flash a two-tool anchored first turn, model self-classification (weak/spec/react), and per-turn guidance — ported from the measured mechanisms of dsh-router-standard / dsh-mode-boost, with our own evidence base.

**Install**

```
/marketplace add E33EPUS/omp-ds-routing-suite
/marketplace install omp-ds-routing-suite@omp-ds-routing-suite
```

- GitHub: https://github.com/E33EPUS/omp-ds-routing-suite (v0.1.1, bilingual README + CHANGELOG)

**What it does**

- Request #1: two tools (bash + edit), pure persona + first-turn safety rules (no credential reads / destructive ops); AGENTS.md stripped per anchored-standard lever 3; full catalog restored after the first durable signal (tool call or text reply, promote-on-either).
- weak/spec/react modes with model-matched personas (Flash: neutral + classify; Pro: spec + classify), boost reclassification from round 3, BASE/COMMIT/DEEP guidance per task complexity.
- /dsr-mode, /dsr-status, /dsr-resident commands; headless benchmark runners (omp -p) in bench/.

**Measured findings** (2026-08-16/17, official API, machine-counted, all in README):

1. **Anchoring is the only strong depth mechanism**: +160% thinking depth on design-heavy greenfield tasks (cart), +142% on medium-density (md2html), 0% on spec-determined (CSV) — task design density is the moderator (E2/E5). Depth gain != completeness gain (must be reported separately).
2. **Hesitation is a depth fingerprint, not a defect**: inhibit tails lower depth −55% and completeness −20% (n=4); zero fault-line hesitations across 262 markers (typology); density is stable across long chains (never rises). The real cost is wall time: superlinear (29s at 0 hesitations → 220s at 119) — the community intuition is a time-cost intuition, not a quality one.
3. **Trajectory form is persona-locked**: semantic form instructions (I/we-need rules from an external control suite) do not change Flash's we-count (0-3) — independent cross-check (F1). Bilingual matrix: Chinese persona locks we-form 15/15; system language sets chain language.
4. **Long chains**: plugin +78% tested assertions vs native (8-turn fix/extend chain, E4-R); the gap widens in late turns (native thinking shallows out, plugin holds).
5. **Budget governs depth discrimination**: on an 8K-token direct budget all conditions saturate (~31K chars); OMP's 64K budget leaves headroom — depth discrimination needs budget headroom, like trajectory discrimination needs a tool surface (P10 reproduction).
6. Direct-API drift note: template-prefixed thinking flattened form classification on 08-16 evening; OMP sessions unaffected — timeliness disclaimer validated in practice.

**Scope** (README section 4): Windows 11 + OMP only; DSH/Linux/WSL untested; Pro half-measured; n=1-4 per cell (directional claims only); authoritative benchmark scores (DeepSWE etc.) not run (API cost).

MIT. Ported mechanisms credit dsh-router-standard / dsh-mode-boost (yjh051108) and dsh-anchored-standard (xiaobright). Feedback welcome.

---

**中文摘要**：给 DeepSeek V4 Flash 的两阶段锚定 + 任务路由 OMP 扩展（首轮 2 工具 + 纯 persona + 安全红线，首持久信号后全量恢复；weak/spec/react 三档 + 逐轮引导）。实测 13 组实验（全部机器统计入 README）：锚定是唯一强深度机制（设计密集任务 +160%，三任务梯度 2/3 稳健）；互搏是深度指纹不是缺陷（抑制它深度 −55% 完整度 −20%），真实代价是时间（超线性 7.6×）——社区观感是时间成本直觉不是质量直觉；轨迹形态由 persona 锁定（语义指令无效，独立交叉验证）；长程链插件 +78% 断言（差距主要来自后期轮——native 后期思考变浅，插件保持）。范围：仅 Windows 11 + OMP 实测；n 小方向可信；权威跑分（DeepSWE 等）因 API 成本未跑。
