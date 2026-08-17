# OMP Discussion Post — omp-ds-routing-suite

Publish at: https://github.com/can1357/oh-my-pi/discussions/new?category=show-and-tell

Category: Show and tell

---

## Title

omp-ds-routing-suite — first-turn anchoring + task routing for DeepSeek V4 Flash, with measured evidence

## Body

Omp extension for DeepSeek V4 Flash: first turn = 2 tools + pure persona (+ safety rules), full catalog after the first durable signal; weak/spec/react modes with per-turn guidance. Ported from dsh-router-standard / dsh-mode-boost mechanisms.

**Install**

```
/marketplace add E33EPUS/omp-ds-routing-suite
/marketplace install omp-ds-routing-suite@omp-ds-routing-suite
```

GitHub: https://github.com/E33EPUS/omp-ds-routing-suite (v0.1.1, bilingual README, 13 experiment groups, all reproducible)

**Key measured findings** (official API, machine-counted)

1. Anchoring is the only strong depth mechanism: +160% depth on design-heavy tasks, 0% on spec-determined ones — design density is the moderator. Depth ≠ completeness.
2. Hesitation is a depth fingerprint, not a defect: inhibiting it lowers depth −55% and completeness −20% (n=4); its real cost is wall time (superlinear, up to 7.6×) — the community intuition is a time-cost one, not a quality one.
3. Trajectory form is persona-locked (semantic instructions don't change it); long chains: plugin +78% assertions vs native, gap widening in late turns.

**Scope**: Windows 11 + OMP only; n=1-4 (directional); DeepSWE-class scores not run (API cost).

MIT. Credits: dsh-router-standard / dsh-mode-boost (yjh051108), dsh-anchored-standard (xiaobright).

---

**中文摘要**：DeepSeek V4 Flash 的 OMP 扩展：首轮 2 工具 + 纯 persona，首个持久信号后全量恢复；weak/spec/react 三档 + 逐轮引导。实测 13 组实验：锚定是唯一强深度机制（设计密集任务 +160%）；互搏是深度指纹不是缺陷（抑制它深度 −55% 完整度 −20%），真实代价是时间（超线性）；形态由 persona 锁定；长程链 +78% 断言。仅 Windows 11 + OMP 实测。
