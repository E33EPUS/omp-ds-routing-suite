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
 * Usage:
 *   DEEPSEEK_API_KEY=sk-xxx node probe/thinking-probe.mjs [model] [n] [baseUrl]
 *
 * Examples:
 *   DEEPSEEK_API_KEY=sk-xxx node probe/thinking-probe.mjs deepseek-v4-flash 3
 *   DEEPSEEK_API_KEY=sk-xxx node probe/thinking-probe.mjs deepseek-v4-flash 2 https://your-bridge/v1
 *
 * Env: DEEPSEEK_API_KEY (required), DEEPSEEK_MODEL, DEEPSEEK_API_BASE.
 * The transition band is never probed (measured trap).
 */
import { SPEC_PERSONA, WEAK_FLASH, WEAK_PRO, REACT_PERSONA } from '../core.ts'

const MODEL = process.argv[2] ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const N = Number(process.argv[3] ?? 2)
const BASE = (process.argv[4] ?? process.env.DEEPSEEK_API_BASE ?? '').replace(/\/+$/, '')
const KEY = process.env.DEEPSEEK_API_KEY

if (!KEY) {
  console.error('error: set DEEPSEEK_API_KEY (and DEEPSEEK_API_BASE for a bridge)')
  process.exit(1)
}
if (!BASE) {
  console.error('error: set DEEPSEEK_API_BASE (e.g. https://api.deepseek.com/v1)')
  process.exit(1)
}

const TASK =
  'Inspect the current repository before answering. First determine its top-level structure, then locate and read the project README. Do not guess from prior knowledge. Use the available tools first.'

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

async function probeOnce(condition, system) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: TASK },
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
  const choice = data.choices?.[0]
  const msg = choice?.message ?? {}
  const thinking =
    msg.reasoning_content ?? msg.thinking ?? (typeof msg.content === 'string' ? msg.content : '')
  if (!thinking) return { head: '(no thinking returned)', label: 'other' }
  const head = thinking.trim().replace(/\s+/g, ' ').slice(0, 100)
  return { head, label: classify(head) }
}

const results = new Map() // condition -> labels[]
for (const [name, system] of CONDITIONS) {
  results.set(name, [])
  for (let i = 0; i < N; i++) {
    try {
      const r = await probeOnce(name, system)
      results.get(name).push(r.label)
      console.log(`[${name}] run ${i + 1}: ${r.label}  «${r.head}…»`)
    } catch (err) {
      console.error(`[${name}] run ${i + 1} FAILED: ${err instanceof Error ? err.message : String(err)}`)
      results.get(name).push('error')
    }
  }
}

console.log('\n=== summary ===')
console.log(`model=${MODEL} n=${N} task=micro-read`)
for (const [name] of CONDITIONS) {
  const labels = results.get(name)
  const counts = {}
  for (const l of labels) counts[l] = (counts[l] ?? 0) + 1
  console.log(
    `${name.padEnd(11)} ${Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join('  ')}`,
  )
}
