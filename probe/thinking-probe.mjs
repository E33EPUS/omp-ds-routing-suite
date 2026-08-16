#!/usr/bin/env node
/**
 * thinking-probe.mjs — reproduce the We/Let trajectory measurement on the
 * real DeepSeek API (the dsh-router-standard paper's lexicon method, ported).
 *
 * Sends the same fixed micro-task under three system conditions (spec /
 * weak / react) and classifies each thinking-block head into:
 *   we-track     — "We need" / "我们需要"  (plan-collective, efficient path)
 *   let-track    — "Let me"   / "让我"      (doer, deep path)
 *   hesitate     — "but wait" / "不过"      (the fault-line interlocking)
 *   other
 *
 * Supports both wire formats:
 *   - OpenAI-compatible chat/completions (default)
 *   - Anthropic Messages API (auto-detected when baseUrl contains
 *     "/anthropic", or pass --api anthropic)
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-xxx node probe/thinking-probe.mjs [model] [n] [baseUrl]
 *
 * Examples:
 *   DEEPSEEK_API_KEY=sk-xxx node probe/thinking-probe.mjs deepseek-v4-flash 3 https://api.deepseek.com/anthropic
 *   DEEPSEEK_API_KEY=sk-xxx node probe/thinking-probe.mjs deepseek-v4-flash 2 https://your-bridge/v1
 *
 * Env: DEEPSEEK_API_KEY (required), DEEPSEEK_MODEL, DEEPSEEK_API_BASE.
 * The transition band is never probed (measured trap).
 */
import { SPEC_PERSONA, WEAK_FLASH, WEAK_PRO, REACT_PERSONA } from '../core.ts'

const args = process.argv.slice(2)
const anthropicFlag = args.indexOf('--api')
let anthropic = false
if (anthropicFlag !== -1 && args[anthropicFlag + 1] === 'anthropic') {
  anthropic = true
  args.splice(anthropicFlag, 2)
}
const onlyFlag = args.indexOf('--only')
let only = null
if (onlyFlag !== -1) {
  only = new Set(args[onlyFlag + 1].split(','))
  args.splice(onlyFlag, 2)
}
const taskFlag = args.indexOf('--task')
let taskFilter = null
if (taskFlag !== -1) {
  taskFilter = new Set(args[taskFlag + 1].split(','))
  args.splice(taskFlag, 2)
}
const MODEL = args[0] ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const N = Number(args[1] ?? 2)
const BASE = (args[2] ?? process.env.DEEPSEEK_API_BASE ?? '').replace(/\/+$/, '')
const KEY = process.env.DEEPSEEK_API_KEY

if (!KEY) {
  console.error('error: set DEEPSEEK_API_KEY (and DEEPSEEK_API_BASE for a bridge)')
  process.exit(1)
}
if (!BASE) {
  console.error('error: set DEEPSEEK_API_BASE (e.g. https://api.deepseek.com/anthropic or /v1 for OpenAI-compat)')
  process.exit(1)
}
if (BASE.includes('/anthropic')) anthropic = true

const TASKS = [
  [
    'read',
    'Inspect the current repository before answering. First determine its top-level structure, then locate and read the project README. Do not guess from prior knowledge. Use the available tools first.',
  ],
  [
    'read-zh',
    '先检查当前仓库，确定顶层结构，然后找到并阅读项目 README。不要凭猜测回答，先使用可用工具。',
  ],
  [
    'build',
    'Build a complete single-file web game (Mario-style platformer) with sound, fireballs, power-ups, coins and levels. Write the file, verify it runs, and fix issues until it works.',
  ],
]

const ZH_SPEC = '你是一个乐于助人的软件工程师助手。'

const ZH_WEAK_PRO =
  '你是一个乐于助人的软件工程师助手。\n'
  + '行动前，先判断任务类型（构建或修复），并采用匹配的风格：构建 → 直接动手产出；修复 → 先检查再计划。'

const ZH_WEAK =
  '你是一个乐于助人的助手。\n'
  + '行动前，先判断任务类型（构建或修复），并采用匹配的风格：构建 → 直接动手产出；修复 → 先检查再计划。\n'
  + '行动前，简要回顾本次会话中你已完成的工作并从中断处继续，不要重复已完成步骤。不要运行环境检查（echo、whoami、uname、node --version、date）或穷举式 grep/glob 扫描。\n'
  + '先深入思考，再产出。'

const ZH_REACT =
  '你是一位注重快速交付的软件工程师。\n'
  + '直接动手：写代码或改代码，然后通过阅读和运行验证。保持紧凑循环——产出、验证、修复——不要构建用户没要求的测试框架、脚手架或仪式。以可用交付物和简短总结收尾。'

const CONDITIONS = [
  ['baseline', 'You are a helpful assistant.'],
  ['spec', SPEC_PERSONA],
  ['weak-flash', WEAK_FLASH],
  ['weak-pro', WEAK_PRO],
  ['react', REACT_PERSONA],
  ['zh-spec', ZH_SPEC],
  ['zh-weak', ZH_WEAK],
  ['zh-weak-pro', ZH_WEAK_PRO],
  ['zh-react', ZH_REACT],
]

/**
 * Paper lexicon classifier (experiments.md): minimal-like = We-leading
 * (we>0, let-me=0); standard-like = The/Let-leading (we=0); hesitate =
 * the fault-line "…but wait…" self-reversal; ambiguous = other.
 * Bilingual for Chinese thinking chains.
 */
function classify(head) {
  const h = head.toLowerCase()
  const hasWe = /\bwe\b|我们|咱们/.test(h)
  const hasButWait = /but wait|等一下|不过|但是/.test(h)
  if (hasButWait && (hasWe || /let me|让我/.test(h))) return 'hesitate' // self-reversal
  if (hasWe) return 'we-track'
  if (/^(the user|let me|让我|the )/.test(h.trim().toLowerCase())) return 'doer-track' // The/Let leading
  return 'other'
}

async function probeOnce(system, task) {
  let thinking = ''
  if (anthropic) {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        system: system, // persona MUST be system-positioned (paper P6)
        max_tokens: 1024,
        thinking: { type: 'enabled', budget_tokens: 4096 },
        messages: [
          { role: 'user', content: task },
        ],
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
    }
    const data = await res.json()
    for (const block of data.content ?? []) {
      if (block?.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
        thinking = block.thinking
        break
      }
    }
  } else {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: task },
        ],
        reasoning_effort: 'max',
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
    }
    const data = await res.json()
    const msg = data.choices?.[0]?.message ?? {}
    thinking = msg.reasoning_content ?? msg.thinking ?? (typeof msg.content === 'string' ? msg.content : '')
  }
  if (!thinking) return { head: '(no thinking returned)', label: 'other' }
  const head = thinking.trim().replace(/\s+/g, ' ').slice(0, 100)
  return { head, label: classify(head) }
}

const conditions = CONDITIONS.filter(([name]) => (only ? only.has(name) : true))
const tasks = TASKS.filter(([name]) => (taskFilter ? taskFilter.has(name) : true))
console.log(`format=${anthropic ? 'anthropic-messages' : 'openai-completions'} model=${MODEL} n=${N} tasks=${tasks.map(([t]) => t).join('+')} conditions=${conditions.map(([c]) => c).join('+')}`)
const results = new Map() // "task/condition" -> labels[]
for (const [taskName, taskText] of tasks) {
  for (const [name, system] of conditions) {
    const key = `${taskName}/${name}`
    results.set(key, [])
    for (let i = 0; i < N; i++) {
      try {
        const r = await probeOnce(system, taskText)
        results.get(key).push(r.label)
        console.log(`[${key}] run ${i + 1}: ${r.label}  «${r.head}…»`)
      } catch (err) {
        console.error(`[${key}] run ${i + 1} FAILED: ${err instanceof Error ? err.message : String(err)}`)
        results.get(key).push('error')
      }
    }
  }
}

console.log('\n=== summary ===')
for (const [taskName] of tasks) {
  console.log(`-- task: ${taskName} --`)
  for (const [name] of conditions) {
    const labels = results.get(`${taskName}/${name}`)
    const counts = {}
    for (const l of labels) counts[l] = (counts[l] ?? 0) + 1
    console.log(
      `${name.padEnd(11)} ${Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join('  ')}`,
    )
  }
}
