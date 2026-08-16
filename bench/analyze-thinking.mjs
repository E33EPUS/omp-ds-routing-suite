#!/usr/bin/env node
/**
 * analyze-thinking.mjs — extract every assistant thinking block from an OMP
 * session jsonl and count reasoning-style features:
 *   len        — thinking chars
 *   hes        — hesitation/self-reversal markers (wait | hold on | hmm |
 *                等等 | 等一下 | but wait) — the fault-line interlocking
 *   iwill      — "I will" / "I'll" / 我将 / 我会 (doer commitment)
 *   we         — "we" / 我们 / 咱们 (plan-collective)
 *   let        — "let me" / 让我 (doer exploration)
 * Plain "but" / "but then" / "but now" are NOT counted (normal transitions).
 * usage: node analyze-thinking.mjs <session.jsonl>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)

const HES_RE = /\b(?:but wait|wait|hold on|hmm)\b|等等|等一下|但是等等/gi
const IWILL_RE = /\bI will\b|\bI' ll\b|\bI'll\b|我将|我会/gi
const WE_RE = /\bwe\b|我们|咱们/gi
const LET_RE = /\blet me\b|让我/gi

const blocks = []
for (const line of lines) {
  let ev
  try { ev = JSON.parse(line) } catch { continue }
  if (ev.type !== 'message' || ev.message?.role !== 'assistant') continue
  const content = ev.message.content ?? []
  for (const b of content) {
    if (b?.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) {
      const t = b.thinking
      blocks.push({
        len: t.length,
        hes: (t.match(HES_RE) ?? []).length,
        iwill: (t.match(IWILL_RE) ?? []).length,
        we: (t.match(WE_RE) ?? []).length,
        let: (t.match(LET_RE) ?? []).length,
        head: t.trim().replace(/\s+/g, ' ').slice(0, 90),
        hesSamples: [...new Set((t.match(HES_RE) ?? []).map((m) => m.toLowerCase()))],
      })
    }
  }
}

let totalLen = 0
let totalHes = 0
let totalIwill = 0
let totalWe = 0
let totalLet = 0
console.log(`session: ${file}`)
console.log(`thinking blocks: ${blocks.length}`)
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i]
  totalLen += b.len
  totalHes += b.hes
  totalIwill += b.iwill
  totalWe += b.we
  totalLet += b.let
  const flags = []
  if (b.hes > 0) flags.push(`HES×${b.hes}[${b.hesSamples.join(',')}]`)
  if (b.iwill > 0) flags.push(`IWILL×${b.iwill}`)
  if (b.we > 0 && b.let === 0) flags.push('WE')
  if (b.let > 0 && b.we === 0) flags.push('LET')
  console.log(`  #${i + 1} len=${b.len} ${flags.join(' ')} «${b.head}…»`)
}
console.log('--- totals ---')
console.log(`blocks=${blocks.length} len=${totalLen} hes=${totalHes} iwill=${totalIwill} we=${totalWe} let=${totalLet}`)
console.log(`avg hes/block=${(totalHes / Math.max(1, blocks.length)).toFixed(2)} avg len/block=${Math.round(totalLen / Math.max(1, blocks.length))}`)
