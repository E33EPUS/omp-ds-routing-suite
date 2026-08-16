/**
 * index.ts — omp-ds-router-suite extension entry.
 *
 * DeepSeek reasoning-mode router for Oh My Pi, porting the measured
 * mechanisms of dsh-router-standard / dsh-mode-boost (MIT):
 *
 *   session_start          → reset state, capture native tool names
 *   input                  → count real user rounds, capture first text,
 *                            queue near-field guidance (weak mode)
 *   before_agent_start     → first-turn tool anchoring + persona mount
 *   before_provider_request→ append pending guidance to the message tail
 *   tool_result            → first durable tool result promotes the full
 *                            tool catalog (anchor phase ends)
 *
 * The transition band is never selected automatically; numeric modes
 * quantize to the measured bands.
 */
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'
import { appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { RouterState } from './state.ts'
import { bandFor, coreFor, guideFor, isFlashModel, parseMode, personaFor, testinessFor, type Mode } from './core.ts'
import { registerCommands } from './commands.ts'
import { registerTools } from './tools.ts'

/** Best-effort diagnostics log (never throws). */
const DIAG_LOG = join(homedir(), '.omp', 'logs', 'ds-router-suite.log')
function log(msg: string): void {
  try {
    appendFileSync(DIAG_LOG, `${new Date().toISOString()} ${msg}\n`)
  } catch {
    // diagnostics must never break the agent loop
  }
}

export default function dsRouterSuite(pi: ExtensionAPI): void {
  const state = new RouterState()
  log('loaded: factory running')

  const modelId = (): string | null => {
    try {
      const m = pi.model
      if (m && typeof m === 'object') {
        const id = (m as { id?: string }).id
        if (id) return id
        const provider = (m as { provider?: string }).provider
        if (provider) return provider
      }
    } catch {
      // ctx.model is unavailable in some runtimes; treat as unknown.
    }
    return null
  }

  const currentMode = (): Mode => {
    const mode = state.effectiveMode()
    return mode === 'native' ? 'native' : mode
  }

  /** System prompt for the router persona (mounted every agent start). */
  const personaSystem = (): string => {
    const mode = currentMode()
    if (mode === 'native') return ''
    const persona = personaFor(mode, modelId())
    if (state.settings.systemMode === 'prepend' && state.nativeSystemPrompt) {
      return `${persona}\n\n${state.nativeSystemPrompt}`
    }
    return persona
  }

  // ── session lifecycle ────────────────────────────────────────────────────
  pi.on('session_start', async (event, ctx) => {
    const cwd = ctx.cwd ?? process.cwd()
    state.resetForSession(event.sessionId ?? null, cwd)
    try {
      state.nativeToolNames = [...pi.getActiveTools()]
    } catch {
      state.nativeToolNames = []
    }
    log(`session_start id=${state.sessionId ?? '?'} cwd=${cwd} tools=[${state.nativeToolNames.join(',')}]`)
  })

  pi.on('session_branch', async (event, ctx) => {
    const cwd = ctx.cwd ?? process.cwd()
    state.resetForSession(event.sessionId ?? null, cwd)
    try {
      state.nativeToolNames = [...pi.getActiveTools()]
    } catch {
      state.nativeToolNames = []
    }
    log(`session_branch id=${state.sessionId ?? '?'}`)
  })

  // ── user input: round counting + near-field guidance queue ──────────────
  pi.on('input', async (event, _ctx) => {
    const text = extractInputText(event)
    log(`input event=${safeEventShape(event)} text=${text ? JSON.stringify(text.slice(0, 80)) : 'null'}`)
    if (!text) return
    state.onUserInput(text)
    const mode = currentMode()
    if (mode === 'native') return
    if (!state.settings.guide) return
    const guide = guideFor(state.round, text, modelId(), bandIsWeak(mode))
    if (guide !== null) state.pendingGuide = guide
  })

  // ── agent start: persona mount + first-turn tool anchoring ──────────────
  pi.on('before_agent_start', async (event) => {
    const mode = currentMode()
    log(`before_agent_start mode=${mode} anchored=${state.anchored} narrow=${state.narrowEngaged} spType=${typeof event.systemPrompt} spLen=${Array.isArray(event.systemPrompt) ? event.systemPrompt.length : String(event.systemPrompt ?? '').length}`)
    if (mode === 'native') return undefined
    if (state.nativeSystemPrompt === null && typeof event.systemPrompt === 'string') {
      state.nativeSystemPrompt = event.systemPrompt
    }
    // Anchor: narrow the tool surface until the first durable tool result.
    if (state.settings.anchor && !state.anchored) {
      const core = coreFor(mode)
      try {
        await pi.setActiveTools(core)
        state.narrowEngaged = true
        log(`before_agent_start narrow -> [${core.join(',')}]`)
      } catch (err) {
        state.narrowEngaged = false
        log(`before_agent_start setActiveTools FAILED: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else if (state.narrowEngaged && state.anchored) {
      restoreNativeTools()
    }
    const system = personaSystem()
    return { systemPrompt: system }
  })

  // ── provider request: inject pending near-field guidance ────────────────
  pi.on('before_provider_request', (event) => {
    const payload = event.payload as Record<string, unknown> | undefined
    if (!payload || !Array.isArray(payload.messages)) {
      log(`before_provider_request payload? ${payload ? 'no messages array' : 'no payload'}`)
      return payload
    }
    log(`before_provider_request messages=${(payload.messages as unknown[]).length} pendingGuide=${state.pendingGuide !== null}`)
    if (state.pendingGuide) {
      ;(payload.messages as unknown[]).push({ role: 'user', content: state.pendingGuide })
      state.pendingGuide = null
    }
    return payload
  })

  // ── first durable tool result: anchor phase ends, full catalog returns ──
  pi.on('tool_result', async (event) => {
    log(`tool_result name=${event.toolName} isError=${event.isError} anchored=${state.anchored}`)
    if (event.isError || state.anchored) return
    state.anchored = true
    if (state.narrowEngaged) restoreNativeTools()
  })

  function restoreNativeTools(): void {
    try {
      if (state.nativeToolNames.length > 0) {
        void pi.setActiveTools([...state.nativeToolNames])
        log(`restoreNativeTools -> [${state.nativeToolNames.join(',')}]`)
      }
    } catch {
      // Ignore — the catalog will refresh on the next agent start.
    }
    state.narrowEngaged = false
  }

  registerTools(pi, { state, modelId, currentMode, log })
  registerCommands(pi, { state, modelId, currentMode, log })
}

function safeEventShape(event: unknown): string {
  if (typeof event !== 'object' || event === null) return 'non-object'
  const keys = Object.keys(event as Record<string, unknown>)
  return `{${keys.join(',')}}`
}

function bandIsWeak(mode: Mode): boolean {
  return mode === 'weak'
}

/** Defensively extract user text from the `input` event payload. */
function extractInputText(event: unknown): string | null {
  if (typeof event !== 'object' || event === null) return null
  const e = event as Record<string, unknown>
  const candidates: unknown[] = [
    e.text,
    e.content,
    (e.message as Record<string, unknown> | undefined)?.text,
    (e.message as Record<string, unknown> | undefined)?.content,
    (e.data as Record<string, unknown> | undefined)?.text,
    (e.data as Record<string, unknown> | undefined)?.content,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
  }
  return null
}
