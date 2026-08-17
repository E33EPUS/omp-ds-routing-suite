#!/usr/bin/env node
/**
 * e4r-trend.mjs — per-turn hesitation/depth trends for E4-R chains.
 * Tests the "long-horizon hesitation runaway" hypothesis: if hesitation
 * density rises across turns, long chains degenerate; if it is flat or
 * falls, hesitation is a stable depth companion.
 * Also counts tool errors per turn (from toolResult messages) as a
 * per-turn quality proxy.
 * usage: node bench/e4r-trend.mjs <session-dir-prefix>
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const prefix = process.argv[2]
const dir = join('C:/Users/NIUQU/.omp/agent/sessions', prefix)
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()

const HES_RE = /\b(?:but wait|wait|hold on|hmm)\b|等等|等一下/gi
const rows = []
for (const file of files) {
  const lines = readFileSync(join(dir, file), 'utf8').split('\n').filter(Boolean)
  let depth = 0, hes = 0, errors = 0
  for (const line of lines) {
    let ev
    try { ev = JSON.parse(line) } catch { continue }
    if (ev.type === 'message' && ev.message?.role === 'assistant') {
      for (const b of ev.message.content ?? []) {
        if (b?.type === 'thinking' && typeof b.thinking === 'string') {
          depth += b.thinking.length
          hes += (b.thinking.match(HES_RE) ?? []).length
        }
      }
    }
    if (ev.type === 'message' && ev.message?.role === 'toolResult') {
      // toolResult messages may carry isError or an error block
      const err = ev.message.isError ?? ev.message.content?.some?.((b) => b?.type === 'toolResult' && b.isError)
      if (err) errors++
    }
    if (ev.type === 'custom' && /error/i.test(JSON.stringify(ev.data ?? '').slice(0, 120))) errors++
  }
  rows.push({ turn: rows.length + 1, depth, hes, errors, dens: +(hes / (depth / 1000)).toFixed(2) })
}

console.log('turn | depth | hes | dens/K | tool-errors')
for (const r of rows) console.log(`${r.turn} | ${r.depth} | ${r.hes} | ${r.dens} | ${r.errors}`)
// trend: first half vs second half
if (rows.length >= 4) {
  const half = Math.floor(rows.length / 2)
  const f = rows.slice(0, half)
  const s = rows.slice(half)
  const avg = (rs, k) => +(rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(1)
  console.log(`\nfirst-half avg: depth=${avg(f, 'depth')} hes=${avg(f, 'hes')} dens=${avg(f, 'dens')}`)
  console.log(`second-half avg: depth=${avg(s, 'depth')} hes=${avg(s, 'hes')} dens=${avg(s, 'dens')}`)
}
