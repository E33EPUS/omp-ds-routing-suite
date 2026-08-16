/**
 * commands.ts — /dsr-mode and /dsr-status slash commands.
 */
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'
import type { RouterState } from './state.ts'
import { bandFor, parseMode } from './core.ts'

interface CommandServices {
  state: RouterState
  modelId: () => string | null
  currentMode: () => unknown
}

const MODE_NAMES = ['weak', 'spec', 'react', 'native', 'auto']

export function registerCommands(pi: ExtensionAPI, services: CommandServices): void {
  const { state } = services

  pi.registerCommand('dsr-mode', {
    description: 'Set the reasoning-mode router: weak (model classifies) | spec (plan-first) | react (doer) | native (off) | auto (classify first message) | 0-100 | 0.0-1.0',
    getArgumentCompletions: (prefix: string) =>
      [...MODE_NAMES, '0', '0.3', '0.5', '1']
        .filter((value) => value.startsWith(prefix))
        .map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      const token = args?.trim()
      if (!token) {
        ctx.ui.notify(`Usage: /dsr-mode <${MODE_NAMES.join('|')}|0-100|0.0-1.0> (current: ${describeMode(state)})`, 'warning')
        return
      }
      const lower = token.toLowerCase()
      if (lower === 'auto') {
        state.modeOverride = 'auto'
      } else if (lower === 'native') {
        state.modeOverride = 'native'
      } else {
        const parsed = parseMode(token)
        if (parsed === null) {
          ctx.ui.notify(`Invalid mode "${token}": use ${MODE_NAMES.join('/')}, 0-100, or 0.0-1.0`, 'warning')
          return
        }
        state.modeOverride = parsed as never
      }
      ctx.ui.notify(`Router mode override: ${describeMode(state)} (next request applies)`, 'info')
    },
  })

  pi.registerCommand('dsr-status', {
    description: 'Show reasoning-mode router status',
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        [
          `mode: ${describeMode(state)}`,
          `model: ${services.modelId() ?? 'unknown'}`,
          `round: ${state.round} | anchored: ${state.anchored} | narrow: ${state.narrowEngaged}`,
          `first user text: ${state.firstUserText ? truncate(state.firstUserText, 60) : '(none yet)'}`,
          `system: ${state.settings.systemMode} | guide: ${state.settings.guide} | anchor: ${state.settings.anchor}`,
          `pending guide: ${state.pendingGuide ? 'yes' : 'no'}`,
          `active tools: ${safeActiveTools(pi).join(', ') || '(none)'}`,
          `settings file: ${state.settingsFile()}`,
        ].join('\n'),
        'info',
      )
    },
  })
}

function describeMode(state: RouterState): string {
  const mode = state.effectiveMode()
  if (mode === 'native') return 'native (router off)'
  return `${mode} (band=${bandFor(mode)})`
}

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n)}…` : text
}

function safeActiveTools(pi: ExtensionAPI): string[] {
  try {
    return [...pi.getActiveTools()]
  } catch {
    return []
  }
}
