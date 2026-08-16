# omp-ds-routing-suite

[English](README.md) | [中文](README.zh-CN.md)

First-turn tool anchoring, task classification, and per-turn guidance for
DeepSeek V4 Flash inside Oh My Pi. Port of mechanisms measured in the DSH
ecosystem:

- [yjh051108/dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)
- [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)

All measurements in this README were taken against the official DeepSeek API
(`deepseek-v4-flash`) on 2026-08-16. Section 3 states what was measured and
with which counting rules; section 4 lists what was not measured. No statement
in this document claims more than those two sections.

References to "the paper" point to the dsh-router-standard paper, shipped
inside dsh-routing-suite:
[paper.md](https://github.com/yjh051108/dsh-router-standard/blob/main/docs/paper.md)
and its
[experiments.md](https://github.com/yjh051108/dsh-router-standard/blob/main/docs/experiments.md).

**TL;DR.** Install (section 1), then just use it: the plugin classifies each
task, anchors the first turn to two tools, and injects per-turn guidance.
Measured on Flash (2026-08-16, official API): first-turn anchoring is the only
strong effect (+160% thinking depth, n=1); DEEP guidance and weak persona sit
within noise. Windows 11 + Oh My Pi only (4.1). Evidence in section 3.

## 1. Install & Quick Start

```powershell
# 1. clone the repository, then from the repository root:
powershell -ExecutionPolicy Bypass -File install.ps1

# 2. quit Oh My Pi completely (not /reload — extensions load at startup),
#    then reopen.
```

The installer copies the extension to `~/.omp/agent/extensions/` and moves a
conflicting SeekAnchor install to `extensions-disabled/` if present. The
default mode is `weak`; the plugin is active immediately after restart.

Commands (escape hatches, not required for daily use):

```
/dsr-mode weak      model self-classification (default)
/dsr-mode spec      plan-first persona (maintenance / reading tasks)
/dsr-mode react     execution-first persona (greenfield build tasks)
/dsr-mode native    disable the plugin for this session
/dsr-status         print current mode, persona, and guidance state
```

Uninstall:

```powershell
Remove-Item -Recurse $env:USERPROFILE\.omp\agent\extensions\omp-ds-routing-suite
# restore SeekAnchor, if it was disabled:
#   move extensions-disabled\deepseek-rl-anchor back to extensions\
```

"Router: ..." lines that appear in the transcript after each user message are
the injected guidance text, addressed to the model. They are not configuration
prompts.

### Linux / macOS (manual install)

The extension is a plain directory; copy it by hand:

```sh
mkdir -p ~/.omp/agent/extensions/omp-ds-routing-suite
cp index.ts core.ts state.ts commands.ts tools.ts \
  ~/.omp/agent/extensions/omp-ds-routing-suite/
# if SeekAnchor is installed:
mv ~/.omp/agent/extensions/deepseek-rl-anchor \
  ~/.omp/agent/extensions-disabled/
```

Not measured on Linux/macOS (4.1); the runtime has no platform-specific code
paths. `install.ps1` targets Windows PowerShell (5.1+); PowerShell Core on
Linux sets no `$env:USERPROFILE`, so prefer the manual steps there.

## 2. Mechanisms

What the extension does, without effect claims (effects are in section 3).

**First-turn anchoring.** The first `agent_start` of a session sets the active
tool catalog to two tools (`bash`, `edit`). The full catalog is restored after
the first durable tool call (`restoreNativeTools` merges the native catalog
back in). Rationale: with a two-tool surface the model cannot explore, read, or
write beyond the immediate task; the measured effect on thinking depth is in
3.3.

**Task classification.** Three persona bands ported from dsh-mode-boost:
`weak` (the model classifies itself; default), `spec` (plan-first), `react`
(execution-first). Persona text differs per model: Flash gets
`neutral + classify + session anchors + deep-first`, Pro gets
`spec sentence + classify instruction`. The classification is re-run from
round 3 onward so a new task is not carried by the previous turn's style
(anti-dilution, "boost" reclassification).

**Per-turn guidance.** After each real user message the extension appends one
guidance line to the request tail: a converge instruction for short tasks, a
deep-think instruction for long tasks. The guidance text is fixed per task
class (BASE / COMMIT / DEEP), mirroring dsh-mode-boost's cached-guide design.

**Why no injector.** DSH loads system content through a message-level layer,
which is why dsh-routing-suite ships an injector and `suppressedContextSources`
tables. In Oh My Pi the project `AGENTS.md` sits in the system array, so the
persona swap is a wholesale replacement of that array slot; no runtime
injector is needed. This is an architecture difference, not a porting shortcut.

## 3. Measurements & Evidence

All numbers below were machine-counted with the scripts in `bench/` and
`probe/` (section 5 gives the commands).

### 3.1 Tooling and counting rules

`bench/analyze-thinking.mjs` reads an OMP session jsonl and counts, per
thinking block:

- **depth** — character length of the thinking block;
- **hesitations** — occurrences of self-reversal markers (`hmm`, `wait`,
  `hold on`, `but wait`), the "double-attractor" interleaving described in the
  paper;
- **I will / we / let** — occurrence counts of those chain-head forms in the
  thinking text.

`probe/thinking-probe.mjs` calls the API directly (Anthropic endpoint,
`/anthropic`; the persona must sit in the top-level `system` field — P6) and
classifies the first line of each thinking block as `we-track`, `let-track`,
`hesitate`, or `other`.

Two limits apply to every number in this section. First, sample size: n=1 per
ablation group, n=5 per persona cell in the matrix. Second, single-run noise:
two runs of the same C1 condition differed by ~30K characters of thinking
(66.9K vs 37.6K, see 3.3). Directional claims below survive that noise;
magnitudes do not.

Metric comparability: the paper's lexicon metrics — first-line classes
(minimal-like / standard-like / ambiguous), per-block we/letMe ratios,
planScore (we − letMe), `Interesting`-leading promote transients, and
convergence rate — were **not** reproduced in the ablation sessions. Our
counts (depth chars, hesitation markers, token frequencies) use a different
ruler. The numbers in 3.2–3.3 are comparable with each other, not with the
paper's tables; where a claim maps onto a paper experiment, section 3.4 says
so explicitly.

### 3.2 Bilingual persona matrix (n=5, official API)

Same read-type and build-type micro-tasks under three personas, five requests
per cell:

| condition | we-track | doer (let/other) | hesitate |
|---|---|---|---|
| baseline (no persona) | mixed | mixed | 0 |
| English weak persona | 3/10 | 7/10 | 0 |
| Chinese persona | 15/15 | 0/15 | 0 |

Observations:

1. **Persona language locks the chain form.** Chinese persona → 15/15
   `we-track`, zero doer forms, zero hesitation. English weak persona keeps
   doer release (7/10). The paper's experiments were all-English; this cell
   was untested there.
2. **System language sets the thinking-chain language.** A Chinese `AGENTS.md`
   produces Chinese thinking chains regardless of persona language; an English
   persona does not force English chains.
3. **Language does not block forms.** The `we-track` basin dominates both
   languages; the doer form is a secondary attractor that Chinese persona
   suppresses.
4. **Zero hesitation in direct API calls** (16/16 in an earlier n=2x2 run).
   Hesitation appears only in tool-execution sessions (3.3), consistent with
   the paper's finding that discrimination needs a tool surface.

Consequence for the default config: the persona shipped by the plugin is the
paper's English persona; a Chinese persona comes from the user's own
`AGENTS.md` (system layer), which the plugin does not override.

Timeliness note (2026-08-16 evening): an n=10 rerun of this matrix hit
direct-API drift — every condition (including the plain baseline) produced
template-prefixed thinking ("We need respond to user…"), flattening the
form discrimination. The n=5 numbers above and the n=10 rerun are not
comparable; OMP-session thinking (3.3, E1/E2) did not drift. Direct-API
form classification is time-sensitive (4.3 timeliness disclaimer applies
in practice).

### 3.3 Ablation: four clean greenfield runs

**Design.** The same greenfield task (implement a JavaScript shopping-cart
module with 8 specified functions and ≥10 `node:assert` tests, text in
`bench/cart-task.md`) was run once per condition, each in its own OMP session
with its own empty working directory. Empty directories and fixed cwd are
deliberate: the first two attempts were contaminated by leftover files from
the A/B benchmark, and a contaminated workspace makes the model take a reuse
path instead of a greenfield path, inflating depth (66.9K for a contaminated
C1 design phase vs 37.6K for the clean C1 run).

| group | persona | anchor | DEEP guide | depth (chars) | hesitations | I will | test assertions |
|---|---|---|---|---|---|---|---|
| B — native baseline | none | no | no | 32,102 | 28 | 30 | 25 |
| D1 | none | no | manual text | 34,300 | 40 | 37 | ~29 |
| C1 | weak | no | plugin | 37,757 | 42 | 40 | ~30 |
| A | weak | **yes** (2 tools) | plugin | 97,917 | 117 | 72 | 41 |

All four groups finished the task and passed their test suite. `we`/`let`
counts were recorded for C1 (we=1, let=29) and D1 (we=1, let=34) only; the B
and A sessions predate the counter. Assertion counts are a proxy for output
completeness; they rise with depth (25 → 41).

Conclusions:

1. **First-turn anchoring is the only strong mechanism.** A vs C1: +60K
   characters of thinking (+160%). A's first thinking block alone is 97.9K
   chars (~24.5K tokens, far below the 64K OMP budget, 4.1): with a two-tool
   surface the model cannot act, so it keeps reasoning until its information
   is complete. The earlier attribution of the 98K figure to the DEEP
   guidance was wrong; the guidance contributes within noise (D1 vs B:
   +2.2K).
2. **DEEP guidance shows no independent effect on this task.** D1 (manual
   DEEP text) vs B: +2.2K, inside the ±30K noise band. Scope: B's 32.1K is a
   voluntary convergence point, not a budget ceiling — the OMP thinking
   budget is 64K tokens (models.yml `maxTokens`), and A reached 24.5K tokens
   in a single block. An earlier draft of this README claimed B matched the
   paper's budget-exhaustion ceiling (P10: 32.5K); that was a numeric
   coincidence — the paper's 32.5K comes from an 8K-token probe budget, which
   is a different mechanism (3.7).
3. **weak persona stacking is small.** C1 vs D1: +3.5K, inside noise.
4. **Hesitation and "I will" are byproducts of depth.** Both rise with depth
   across groups (28 → 117, 30 → 72). They are fingerprints of extended
   reasoning, not defects to remove.

### 3.4 Relation to the DSH paper lineage

| claim | status here |
|---|---|
| Flash's weak-persona region is its routing window (P8-Flash: neutral +2.00, react-weak +4.67 discrimination) | adopted as the default mode; not re-measured end-to-end |
| deep-react doubles depth on Flash from a low baseline, P10 (9.7K → 18.4K, 100% convergence) | not reproduced — our B baseline already sat at budget-ceiling depth (3.3) |
| anchoring steers the we-track trajectory (dsh-anchored-standard); Flash is catalog-immune in trajectory terms (paper §5.2) | trajectory not re-measured; the depth effect (3.3) is a different dimension — catalog changes depth, not form |
| language layering (persona locks form, system sets language) | new, outside the paper's all-English scope (3.2) |
| injection is blocked by `suppressedContextSources` (DSH) | architecture difference: OMP replaces the system array wholesale, no injector needed (2) |

### 3.5 "I will" trigger condition (hypothesis, not an experiment)

Across both benchmark sessions the form `The user → Let me → I will` appears
in the production phase of doer trajectories on greenfield complex tasks: B
30 occurrences, A 72. Flash reproduces it. Three conditions coincide: native
mode (no persona form-lock), a greenfield task (no existing path), and a doer
trajectory (outside the we-basin). n=2 sessions; treated as a hypothesis.

### 3.6 Porting deltas vs upstream implementations

Our port differs from dsh-anchored-standard in four documented ways:

| upstream (dsh-anchored-standard) | ours | consequence |
|---|---|---|
| bootstrap pair: `bash` + `str_replace_editor` (Minimal, byte-identical) | `bash` + `edit` (OMP's Anthropic-family edit tool) | paper B1 (minimal + edit) anchored 2/2; not byte-identical to Minimal |
| promote on first durable `tool/call` OR `assistant/message` (`promoteOn: either`) | same since 2026-08-16 (a text-only first reply promotes at request #2) | aligned |
| promoted catalog: resident set (bootstrap pair + discovery tools + unlocked; heavy tools stay one `dev_tool_search` away) | full catalog restored on promotion | the upstream post-promotion regression warning (dumping the full catalog pulls the trajectory back to standard-like) applies; our depth effect (3.3) was measured under full restore, trajectory form after promotion was not counted |
| bootstrap context: strip `agent-instructions` + `skill-catalog` only, keep the Minimal persona system prompt | first turn replaces the whole system array with the plugin persona; the fresh native system (`AGENTS.md` etc.) returns after promotion | more aggressive than upstream; preserves the user's memory/AGENTS.md after the anchor phase (this is also the fix for a prior full-replace memory-loss bug) |

The output-budget lever (`bootstrapMaxTokens`) is not used; the tool-schema
lever and the injection-strip lever are both active.

### 3.7 P10 reproduction: deep-then-converge on a fixed budget (2026-08-16)

Direct-API scan reproducing the paper's L-table conditions on our own
credentials (Anthropic endpoint, `thinking` enabled, budget 8000 tokens,
`max_tokens` 8192, the greenfield cart task, n=3 per condition):

| condition | depth (chars) | finish |
|---|---|---|
| react | 31,943 / 32,056 / 30,264 | max_tokens ×3 |
| deep-react (react + "think deeply first, then produce") | 31,355 / 31,790 / 31,455 | max_tokens ×3 |
| deep1 ("think deeply") | 31,408 / 29,974 / 30,796 | max_tokens ×3 |
| deep2 (two-phase) | 30,031 / 31,348 | max_tokens ×2 |

Every condition exhausts the 8K-token budget (~31K chars); persona and
guidance text change depth by <1%. Two consequences:

1. **On a fixed small budget, depth is budget-bound, not condition-bound.**
   The paper's deep-react doubling (9.7K → 18.4K) was measured on the API's
   own 8192 `max_tokens` with a react persona that converges early; our
   ported react persona text does not converge early, so all conditions hit
   the same ceiling. The doubling is persona-text-specific, not a property of
   the "think deeply" sentence alone.
2. **The OMP-session ablation (3.3) is not comparable to this scan.** The OMP
   thinking budget is 64K tokens (4.1); the condition differences there
   (32K → 98K) are visible only because the budget leaves headroom. On an
   8K budget every condition saturates and the differences disappear — depth
   discrimination needs budget headroom, just as trajectory discrimination
   needs a tool surface (paper §5.2).

A partial Pro run (n=2, same budget, 2026-08-16) measured react ≈29.4K vs
deep-react ≈31.0K (finish max_tokens ×2); the paper's Pro deep-converge scan
is still marked incomplete upstream, and our n=2 is not enough to conclude
anything about Pro.

### 3.8 Causality, generalization, long horizon (2026-08-16 evening)

Headless runs via `omp -p` (non-interactive OMP sessions, extension loaded —
verified in the diagnostics log; sessions land in `~/.omp/agent/sessions/`).

**E1 — hesitation causality (n=2 per guidance).** Same cart task, plugin
default (weak + anchor + guide), only the tail text varies:

| group | tail text | depth | hes | hes density | assertions |
|---|---|---|---|---|---|
| neutral | (none) | 77.0K / 35.2K | 119 / 27 | 1.55 / 0.77 /K | 40 / 29 |
| inhibit | "Do not second-guess yourself…commit." | 0.8K / 26.9K | 0 / 12 | 0 / 0.45 /K | 26 / 31 |
| encourage | "List candidate approaches, weigh, reject…" | 38.4K / 36.4K | 59 / 33 | 1.54 / 0.91 /K | 28 / 49 |

Means: depth 56.1K / 13.9K / 37.4K; hes 73 / 6 / 46; assertions 34.5 / 28.5 /
38.5 (neutral / inhibit / encourage). Inhibiting hesitation collapses depth
(−75%) and completeness (−17%) and erases "I will" (0/0); encouraging explicit
weighing yields the highest hesitation density and the highest completeness.
Directionally, hesitation is coupled to reasoning depth and output
completeness — it is not removable noise. Caveats: n=2 per cell; neutral
within-group spread is ±42K (77.0K vs 35.2K).

**E2 — task generalization (n=2).** The same conditions on a CSV-parser task
(spec-determined: parse/toCSV/quoting rules, little design ambiguity):

| group | depth | hes | assertions |
|---|---|---|---|
| plugin (weak + anchor + guide) | 16.0K / 42.7K | 13 / 47 | 20 / 25 |
| native | 31.8K / 28.7K | 36 / 54 | 26 / 17 |

The anchoring effect (+160% on the cart task, 3.3) does **not** reproduce:
means 29.4K (plugin) vs 30.3K (native). The cart task carries design ambiguity
(discount/coupon semantics, snapshot independence), the parser task is
specification-determined — **task design density moderates the anchoring
effect** (same shape as the paper's P2: simple tasks saturate). The +160%
claim is scoped to design-heavy greenfield tasks.

**E3 — resident catalog comparison (n=2).** Cart task, plugin default;
variable: promoted catalog = full native set vs resident narrow set
(`/dsr-resident on` / settings `{"resident": true}`, verified in the
diagnostics log: `restoreNativeTools resident -> [bash,edit,read,write]`):

| session | promoted catalog | depth | hes | assertions |
|---|---|---|---|---|
| res1 / res2 | full (off) | 20.5K / 37.8K | 35 / 32 | 25 / 27 |
| res3 / res4 | narrow (on) | 13.9K / 73.1K | 4 / 90 | 38 / 38 |

Completeness is consistently higher with the resident narrow set (38 vs
25/27, +46%, both runs identical) — weak support for the upstream
post-promotion regression warning at the output level. Depth and hesitation
spread (±60K) is too large for a conclusion at n=2.

**E4 — long-horizon related chain (paper P21 design).** Eight sequential
turns (write → fix → extend → fix → extend → fix → extend → fix) on the
parser task, plugin vs native, n=2 each:

| session | condition | read-class calls | fix turns read-first | assertions |
|---|---|---|---|---|
| e4-a1 / a2 | plugin | 30% / 44% | 1/3, 2/4 | 36 / 35 |
| e4-b1 / b2 | native | 67% / 63% | 3/4, 2/3 | 29 / 30 |

Directionally consistent with the paper's P21 (guidance lowers read
continuity): plugin sessions read the existing code less (37% avg vs 65%).
But the paper's "guidance is negative in related chains" does not reproduce
at the output level — plugin sessions finished all 8 turns with more
assertions (35.5 avg vs 29.5). Caveats: `omp -p` merges the eight message
files into one batched request (model processes the 8 tasks in sequence
within one session), not the paper's per-turn interaction; in batching,
code read in early turns is already in context, so low read continuity is
not ignorance of the code. A true per-turn chain (interactive OMP session)
is out of scope here.

## 4. Boundaries, environment, disclaimers

### 4.1 Environment (what was tested)

All measurements and benchmark sessions ran on Windows 11 with Oh My Pi (shell:
Git Bash). The OMP model config (`models.yml`) sets the thinking budget via
`maxTokens: 65536` with `defaultThinkingLevel: max` — the budget is 64K
tokens, and no measured block approached it (the deepest, A's first block, is
~24.5K tokens, 3.3). DSH, Linux, and WSL were not tested. `install.ps1` uses
only base cmdlets available in Windows PowerShell 5.1 (`Join-Path`,
`Test-Path`, `New-Item`, `Copy-Item`, `Move-Item`, `Write-Host`); no
PowerShell 7-specific syntax is used.

### 4.2 Unverified claims

- **Pro is untested.** The code branches on model name, but no measurement
  exists in this repository.
- **anchored-standard on Flash (DSH side) is untested.** The interplay with
  `suppressedContextSources` was inspected in the SeekAnchor source, not run.
- **Sample sizes are small.** n=1 per ablation group, n=5 per persona cell —
  the same order as the paper's n=2–3.
- **Noise band is ±30K characters** of thinking per single run (3.1).
- **Resident catalog is not implemented.** After the first tool call the full
  catalog is restored; a resident narrow catalog (anchored-standard's
  regression guard) is a future option.
- **Related-task chains (paper P21) were not reproduced**; the negative
  guidance effect there is out of scope.

### 4.3 Disclaimers

- **Behavior.** The plugin modifies model input (tool catalog, persona,
  guidance). Behavior that differs from native OMP — "Router: ..." lines,
  persona form changes — is by design, not a defect.
- **Effects.** Apart from the first-turn anchoring depth effect (n=1, 3.3),
  the independent effects of routing and guidance on Flash sit within
  measurement noise. This document makes no effect claims beyond section 3.
- **Timeliness.** All measurements were taken against the 2026-08-16 official
  DeepSeek API snapshot; a model update may invalidate them.
- **Quality.** The plugin does not guarantee output quality, correctness, or
  task success.

## 5. Reproducing the measurements

Persona matrix:

```sh
DEEPSEEK_API_KEY=sk-xxx DEEPSEEK_API_BASE=https://api.deepseek.com/anthropic \
  node probe/thinking-probe.mjs deepseek-v4-flash 3
```

Counting a session (after a benchmark run in an isolated directory):

```sh
node bench/analyze-thinking.mjs ~/.omp/agent/sessions/--D--bench-cart-*/<session>.jsonl
```

Ablation protocol (what the four groups did):

1. Create an empty directory per condition; set the OMP session cwd to it.
2. Paste the task from `bench/cart-task.md` as the first message.
3. Condition variables: persona (none vs weak), anchoring (off vs on), DEEP
   guide (none vs manual tail text vs plugin).
4. Run `analyze-thinking.mjs` on the resulting session jsonl; count test
   assertions in the produced `test.js`.

## 6. License & acknowledgements

MIT. 

Guidance texts and personas derive from
[yjh051108/dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)(which bundles dsh-mode-boost)

acknowledging
[xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
for the anchoring mechanism.
