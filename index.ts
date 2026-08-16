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
import { RouterState } from './state.ts'
import { bandFor, coreFor, guideFor, isFlashModel, parseMode, personaFor, testinessFor, type Mode } from './core.ts'
import { registerCommands } from './commands.ts'
import { registerTools } from './tools.ts'

export default function dsRouterSuite(pi: ExtensionAPI): void {
  const state = new RouterState()

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
  })

  pi.on('session_branch', async (event, ctx) => {
    const cwd = ctx.cwd ?? process.cwd()
    state.resetForSession(event.sessionId ?? null, cwd)
    try {
      state.nativeToolNames = [...pi.getActiveTools()]
    } catch {
      state.nativeToolNames = []
    }
  })

  // ── user input: round counting + near-field guidance queue ──────────────
  pi.on('input', async (event, _ctx) => {
    const text = extractInputText(event)
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
    if (mode === 'native') return undefined
    if (state.nativeSystemPrompt === null && typeof event.systemPrompt === 'string') {
      state.nativeSystemPrompt = event.systemPrompt
    }
    // Anchor: narrow the tool surface until the first durable tool result.
    if (state.settings.anchor && !state.anchored) {
      const core = coreFor(mode)
      try {
        pi.setActiveTools(core)
        state.narrowEngaged = true
      } catch {
        state.narrowEngaged = false
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
    if (!payload || !Array.isArray(payload.messages)) return payload
    if (state.pendingGuide) {
      ;(payload.messages as unknown[]).push({ role: 'user', content: state.pendingGuide })
      state.pendingGuide = null
    }
    return payload
  })

  // ── first durable tool result: anchor phase ends, full catalog returns ──
  pi.on('tool_result', async (event) => {
    if (event.isError || state.anchored) return
    state.anchored = true
    if (state.narrowEngaged) restoreNativeTools()
  })

  function restoreNativeTools(): void {
    try {
      if (state.nativeToolNames.length > 0) {
        pi.setActiveTools([...state.nativeToolNames])
      }
    } catch {
      // Ignore — the catalog will refresh on the next agent start.
    }
    state.narrowEngaged = false
  }

  registerTools(pi, { state, modelId, currentMode })
  registerCommands(pi, { state, modelId, currentMode })
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
