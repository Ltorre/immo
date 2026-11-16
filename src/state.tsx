import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_MARKET, DEFAULT_PROFILE, DEFAULT_RENT, newOption } from './engine/defaults'
import { DEFAULT_MC, type McParams } from './engine/montecarlo'
import { DEFAULT_PTZ, type PtzInputs } from './engine/ptz'
import type { Lang, Market, Profile, PropertyOption, RentPlan, Scenario } from './engine/types'
import { dictionaries, type Key } from './i18n'

export interface AppState {
  lang: Lang
  profile: Profile
  rent: RentPlan
  market: Market
  options: PropertyOption[]
  selectedId: string
  /** Show amounts in today's euros (inflation removed). */
  real: boolean
  mc: McParams
  ptz: PtzInputs
}

const STORAGE_KEY = 'immo:v1'
const THEME_KEY = 'immo:theme'

export function detectLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  } catch {
    return 'fr'
  }
}

export function initialState(): AppState {
  const opt = newOption('')
  return {
    lang: detectLang(),
    profile: structuredClone(DEFAULT_PROFILE),
    rent: { ...DEFAULT_RENT },
    market: structuredClone(DEFAULT_MARKET),
    options: [opt],
    selectedId: opt.id,
    real: true,
    mc: { ...DEFAULT_MC },
    ptz: { ...DEFAULT_PTZ },
  }
}

/** Fill whatever an older saved state lacks with the current defaults. */
function revive(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<AppState>
  const base = initialState()
  const options = Array.isArray(r.options) && r.options.length > 0
    ? r.options.map((o) => ({ ...newOption(''), ...o }))
    : base.options
  const selectedId = options.some((o) => o.id === r.selectedId) ? (r.selectedId as string) : options[0].id
  return {
    lang: r.lang === 'en' || r.lang === 'fr' ? r.lang : base.lang,
    profile: { ...base.profile, ...r.profile, existingPea: { ...base.profile.existingPea, ...r.profile?.existingPea } },
    rent: { ...base.rent, equivalentYield: null, ...r.rent },
    market: { ...base.market, ...r.market },
    options,
    selectedId,
    real: typeof r.real === 'boolean' ? r.real : base.real,
    mc: { ...base.mc, ...r.mc },
    ptz: { ...base.ptz, ...r.ptz },
  }
}

function encodeShare(s: AppState): string {
  const json = JSON.stringify(s)
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeShare(code: string): AppState | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b64)))
    return revive(JSON.parse(json))
  } catch {
    return null
  }
}

function loadState(): AppState {
  try {
    const m = window.location.hash.match(/[#&]s=([^&]+)/)
    if (m) {
      const fromLink = decodeShare(m[1])
      if (fromLink) return fromLink
    }
  } catch { /* ignore */ }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const s = revive(JSON.parse(stored))
      if (s) return s
    }
  } catch { /* ignore */ }
  return initialState()
}

export type Fmt = ReturnType<typeof makeFmt>

function makeFmt(lang: Lang) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const eurF = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const numF = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  return {
    eur: (n: number) => eurF.format(Math.round(n)),
    /** Compact for chart axes: 120 k€. */
    eurShort: (n: number) => {
      const a = Math.abs(n)
      const sign = n < 0 ? '−' : ''
      if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(1).replace('.', lang === 'fr' ? ',' : '.')} M€`
      if (a >= 1_000) return `${sign}${numF.format(Math.round(a / 1000))} k€`
      return `${sign}${numF.format(Math.round(a))} €`
    },
    signed: (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + eurF.format(Math.abs(Math.round(n))),
    num: (n: number) => numF.format(n),
    pct: (x: number, digits = 1) =>
      `${(x * 100).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`.replace(' %', lang === 'fr' ? ' %' : '%'),
    /** "2026-11" → "novembre 2026". */
    month: (ym: string) => {
      const [y, m] = ym.split('-').map(Number)
      return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    },
    yrs: (n: number, digits = 1) => n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits }),
  }
}

interface Ctx {
  state: AppState
  /** Mutate a copy of the state. */
  update: (fn: (draft: AppState) => void) => void
  reset: () => void
  t: (key: Key, params?: Record<string, string | number>) => string
  fmt: Fmt
  scenario: Scenario
  option: PropertyOption
  shareLink: () => string
  theme: 'auto' | 'light' | 'dark'
  cycleTheme: () => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY)
      return v === 'light' || v === 'dark' ? v : 'auto'
    } catch {
      return 'auto'
    }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  useEffect(() => {
    document.documentElement.lang = state.lang
    document.title = dictionaries[state.lang]['app.title']
  }, [state.lang])

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'auto') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', theme)
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const update = useCallback((fn: (d: AppState) => void) => {
    setState((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  const reset = useCallback(() => setState((prev) => ({ ...initialState(), lang: prev.lang })), [])

  const value = useMemo<Ctx>(() => {
    const dict = dictionaries[state.lang]
    const t = (key: Key, params?: Record<string, string | number>) => {
      let s: string = dict[key] ?? key
      if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
      return s
    }
    const option = state.options.find((o) => o.id === state.selectedId) ?? state.options[0]
    return {
      state,
      update,
      reset,
      t,
      fmt: makeFmt(state.lang),
      option,
      scenario: { profile: state.profile, rent: state.rent, market: state.market, option },
      shareLink: () => `${window.location.origin}${window.location.pathname}#s=${encodeShare(state)}`,
      theme,
      cycleTheme: () => setTheme((x) => (x === 'auto' ? 'light' : x === 'light' ? 'dark' : 'auto')),
    }
  }, [state, update, reset, theme])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}
