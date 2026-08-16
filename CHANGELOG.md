# Changelog

## v0.1.1 (2026-08-16)

### Fixes
- promote-on-either: a text-only first reply now ends the anchor phase at request #2 (previously the session stayed trapped on the two-tool surface). Aligned with dsh-anchored-standard's `promoteOn: either`.
- Corrected paper references: removed nonexistent P30/P11/P23/P24 citations; P8-Flash, P9, P10, P21 now point to the real experiments. The earlier "DEEP guidance neutral on Flash" claim was rewritten with its correct scope (budget ceiling / baseline saturation, see README 3.3/3.7).
- Removed the "B baseline matches paper budget-exhaustion ceiling" claim (numeric coincidence; OMP thinking budget is 64K tokens, README 4.1).

### Features
- First-turn safety rules (no credential reads, no destructive actions, ambiguity → ask in reply) cover the anchor-phase window where AGENTS.md is stripped.
- Resident catalog mode (`/dsr-resident on|off`): promoted catalog = narrow `[bash, edit, read, write]` instead of the full set. Measured neutral at n=4 (E3) — off by default.
- Headless experiment runners (`bench/run-*.sh`) via `omp -p` for reproducible benchmarks.

### Docs
- README rewritten: English main + README.zh-CN.md, per-section user conclusions ("how to work optimally"), full measurement evidence (ablation, hesitation typology, E1-E4, F1-F2, P10 reproduction, drift note), boundaries and disclaimers.
- Bilingual CHANGELOG.

### Measured (all 2026-08-16, official API, machine-counted)
- Anchoring: +160% thinking depth on design-heavy greenfield tasks (n=1); moderator = task design density (E2).
- Hesitation: intrinsic to deep reasoning — inhibit tails lower depth −55%, completeness −20% at n=4 (E1); zero fault-line hesitations (typology, 262 markers).
- Long chains: plugin +78% assertions vs native, read continuity −14pp (E4-R, n=2).
- J-Space protocol stacking: neutral on single tasks (F1), net overhead in cold-start long chains (F2, depth +67% / assertions −21%).
- Direct-API drift: template-prefixed thinking flattened form discrimination on 2026-08-16 evening; OMP sessions unaffected.

## v0.1.0 (2026-08-16)

Initial release: first-turn anchoring (2 tools), weak/spec/react modes, per-turn guidance (BASE/COMMIT/DEEP), boost reclassification from round 3, per-model personas, /dsr-mode + /dsr-status, one-click installer, bilingual README with ablation matrix.
