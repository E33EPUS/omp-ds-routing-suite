#!/usr/bin/env node
/**
 * hes-types.mjs — hesitation typology: classify each hesitation marker by
 * its local context into:
 *   weigh  — option-comparison (preceding text shows doer exploration:
 *            let me / 让我 / or / 或者 / maybe / 或许 / reconsider / 考虑)
 *   fault  — fault-line reversal inside a we-basin block (we-track present,
 *            zero let-me markers; the paper's "fault-line" fingerprint)
 *   other  — neither
 * usage: node bench/hes-types.mjs <session.jsonl>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)

const HES_RE = /\b(?:but wait|wait|hold on|hmm)\b|等等|等一下|但是等等/gi
const WEIGH_RE = /\blet me\b|让我|另一个|或者|或许|maybe|or\b|reconsider|考虑|alternative|alternatives|方案|选项/gi

const blocks = []
for (const line of lines) {
  let ev
  try { ev = JSON.parse(line) } catch { continue }
  if (ev.type !== 'message' || ev.message?.role !== 'assistant') continue
  for (const b of ev.message.content ?? []) {
    if (b?.type !== 'thinking' || typeof b.thinking !== 'string' || !b.thinking.trim()) continue
    blocks.push(b.thinking)
  }
}

let weigh = 0
let fault = 0
let other = 0
const sample = { weigh: [], fault: [], other: [] }
for (const t of blocks) {
  const hasWe = /\bwe\b|我们|咱们/i.test(t)
  const hasLet = /\blet me\b|让我/i.test(t)
  const blockIsWeBasin = hasWe && !hasLet
  let m
  HES_RE.lastIndex = 0
  while ((m = HES_RE.exec(t)) !== null) {
    const ctx = t.slice(Math.max(0, m.index - 80), m.index + 40)
    if (WEIGH_RE.test(ctx)) {
      weigh++
      if (sample.weigh.length < 3) sample.weigh.push(ctx.replace(/\s+/g, ' ').slice(-70))
    } else if (blockIsWeBasin) {
      fault++
      if (sample.fault.length < 3) sample.fault.push(ctx.replace(/\s+/g, ' ').slice(-70))
    } else {
      other++
      if (sample.other.length < 3) sample.other.push(ctx.replace(/\s+/g, ' ').slice(-70))
    }
  }
}

console.log(`session: ${file}`)
console.log(`blocks=${blocks.length} hes_total=${weigh + fault + other}`)
console.log(`  weigh (option-comparison): ${weigh}`)
console.log(`  fault (we-basin reversal): ${fault}`)
console.log(`  other:                    ${other}`)
console.log('\nsamples:')
for (const k of ['weigh', 'fault', 'other']) {
  console.log(`-- ${k} --`)
  for (const s of sample[k]) console.log(`  «${s}…»`)
}
