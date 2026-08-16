/**
 * core.ts — reasoning-mode routing logic for Oh My Pi (zero dependencies).
 *
 * Ported from dsh-router-standard (router-core.mjs) and dsh-mode-boost
 * (core.js), both MIT. The measured mechanisms stay intact:
 *   - three behavior bands along the persona axis (spec / mixed / react),
 *     never selecting the transition band automatically;
 *   - weak (internal-routing) mode with model-specific personas;
 *   - first-turn tool anchoring (narrow surface, full catalog after the
 *     first durable tool call);
 *   - near-field guidance (fixed text after real user messages);
 *   - boost reclassification from round 3 (anti-dilution);
 *   - depth-adaptive guidance: simple tasks converge fast, complex tasks
 *     get directed deep exploration.
 *
 * All functions are pure — unit-testable without a harness.
 */

export const MODE_SPEC = 0
export const MODE_MIXED = 0.3
export const MODE_REACT = 1
export const MODE_WEAK = 'weak'

// ── personas (system-positioned; measured optimal texts) ──────────────────

const SPEC_PERSONA = 'You are a helpful software engineer assistant.'

const MIXED_PERSONA =
  'You are a helpful software engineer assistant.\n'
  + 'Work directly: prefer writing or editing code over describing plans. '
  + 'Verify your changes by reading and running them.'

const REACT_PERSONA =
  'You are a hands-on software engineer who delivers working output fast.\n'
  + 'Work directly: write or edit code, then verify it by reading and running. '
  + 'Keep the loop tight — produce, verify, fix — and do not build test '
  + 'harnesses, scaffolding, or ceremony the user did not ask for. '
  + 'Finish with a usable deliverable and a short summary.'

/** Weak (internal-routing) personas — model-specific optimum.
 *  pro:   spec sentence + classify instruction (w6c, P24: 24/24 routing)
 *  flash: neutral + classify + session anchors + deep-first
 *         (P23: 96% routing, 100% single-task completion) */
const WEAK_PRO =
  'You are a helpful software engineer assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.'

const WEAK_FLASH =
  'You are a helpful assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.\n'
  + 'Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps. Do not run environment checks (echo, whoami, uname, node --version, date) or exhaustive grep/glob scans.\n'
  + 'Think deeply first, then produce.'

// ── near-field guidance texts (appended to real user messages) ────────────

/** Rounds 1-2: classify + adopt style. */
export const GUIDE_BASE =
  '\n\nRouter: classify this task (build or fix) now, then adopt the matching style — build: direct production; fix: inspect-first.'

/** Rounds 3+: anti-dilution reclassification (P19 boost / P21 b-boost). */
export const GUIDE_BOOST =
  '\n\nRouter: this is a NEW task, different from the previous ones. Classify it fresh (build or fix) and adopt the matching style — build: direct production; fix: inspect-first. Do not follow the previous task\'s style.'

/** Fast-convergence tail for simple tasks (P30: 1 step, zero waste). */
export const GUIDE_COMMIT = ' Think deeply first, then commit and act.'

/** Directed deep tail for complex tasks (P30: depth without rumination). */
export const GUIDE_DEEP = ' Think deeply about the architecture, edge cases, and integration points. Do not spend reasoning on the environment or tooling. Produce when your information is complete.'

/** Decision-closure tail — non-Flash models only (P30: +12% depth on Pro). */
export const GUIDE_CLOSURE = ' End each reasoning block with a decision or an information need.'

// ── complexity heuristic ───────────────────────────────────────────────────

const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze)/i

export function isComplexTask(text: string | null | undefined): boolean {
  return typeof text === 'string' && (text.length > 120 || COMPLEX_RE.test(text))
}

// ── conversational first-message detection (greetings -> let the session be) ──

const CHAT_RE = /^(你好|您好|hello|hi|hey|嗨|哈喽|在吗|谢谢|感谢|thanks|thank you|早上好|下午好|晚上好|嗯|好|ok|okay|yes|no|嗯嗯|好的)[!。.!？?~～]*$/i

export function isChatTask(text: string | null | undefined): boolean {
  return typeof text === 'string' && CHAT_RE.test(text.trim())
}

/** True when the routed model id is a Flash-family model. */
export function isFlashModel(modelId: string | null | undefined): boolean {
  return typeof modelId === 'string' && /flash/i.test(modelId)
}

// ── task classification (keyword evidence -> stable band, else weak) ───────

const REACT_RE = /(开发|创建|写一个|写|生成|从零|做|做一个|做个|游戏|网页|网站|构建|新项目|搭建|实现|做出|上线|落地|脚本|工具|应用|build|create|develop|generate|implement|write a|write an|build a|make a|new project)/gi
const SPEC_RE = /(修复|修一下|调试|重构|维护|排查|报错|出错|崩溃|优化|审查|review|fix|debug|refactor|maintain|repair|broken|break|为什么|异常|故障|迁移|升级|兼容)/gi

function countHits(regex: RegExp, text: string): number {
  return [...text.matchAll(regex)].length
}

/**
 * Classify a task text into a mode. Clear keyword evidence picks a stable
 * band ('react' / 'spec'); ambiguous or unmatched text returns 'weak' —
 * the internal-routing mode where the model decides per task.
 */
export function classifyTask(text: string | null | undefined): 'react' | 'spec' | 'weak' {
  if (typeof text !== 'string' || text.trim() === '') return 'weak'
  const net = countHits(REACT_RE, text) - countHits(SPEC_RE, text)
  if (net > 0) return 'react'
  if (net < 0) return 'spec'
  return 'weak'
}

// ── personas ───────────────────────────────────────────────────────────────

export function personaFor(mode: Mode, modelId: string | null | undefined): string {
  switch (mode) {
    case MODE_SPEC: return SPEC_PERSONA
    case MODE_MIXED: return MIXED_PERSONA
    case MODE_REACT: return REACT_PERSONA
    case MODE_WEAK:
    default:
      return isFlashModel(modelId) ? WEAK_FLASH : WEAK_PRO
  }
}

// ── per-message near-field guidance (exact dispatch) ───────────────────────

/**
 * Guidance text for round `round` (1-based) of real user messages.
 * Returns null when no guidance applies (chat / disabled modes).
 */
export function guideFor(round: number, text: string | null | undefined, modelId: string | null | undefined, enabled = true): string | null {
  if (!enabled) return null
  if (typeof text !== 'string' || text.trim() === '') return null
  if (isChatTask(text)) return null
  const head = round >= 3 ? GUIDE_BOOST : GUIDE_BASE
  const tail = isComplexTask(text)
    ? GUIDE_DEEP + (isFlashModel(modelId) ? '' : GUIDE_CLOSURE)
    : GUIDE_COMMIT
  return head + tail
}

// ── bands ──────────────────────────────────────────────────────────────────

export type Mode = number | typeof MODE_WEAK

/** Quantize a mode to one of the four measured behavior bands. */
export function bandOf(mode: Mode): 'spec' | 'mixed' | 'react' | 'weak' {
  if (mode === MODE_WEAK) return 'weak'
  const m = clamp01(mode)
  if (m < 0.2) return 'spec'
  if (m < 0.5) return 'mixed'
  return 'react'
}

/** Human-readable band name for a mode value. */
export function bandFor(mode: Mode): string {
  if (mode === MODE_WEAK) return 'weak'
  const m = clamp01(mode)
  if (m < 0.2) return 'spec'
  if (m < 0.5) return 'mixed (transition, trap)'
  return 'react'
}

/** First-turn core tools (OMP native names; shell always included).
 *  weak gets the RL-shape surface — bash + edit — per the interface-
 *  restoration measurement (100% action at 18-29K reasoning chars vs
 *  ~25% at 73-101K on the read/write/edit surface). */
export function coreFor(mode: Mode): string[] {
  switch (bandOf(mode)) {
    case 'spec': return ['bash', 'read', 'edit', 'glob', 'grep']
    case 'react': return ['bash', 'read', 'write', 'edit']
    case 'weak':
    default: return ['bash', 'edit']
  }
}

/** Test-suppression strength for a mode (informational). */
export function testinessFor(mode: Mode): string {
  switch (bandOf(mode)) {
    case 'spec': return 'high'
    case 'react': return 'low'
    case 'weak': return 'model-decides'
    default: return 'mixed'
  }
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/** Parse a mode token: band name / 'auto' / 0-100 / 0.0-1.0. */
export function parseMode(token: string | null | undefined): Mode | 'auto' | null {
  if (typeof token !== 'string') return null
  const t = token.trim().toLowerCase()
  if (t === 'auto') return 'auto'
  if (t === 'weak') return MODE_WEAK
  if (t === 'spec') return MODE_SPEC
  if (t === 'mixed') return MODE_MIXED
  if (t === 'react') return MODE_REACT
  const n = Number(t)
  if (Number.isFinite(n)) {
    if (n >= 0 && n <= 1) return n // 0.0-1.0
    if (n >= 0 && n <= 100) return n / 100 // 0-100
  }
  return null
}
