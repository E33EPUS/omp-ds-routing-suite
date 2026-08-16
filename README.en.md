# omp-ds-routing-suite

[English](README.en.md) | [中文](README.md)

DeepSeek reasoning-mode routing suite for Oh My Pi. Install and forget: the
Flash model gets efficient thinking chains automatically, tasks classify
themselves, zero configuration.

A port of the measured mechanisms from dsh-router-standard / dsh-mode-boost
(P1-P30, official API). Tuned for DeepSeek V4 Flash (Pro is auto-detected).

## Install (30 seconds)

```powershell
# 1. Clone this repo, then in the repo root:
powershell -ExecutionPolicy Bypass -File install.ps1

# 2. Fully quit OMP (not /reload), reopen
```

> The installer copies the extension to `~/.omp/agent/extensions/` and disables
> a conflicting SeekAnchor if present. Defaults to weak routing mode; start
> using it directly.

## What it does automatically (nothing to manage)

| Mechanism | Effect |
|---|---|
| Task self-classification | Each task is classified by the model itself: build (do directly) or fix (investigate first) |
| First-turn anchoring | First turn exposes only 2 core tools; full tools restored after the first tool call |
| Proximal guidance | One guidance line injected per message: converge fast on simple tasks, think deep on complex ones |
| Re-classification from turn 3 | A new task is not carried by the previous turn's style |
| Per-model adaptation | Flash / Pro get different personas and guidance strategies |

**Seeing "Router: ..." lines in your chat is normal** — automatic instructions
for the model (classify and converge), not config prompts. Ignore them.

## Optional commands (escape hatches, not needed daily)

```
/dsr-mode weak      model self-classification (default)
/dsr-mode spec      plan-first (maintenance / reading tasks)
/dsr-mode react     act directly (greenfield build tasks)
/dsr-mode native    fully disable this extension
/dsr-status         show current state
```

When to switch: greenfield large projects → `/dsr-mode react`; otherwise weak
is fine.

## Uninstall

```powershell
Remove-Item -Recurse $env:USERPROFILE\.omp\agent\extensions\omp-ds-routing-suite
# To restore SeekAnchor (if it was disabled): move extensions-disabled\deepseek-rl-anchor back to extensions\
```

## Layout

- `core.ts` — pure routing logic (classification / persona / guidance text / bands), zero deps
- `state.ts` — session state + settings persistence
- `index.ts` — OMP extension entry (session / input / pre-request / tool-result hooks)
- `commands.ts` / `tools.ts` — escape-hatch commands and self-diagnosis tools
- `tests/` — 22 unit + integration tests (`npm test`)
- `install.ps1` — one-click installer

## Thinking-chain measurement (probe)

Reproduces the paper's We/Let trajectory measurement: the same micro-tasks
(read-type + build-type) run n times under spec / weak / react personas,
classifying each thinking-chain head (we-track / let-track / hesitate / other):

```sh
DEEPSEEK_API_KEY=sk-xxx DEEPSEEK_API_BASE=https://api.deepseek.com/anthropic \
  node probe/thinking-probe.mjs deepseek-v4-flash 3
```

- Bridge endpoint: point `DEEPSEEK_API_BASE` at your bridge; baseUrl containing
  `/anthropic` switches to the Anthropic Messages format (persona in the top-level
  `system` field — position matters, P6)
- **Flash results (2026-08-16, n=2x2 tasks)**: 16/16 requests with zero
  `hesitate`; we-track dominates (Flash's spec basin is wide); react
  differentiation only in a few samples — discrimination needs a tool surface
  (paper's react 10/10 was measured with tool execution)
- **Bilingual (2026-08-16, n=5)**: English weak persona → doer deep-release
  7/10; **Chinese persona locks the form, 15/15 all-We (zero doer, zero
  hesitate)** — a blind spot of the paper's all-English testing. Thinking-chain
  language is set by the system language (not the persona): Chinese AGENTS.md →
  Chinese chains. Default keeps the paper's English persona; Chinese persona
  comes from OMP's native system injection
- `hesitate` ("but wait" self-reversal) is a fault-band fingerprint; its
  presence is abnormal
- Experimental tool needing a real API key; not part of CI

## Ablation study (2026-08-16, four clean greenfield runs)

Same greenfield cart task, machine-counted with one ruler
(`bench/analyze-thinking.mjs`), each condition in its own session (empty
workspace, contamination-free):

| Group | persona | First-turn anchor | DEEP guide | Thinking depth | Hesitations | I will |
|---|---|---|---|---|---|---|
| B (native baseline) | none | no | no | 32.1K | 28 | 30 |
| D1 | none | no | yes, manual text | 34.3K | 40 | 37 |
| C1 | weak | no | yes, plugin | 37.8K | 42 | 40 |
| A | weak | yes, 2 tools | yes, plugin | 97.9K | 117 | 72 |

**Conclusions (directional; single-run noise is ±30K)**:

1. **First-turn anchoring is the only strong mechanism**: A vs C1 = **+60K
   depth (+160%)**. Narrow tools → the model can only think → depth amplified.
   Hesitation and "I will" are byproducts of deep thinking, positively
   correlated with depth (28 → 117 / 30 → 72), not defects
2. **DEEP guidance is neutral on Flash**: B → D1 = +2K (within noise). The
   paper's "+12% depth" is Pro data; Flash confirms the paper's own
   "c-closed ≈ b-directed" neutrality on real tasks
3. **weak persona stacking is small**: D1 → C1 = +3.5K (within noise)
4. **Language layering** (bilingual matrix, n=5): persona language locks the
   form / system language sets the thinking-chain language / language does not
   block forms
5. Methodology lesson: leftover workspace files contaminate experiments; n=1
   noise is large — directions credible, magnitudes not

So the measured "quality-first" path is **first-turn anchoring** (depth for
coverage); routing and guidance are functional components (paper evidence on
Pro), with no effect promises on Flash.

## Tests

```sh
npm test        # 22 tests: classification, bands, personas, guidance, full lifecycle
```

## License

MIT. Guidance texts and personas derive from dsh-router-standard /
dsh-mode-boost (MIT, yjh051108), which acknowledge xiaobright/dsh-anchored-standard.
