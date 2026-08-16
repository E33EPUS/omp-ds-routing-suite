/**
 * integration.test.mjs — simulate the full OMP extension lifecycle against
 * a fake ExtensionAPI: session_start → input → before_agent_start →
 * before_provider_request → tool_result → next agent start.
 * Run: node --test tests/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.DS_ROUTER_DIAG_LOG = 'off' // keep test runs out of the real diagnostics log
import dsRouterSuite from '../index.ts'

/** Minimal fake of the OMP ExtensionAPI surface the suite touches. */
function makePi() {
  const handlers = new Map()
  const tools = []
  const commands = []
  let activeTools = ['bash', 'read', 'write', 'edit', 'glob', 'grep', 'web_search']
  let model = { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' }
  const events = []

  const pi = {
    on: (name, handler) => handlers.set(name, handler),
    registerTool: (def) => tools.push(def),
    registerCommand: (name, def) => commands.push({ name, def }),
    getActiveTools: () => [...activeTools],
    setActiveTools: (names) => { activeTools = [...names]; events.push(['setActiveTools', [...names]]) },
    model,
    zod: {
      object: (shape) => ({ shape }),
      string: () => ({ describe: () => ({ type: 'string' }) }),
    },
  }

  return {
    pi,
    handlers,
    tools,
    commands,
    getActiveTools: () => [...activeTools],
    events,
    setModel: (m) => { model = m; pi.model = m },
  }
}

async function runFlow(h, pi, steps) {
  for (const step of steps) {
    const handler = h.get(step.name)
    if (!handler) throw new Error(`no handler for ${step.name}`)
    const result = await handler(step.event ?? {}, step.ctx ?? {})
    if (step.capture) step.capture(result)
  }
}

test('resident mode promotes to the narrow set, not the full catalog', async () => {
  const { pi, handlers, getActiveTools, events } = makePi()
  const tmp = mkdtempSync(join(tmpdir(), 'dsr-test-'))
  mkdirSync(join(tmp, '.omp', 'ds-routing-suite'), { recursive: true })
  writeFileSync(
    join(tmp, '.omp', 'ds-routing-suite', 'settings.json'),
    JSON.stringify({ mode: 'weak', systemMode: 'replace', guide: true, anchor: true, resident: true }),
  )
  dsRouterSuite(pi)

  await handlers.get('session_start')({ sessionId: 's-r' }, { cwd: tmp, model: { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' } })
  await handlers.get('input')({ text: '写一个网页游戏' }, {})

  await runFlow(handlers, pi, [{ name: 'before_agent_start', event: { systemPrompt: ['OMP native system...'] } }])
  assert.deepEqual(getActiveTools(), ['bash', 'edit'])

  await handlers.get('tool_result')({ toolName: 'bash', isError: false })
  assert.deepEqual(getActiveTools(), ['bash', 'edit', 'read', 'write']) // resident narrow set
  assert.ok(!events.some(([name, names]) => name === 'setActiveTools' && names.length === 7))
})

test('full lifecycle: weak mode anchors, guides, then promotes', async () => {
  const { pi, handlers, tools, commands, getActiveTools, events } = makePi()
  dsRouterSuite(pi)

  assert.ok(handlers.has('session_start'))
  assert.ok(handlers.has('input'))
  assert.ok(handlers.has('before_agent_start'))
  assert.ok(handlers.has('before_provider_request'))
  assert.ok(handlers.has('tool_result'))
  assert.ok(tools.some((t) => t.name === 'dev_router_status'))
  assert.ok(tools.some((t) => t.name === 'dev_router_mode'))
  assert.ok(commands.some((c) => c.name === 'dsr-mode'))
  assert.ok(commands.some((c) => c.name === 'dsr-status'))

  // 1. session_start: capture native tools
  await handlers.get('session_start')({ sessionId: 's1' }, { cwd: 'D:/tmp/proj', model: { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' } })

  // 2. user input: build task
  await handlers.get('input')({ text: '写一个网页游戏' }, {})

  // 3. before_agent_start: persona mount + tool narrowing
  let systemPrompt = null
  await runFlow(handlers, pi, [{ name: 'before_agent_start', event: { systemPrompt: ['OMP native system...'] }, capture: (r) => { systemPrompt = r?.systemPrompt } }])
  const sp = Array.isArray(systemPrompt) ? systemPrompt.join('\n') : (systemPrompt ?? '')
  assert.match(sp, /helpful assistant/)
  assert.match(sp, /Think deeply first/)
  assert.match(sp, /Never read credential or secret files/) // first-turn safety rules
  assert.deepEqual(getActiveTools(), ['bash', 'edit']) // RL-shape narrow surface
  assert.ok(events.some(([name, names]) => name === 'setActiveTools' && names.length === 2))

  // 4. provider request: guidance appended to message tail
  const payload = { messages: [{ role: 'user', content: '写一个网页游戏' }] }
  const returned = await handlers.get('before_provider_request')({ payload })
  assert.equal(returned.messages.length, 2)
  assert.match(returned.messages[1].content, /classify this task/)
  assert.match(returned.messages[1].content, /commit and act/) // simple-length task -> commit tail

  // 5. tool_result (first durable call): promote full catalog
  await handlers.get('tool_result')({ toolName: 'bash', isError: false })
  assert.deepEqual(getActiveTools(), ['bash', 'read', 'write', 'edit', 'glob', 'grep', 'web_search'])

  // 6. next agent start: persona + native sections both present, no re-narrowing
  let secondSystem = null
  await runFlow(handlers, pi, [{ name: 'before_agent_start', event: { systemPrompt: ['OMP native system...'] }, capture: (r) => { secondSystem = r?.systemPrompt } }])
  assert.ok(Array.isArray(secondSystem))
  assert.equal(secondSystem.length, 2) // [persona, native]
  assert.match(secondSystem[0], /helpful assistant/)
  assert.equal(secondSystem[1], 'OMP native system...') // memory/AGENTS.md restored
  assert.ok(!secondSystem.join('\n').includes('Never read credential')) // safety rules first-turn only
  assert.deepEqual(getActiveTools(), ['bash', 'read', 'write', 'edit', 'glob', 'grep', 'web_search'])
})

test('complex task gets deep guidance with no closure on Flash', async () => {
  const { pi, handlers } = makePi()
  dsRouterSuite(pi)
  await handlers.get('session_start')({ sessionId: 's2' }, { cwd: 'D:/tmp/proj', model: { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' } })
  await handlers.get('input')({ text: '设计一个系统的架构，包括详细设计文档' }, {})
  const payload = { messages: [{ role: 'user', content: '设计一个系统的架构' }] }
  const returned = await handlers.get('before_provider_request')({ payload })
  assert.match(returned.messages[1].content, /architecture, edge cases/)
  assert.doesNotMatch(returned.messages[1].content, /End each reasoning block/)
})

test('chat message gets no guidance and no anchor change', async () => {
  const { pi, handlers, getActiveTools } = makePi()
  dsRouterSuite(pi)
  await handlers.get('session_start')({ sessionId: 's3' }, { cwd: 'D:/tmp/proj', model: { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' } })
  await handlers.get('input')({ text: '你好' }, {})
  const payload = { messages: [{ role: 'user', content: '你好' }] }
  const returned = await handlers.get('before_provider_request')({ payload })
  assert.equal(returned.messages.length, 1) // no guidance appended
  assert.deepEqual(getActiveTools(), ['bash', 'read', 'write', 'edit', 'glob', 'grep', 'web_search']) // untouched
})

test('slash command input is not counted as a user task', async () => {
  const { pi, handlers } = makePi()
  dsRouterSuite(pi)
  await handlers.get('session_start')({ sessionId: 's5' }, { cwd: 'D:/tmp/proj', model: { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' } })
  await handlers.get('input')({ text: '/dsr-status' }, {})
  const payload = { messages: [{ role: 'user', content: '/dsr-status' }] }
  const returned = await handlers.get('before_provider_request')({ payload })
  assert.equal(returned.messages.length, 1) // no guidance appended for commands

  // next real message is round 1 -> GUIDE_BASE, not boost
  await handlers.get('input')({ text: '写一个网页游戏' }, {})
  const payload2 = { messages: [{ role: 'user', content: '写一个网页游戏' }] }
  const returned2 = await handlers.get('before_provider_request')({ payload: payload2 })
  assert.equal(returned2.messages.length, 2)
  assert.match(returned2.messages[1].content, /classify this task \(build or fix\) now/)
  assert.doesNotMatch(returned2.messages[1].content, /NEW task/)
})

test('native mode drops stale pendingGuide without injecting', async () => {
  const { pi, handlers, tools } = makePi()
  dsRouterSuite(pi)
  await handlers.get('session_start')({ sessionId: 's6' }, { cwd: 'D:/tmp/proj' })
  // queue a guide on a weak-mode message
  await handlers.get('input')({ text: '写一个网页游戏' }, {})
  // switch to native via the tool
  const def = tools.find((t) => t.name === 'dev_router_mode')
  await def.execute('id', { mode: 'native' })
  // provider request must NOT carry the stale guide
  const payload = { messages: [{ role: 'user', content: '任务' }] }
  const returned = await handlers.get('before_provider_request')({ payload })
  assert.equal(returned.messages.length, 1) // no injection
  assert.doesNotMatch(returned.messages[0].content, /Router:/)
})

test('native mode leaves everything alone', async () => {
  const { pi, handlers, tools, getActiveTools } = makePi()
  dsRouterSuite(pi)
  await handlers.get('session_start')({ sessionId: 's4' }, { cwd: 'D:/tmp/proj', model: { provider: 'deepseek-anthropic', id: 'deepseek-v4-flash' } })

  // switch to native via the dev_router_mode tool
  const def = tools.find((t) => t.name === 'dev_router_mode')
  const res = await def.execute('id', { mode: 'native' })
  assert.match(res.content[0].text, /native/)

  await handlers.get('input')({ text: '写一个网页游戏' }, {})
  let systemPrompt = 'SENTINEL'
  const result = await handlers.get('before_agent_start')({ systemPrompt: 'OMP native system...' })
  if (result && typeof result === 'object') systemPrompt = result.systemPrompt
  assert.equal(systemPrompt, 'SENTINEL') // native: no persona mount
  assert.deepEqual(getActiveTools(), ['bash', 'read', 'write', 'edit', 'glob', 'grep', 'web_search']) // untouched
})
