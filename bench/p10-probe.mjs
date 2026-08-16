#!/usr/bin/env node
/**
 * p10-probe.mjs — reproduce the paper's deep-then-converge scan (L table,
 * V4 Flash, n=3, 8192 budget) on our own API access.
 *
 * Conditions:
 *   react        — REACT_PERSONA (baseline)
 *   deep-react   — REACT_PERSONA + "Think deeply first, then produce."
 *   deep1        — "Think deeply" alone (paper: 0% convergence trap)
 *
 * Metrics: thinking characters (depth), finish reason (stop vs length;
 * length = budget exhaustion, the paper's "0% convergence" proxy without
 * a tool surface).
 *
 * Usage: DEEPSEEK_API_KEY=sk-xxx node bench/p10-probe.mjs [n] [model]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { REACT_PERSONA } from '../core.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const N = Number(process.argv[2] ?? 3)
const MODEL = process.argv[3] ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const BASE = (process.env.DEEPSEEK_API_BASE ?? 'https://api.deepseek.com/anthropic').replace(/\/+$/, '')
const KEY = process.env.DEEPSEEK_API_KEY

if (!KEY) {
  console.error('DEEPSEEK_API_KEY is required')
  process.exit(1)
}

const TASK = readFileSync(join(__dirname, 'cart-task.md'), 'utf8').trim()

const DEEP_REACT = REACT_PERSONA + '\nThink deeply first, then produce.'
const DEEP1 = 'Think deeply.'
const DEEP2 = 'Think deeply about the architecture and edge cases. Then produce.'

const CONDITIONS = [
  ['react', REACT_PERSONA],
  ['deep-react', DEEP_REACT],
  ['deep1', DEEP1],
  ['deep2', DEEP2],
]

async function probeOnce(system) {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      system,
      max_tokens: 8192,
      thinking: { type: 'enabled', budget_tokens: 8000 },
      messages: [{ role: 'user', content: TASK }],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  let thinking = ''
  for (const block of data.content ?? []) {
    if (block?.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
      thinking += block.thinking
    }
  }
  return { depth: thinking.length, finish: data.stop_reason ?? 'unknown' }
}

console.log(`p10 probe model=${MODEL} n=${N} budget=8000 base=${BASE}`)
const results = {}
for (const [name, system] of CONDITIONS) {
  results[name] = []
  for (let i = 0; i < N; i++) {
    const r = await probeOnce(system)
    results[name].push(r)
    console.log(`${name} #${i + 1} depth=${r.depth} finish=${r.finish}`)
  }
}

console.log('\n=== summary ===')
for (const [name, rows] of Object.entries(results)) {
  const depths = rows.map((r) => r.depth)
  const mean = Math.round(depths.reduce((a, b) => a + b, 0) / depths.length)
  const lengths = rows.filter((r) => r.finish === 'length').length
  console.log(`${name}: depth=${depths.join(',')} mean=${mean} length-finish=${lengths}/${N}`)
}
