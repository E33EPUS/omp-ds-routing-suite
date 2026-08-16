#!/usr/bin/env node
/**
 * e4r-analyze.mjs — aggregate per-turn metrics for E4-R (per-turn isolated
 * processes): each turn is one omp -p session in the same dir. For each
 * session jsonl: depth, hes, and read-class tool ratio (first tool per
 * turn; bash classified read when the command starts with an inspection
 * verb). Prints per-turn rows and totals.
 * usage: node bench/e4r-analyze.mjs <session-dir-prefix>  (e.g. --D--bench-e4r-a1--)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const prefix = process.argv[2]
const sessionsDir = process.env.OMP_SESSIONS ?? 'C:/Users/NIUQU/.omp/agent/sessions'
const dir = join(sessionsDir, prefix)
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()

const HES_RE = /\b(?:but wait|wait|hold on|hmm)\b|等等|等一下|但是等等/gi
const rows = []
let totalRead = 0
let totalCalls = 0
let totalDepth = 0
let totalHes = 0

for (const file of files) {
  const lines = readFileSync(join(dir, file), 'utf8').split('\n').filter(Boolean)
  let depth = 0
  let hes = 0
  const calls = []
  for (const line of lines) {
    let ev
    try { ev = JSON.parse(line) } catch { continue }
    if (ev.type === 'message' && ev.message?.role === 'assistant') {
      for (const b of ev.message.content ?? []) {
        if (b?.type === 'thinking' && typeof b.thinking === 'string') { depth += b.thinking.length; hes += (b.thinking.match(HES_RE) ?? []).length }
        if (b?.type === 'toolCall' && typeof b.name === 'string') {
          const cmd = String(b.arguments?.command ?? b.arguments?.i ?? '').trim()
          const bashRead = b.name === 'bash' && /^(ls|cat|head|tail|find|wc|diff|grep|sed -n|type)/.test(cmd)
          calls.push({ name: b.name, read: b.name === 'read' || b.name === 'glob' || b.name === 'grep' || b.name === 'search' || bashRead })
        }
      }
    }
  }
  const read = calls.filter((c) => c.read).length
  totalRead += read
  totalCalls += calls.length
  totalDepth += depth
  totalHes += hes
  rows.push({ file: file.slice(0, 8), depth, hes, calls: calls.length, read, first: calls[0]?.name ?? '(none)', firstRead: calls[0]?.read ?? false })
}

console.log('turn | first | read% | depth | hes | calls')
for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  console.log(`t${i + 1} | ${r.first} | ${r.firstRead ? 'R' : 'W'} | ${r.depth} | ${r.hes} | ${r.calls}`)
}
console.log(`\ntotals: depth=${totalDepth} hes=${totalHes} read=${totalRead}/${totalCalls} (${Math.round(100 * totalRead / Math.max(1, totalCalls))}%)`)
