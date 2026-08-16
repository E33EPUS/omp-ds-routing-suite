/**
 * tools.ts — agent-visible router tools: dev_router_status / dev_router_mode.
 * Same names as the DSH originals so the agent can self-optimize identically.
 */
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'
import type { RouterState } from './state.ts'
import { bandFor, coreFor, parseMode, personaFor, testinessFor } from './core.ts'

interface ToolServices {
  state: RouterState
  modelId: () => string | null
  currentMode: () => unknown
  log: (msg: string) => void
}

export function registerTools(pi: ExtensionAPI, services: ToolServices): void {
  const { state, log } = services
  const z = pi.zod

  pi.registerTool({
    name: 'dev_router_status',
    label: 'Router Status',
    description: "Show this session's reasoning-mode routing: mode, band, persona, first-turn core tools, anchor state, and whether an override is active.",
    parameters: z.object({}),
    async execute() {
      log('dev_router_status invoked')
      const mode = state.effectiveMode()
      if (mode === 'native') {
        return { content: [{ type: 'text', text: 'router-mode=native (router off — native OMP composition)' }], details: {} }
      }
      return {
        content: [{
          type: 'text',
          text: [
            `mode=${mode} (band=${bandFor(mode)})`,
            `model=${services.modelId() ?? 'unknown'}`,
            `persona=${personaFor(mode, services.modelId()).replace(/\n/g, ' / ')}`,
            `core=[${coreFor(mode).join(', ')}]`,
            `testiness=${testinessFor(mode)}`,
            `anchored=${state.anchored} | narrow=${state.narrowEngaged} | round=${state.round}`,
            `override=${state.modeOverride === null ? 'no' : state.modeOverride}`,
          ].join('\n'),
        }],
        details: {},
      }
    },
  })

  pi.registerTool({
    name: 'dev_router_mode',
    label: 'Router Mode',
    description: "Set this session's reasoning mode: weak (model decides per task) / spec (plan-first) / react (doer) / native (router off) / auto (classify first message). Accepts band names, 0-100, or 0.0-1.0 (quantized to the measured bands). The next request applies it.",
    parameters: z.object({
      mode: z.string().describe('band name (weak / spec / react / native / auto), 0-100, or 0.0-1.0'),
    }),
    async execute(_toolCallId, params: { mode?: string }) {
      const token = (params.mode ?? '').trim().toLowerCase()
      if (token === 'auto') {
        state.modeOverride = 'auto'
      } else if (token === 'native') {
        state.modeOverride = 'native'
      } else {
        const parsed = parseMode(token)
        if (parsed === null) {
          return {
            content: [{ type: 'text', text: `invalid mode "${params.mode}": use weak/spec/react/native/auto, 0-100, or 0.0-1.0` }],
            details: {},
          }
        }
        state.modeOverride = parsed as never
      }
      const current = state.effectiveMode()
      return {
        content: [{ type: 'text', text: `mode=${current} (band=${bandFor(current)}) — next request applies` }],
        details: {},
      }
    },
  })
}
