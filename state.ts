/**
 * state.ts — per-session routing state + settings persistence.
 * Mirrors dsh-router-standard's durable-event semantics: the mode is derived
 * from the first real user message (captured at `input`, before any
 * assembly), the anchor phase from the first durable tool result.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { classifyTask, type Mode } from './core.ts'

export type RouterMode = 'weak' | 'spec' | 'react' | 'native' | 'auto'

export interface RouterSettings {
  /** Default routing mode for new sessions ('auto' classifies, else fixed). */
  mode: RouterMode
  /** System composition: 'replace' = persona only (SeekAnchor-verified path);
   *  'prepend' = persona on top of the native OMP system prompt. */
  systemMode: 'replace' | 'prepend'
  /** Near-field guidance injection on/off. */
  guide: boolean
  /** First-turn tool anchoring on/off. */
  anchor: boolean
}

export const DEFAULT_SETTINGS: RouterSettings = {
  mode: 'weak',
  systemMode: 'replace',
  guide: true,
  anchor: true,
}

/** First-message classification with chat/empty fallback to weak. */
export function classifyFirst(text: string | null | undefined): Mode {
  if (typeof text !== 'string' || text.trim() === '') return 'weak'
  const c = classifyTask(text)
  if (c === 'react') return 1
  if (c === 'spec') return 0
  return 'weak'
}

export class RouterState {
  settings: RouterSettings = { ...DEFAULT_SETTINGS }
  /** Live mode override for this session (set via /dsr-mode or dev_router_mode). */
  modeOverride: Mode | 'auto' | null = null
  /** Round counter for real user messages (1-based). */
  round = 0
  /** First real user message text — captured at `input`, BEFORE assembly. */
  firstUserText: string | null = null
  /** True once the first durable tool result arrived (anchor phase done). */
  anchored = false
  /** True while the first-turn narrow tool surface is engaged. */
  narrowEngaged = false
  /** True when the router persona is currently mounted as system prompt. */
  personaMounted = false
  /** Native OMP tool names, captured at session_start. */
  nativeToolNames: string[] = []
  /** Native OMP system prompt, captured at first before_agent_start. */
  nativeSystemPrompt: string | null = null
  /** Pending guidance text to append on the next provider request. */
  pendingGuide: string | null = null
  /** Last user text seen at `input` (for guideFor). */
  lastInputText: string | null = null

  sessionId: string | null = null
  cwd: string | null = null

  settingsFile(): string {
    return join(this.cwd ?? process.cwd(), '.omp', 'ds-router-suite', 'settings.json')
  }

  loadSettings(): void {
    try {
      const file = this.settingsFile()
      if (!existsSync(file)) return
      const stored = JSON.parse(readFileSync(file, 'utf8')) as Partial<RouterSettings>
      this.settings = { ...DEFAULT_SETTINGS, ...stored }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }

  persistSettings(): void {
    try {
      const file = this.settingsFile()
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify(this.settings, null, 2)}\n`, 'utf8')
    } catch {
      // Settings persistence must not interrupt the agent loop.
    }
  }

  /** Reset per-session state (session_start / session_branch / switch). */
  resetForSession(sessionId: string | null, cwd: string): void {
    this.sessionId = sessionId
    this.cwd = cwd
    this.modeOverride = null
    this.round = 0
    this.firstUserText = null
    this.anchored = false
    this.narrowEngaged = false
    this.personaMounted = false
    this.nativeToolNames = []
    this.nativeSystemPrompt = null
    this.pendingGuide = null
    this.lastInputText = null
    this.loadSettings()
  }

  /** Effective mode: override wins, else the configured session mode. */
  effectiveMode(): Mode {
    if (this.modeOverride !== null && this.modeOverride !== 'auto') return this.modeOverride
    if (this.modeOverride === 'auto' || this.settings.mode === 'auto') {
      return classifyFirst(this.firstUserText)
    }
    switch (this.settings.mode) {
      case 'spec': return 0
      case 'react': return 1
      case 'native': return 'native'
      case 'weak':
      default: return 'weak'
    }
  }

  /** Handle one real user message (called from the `input` hook). */
  onUserInput(text: string): void {
    this.round += 1
    this.lastInputText = text
    if (this.firstUserText === null && text.trim()) {
      this.firstUserText = text.trim()
    }
  }
}
