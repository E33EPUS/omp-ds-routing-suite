#!/usr/bin/env node
/**
 * e4-routes.mjs — tool-sequence analysis for E4 chain sessions.
 * Classifies each tool call as read-class or write-class:
 *   read tools: read|glob|grep|search
 *   bash: read-class if the command starts with an inspection verb
 *         (ls/cat/head/tail/find/wc/diff/sed -n/grep), else write-class
 *         (node/npm/write/cp/mkdir)
 *   write tools: write|edit|todo|other
 * Reports read ratio (paper P21's "read continuity" analog) and the first
 * tool per task-turn for fix turns (t2/t4/t6/t8 positions).
 * usage: node bench/e4-routes.mjs <session.jsonl>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)

const turns = [] // one per assistant message with tool calls
let pending = null
for (const line of lines) {
  let ev
  try { ev = JSON.parse(line) } catch { continue }
  if (ev.type === 'message' && ev.message?.role === 'assistant') {
    const calls = []
    for (const b of ev.message.content ?? []) {
      if (b?.type === 'toolCall' && typeof b.name === 'string') {
        const cmd = (b.arguments?.command ?? b.arguments?.i ?? '')
        const bashRead = b.name === 'bash' && /^(ls|cat|head|tail|find|wc|diff|grep|sed -n|node -e|type)/.test(String(cmd).trim())
        calls.push({ name: b.name, read: b.name === 'read' || b.name === 'glob' || b.name === 'grep' || b.name === 'search' || bashRead, cmd: String(cmd).trim().slice(0, 50) })
      }
    }
    if (calls.length > 0) turns.push(calls)
  }
}

let readCalls = 0
let totalCalls = 0
console.log('turn | first | first-read? | calls')
for (let i = 0; i < turns.length; i++) {
  const calls = turns[i]
  const first = calls[0]
  const isFixTurn = [1, 3, 5, 7].includes(i) // t2/t4/t6/t8 positions (0-based odd)
  totalCalls += calls.length
  readCalls += calls.filter((c) => c.read).length
  console.log(`${'t' + (i + 1)}${isFixTurn ? '(fix)' : ''} | ${first.name} | ${first.read ? 'READ' : 'write'} | ${calls.map((c) => `${c.name}${c.read ? '*' : ''}`).join(',')}`)
}
console.log(`\nread-class calls: ${readCalls}/${totalCalls} (${Math.round(100 * readCalls / Math.max(1, totalCalls))}%) — paper P21 read-continuity analog`)
console.log(`fix turns (t2/t4/t6/t8): read-first ${turns.filter((c, i) => [1, 3, 5, 7].includes(i) && c[0].read).length}/${turns.filter((c, i) => [1, 3, 5, 7].includes(i)).length}`)
