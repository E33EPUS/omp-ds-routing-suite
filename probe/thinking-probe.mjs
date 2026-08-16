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
    'build',
    'Build a complete single-file web game (Mario-style platformer) with sound, fireballs, power-ups, coins and levels. Write the file, verify it runs, and fix issues until it works.',
  ],
]

const CONDITIONS = [
  ['spec', SPEC_PERSONA],
  ['weak-flash', WEAK_FLASH],
  ['weak-pro', WEAK_PRO],
  ['react', REACT_PERSONA],
]

function classify(head) {
  const h = head.toLowerCase()
  if (/\bwe\b|我们|咱们/.test(h)) return 'we-track'
  if (/let me|让我|我先|让我先/.test(h)) return 'let-track'
  if (/but wait|等一下|不过|但是/.test(h)) return 'hesitate'
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

console.log(`format=${anthropic ? 'anthropic-messages' : 'openai-completions'} model=${MODEL} n=${N} tasks=${TASKS.map(([t]) => t).join('+')}`)
const results = new Map() // "task/condition" -> labels[]
for (const [taskName, taskText] of TASKS) {
  for (const [name, system] of CONDITIONS) {
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
for (const [taskName] of TASKS) {
  console.log(`-- task: ${taskName} --`)
  for (const [name] of CONDITIONS) {
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
