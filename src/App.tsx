import { useEffect, useRef, useState } from 'react'
import { useMain } from './hooks'
import { useApp } from './state'
import About from './pages/About'
import Assumptions from './pages/Assumptions'
import Compare from './pages/Compare'
import Feasibility from './pages/Feasibility'
import Profile from './pages/Profile'
import Property from './pages/Property'
import Results from './pages/Results'
import Risk from './pages/Risk'

const INPUT_TABS = ['profile', 'property', 'assumptions'] as const
const ANALYSIS_TABS = ['results', 'compare', 'risk', 'feasibility'] as const
const ALL_TABS = [...INPUT_TABS, ...ANALYSIS_TABS, 'about'] as const
type Tab = (typeof ALL_TABS)[number]
type NavProps = { tab: Tab; setTab: (t: Tab) => void }

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill="#1f6f5c" /><path d="M6 16 16 7l10 9v9h-7v-6h-6v6H6z" fill="#fff" /></svg>
)

function UnitToggle() {
  const { t, state, update } = useApp()
  return (
    <div className="seg" role="group" aria-label={t('hdr.units')}>
      <button type="button" className={state.real ? 'on' : ''} onClick={() => update((d) => { d.real = true })} title={t('hdr.realTip')}>{t('hdr.real')}</button>
      <button type="button" className={!state.real ? 'on' : ''} onClick={() => update((d) => { d.real = false })} title={t('hdr.nominalTip')}>{t('hdr.nominal')}</button>
    </div>
  )
}

function LangToggle() {
  const { state, update } = useApp()
  return (
    <div className="seg" role="group" aria-label="Language">
      <button type="button" className={state.lang === 'fr' ? 'on' : ''} onClick={() => update((d) => { d.lang = 'fr' })} lang="fr">FR</button>
      <button type="button" className={state.lang === 'en' ? 'on' : ''} onClick={() => update((d) => { d.lang = 'en' })} lang="en">EN</button>
    </div>
  )
}

/** The "⋯" menu: share, print, theme, layout, method page, reset. */
function MoreMenu({ up, setTab, toast }: { up?: boolean; setTab: (t: Tab) => void; toast: (msg: string) => void }) {
  const { t, reset, shareLink, theme, cycleTheme, layout, toggleLayout } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const run = (fn: () => void) => () => { setOpen(false); fn() }
  const share = async () => {
    const link = shareLink()
    try {
      await navigator.clipboard.writeText(link)
      toast(t('hdr.copied'))
    } catch {
      window.prompt(t('hdr.copyManual'), link)
    }
  }
  const themeLabel = theme === 'auto' ? t('hdr.themeAuto') : theme === 'light' ? t('hdr.themeLight') : t('hdr.themeDark')
  const otherLayout = t(layout === 'top' ? 'menu.layoutSide' : 'menu.layoutTop')

  return (
    <div className="more" ref={ref}>
      <button type="button" className="btn ghost more-btn" aria-haspopup="menu" aria-expanded={open} aria-label={t('menu.more')} title={t('menu.more')} onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <div className={`pop ${up ? 'up' : ''}`} role="menu">
          <button type="button" role="menuitem" onClick={run(share)}>{t('hdr.share')}</button>
          <button type="button" role="menuitem" onClick={run(() => window.print())}>{t('hdr.print')}</button>
          <button type="button" role="menuitem" onClick={run(cycleTheme)}>{themeLabel}</button>
          <button type="button" role="menuitem" onClick={run(toggleLayout)}>{t('menu.switchTo', { mode: otherLayout })}</button>
          <hr />
          <button type="button" role="menuitem" onClick={run(() => setTab('about'))}>{t('nav.about')}</button>
          <button type="button" role="menuitem" className="danger" onClick={run(() => { if (window.confirm(t('hdr.resetConfirm'))) reset() })}>{t('hdr.reset')}</button>
        </div>
      )}
    </div>
  )
}

function TopBar({ tab, setTab, toast }: NavProps & { toast: (m: string) => void }) {
  const { t } = useApp()
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const on = nav?.querySelector<HTMLElement>('.tab.on')
    if (nav && on) nav.scrollTo({ left: on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2, behavior: 'auto' })
  }, [tab])
  const tabBtn = (k: Tab, i?: number) => (
    <button key={k} type="button" className={`tab ${tab === k ? 'on' : ''}`} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
      {i !== undefined && <span className="step">{i + 1}</span>}
      {t(`nav.${k}` as 'nav.results')}
    </button>
  )
  return (
    <header className="site-header topbar">
      <div className="wrap bar-row">
        <div className="brand"><Logo /><strong>{t('app.name')}</strong></div>
        <nav className="tabs main-tabs" aria-label="Sections" ref={navRef}>
          {INPUT_TABS.map((k, i) => tabBtn(k, i))}
          <span className="tab-sep" aria-hidden />
          {ANALYSIS_TABS.map((k) => tabBtn(k))}
        </nav>
        <div className="bar-right">
          <LangToggle />
          <MoreMenu setTab={setTab} toast={toast} />
        </div>
      </div>
    </header>
  )
}

function Sidebar({ tab, setTab, toast }: NavProps & { toast: (m: string) => void }) {
  const { t } = useApp()
  const link = (k: Tab, i?: number) => (
    <button key={k} type="button" className={`side-link ${tab === k ? 'on' : ''}`} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
      {i !== undefined && <span className="step">{i + 1}</span>}
      {t(`nav.${k}` as 'nav.results')}
    </button>
  )
  return (
    <aside className="sidebar">
      <div className="brand side-brand"><Logo /><strong>{t('app.name')}</strong></div>
      <nav aria-label="Sections" className="side-nav">
        <span className="side-label">{t('nav.groupInput')}</span>
        {INPUT_TABS.map((k, i) => link(k, i))}
        <div className="side-sep" />
        <span className="side-label">{t('nav.groupAnalysis')}</span>
        {ANALYSIS_TABS.map((k) => link(k))}
      </nav>
      <div className="side-bottom">
        <div className="side-sep" />
        <div className="side-tools"><LangToggle /><MoreMenu up setTab={setTab} toast={toast} /></div>
        {link('about')}
      </div>
    </aside>
  )
}

function SummaryBar({ go }: { go: (t: Tab) => void }) {
  const { t, fmt, state } = useApp()
  const { horizon, pt, adj } = useMain()
  const diff = adj(pt.diff, horizon)
  const close = Math.abs(diff) < 0.03 * Math.max(adj(pt.buyerNet, horizon), adj(pt.renterNet, horizon), 1)
  return (
    <div className="toolbar">
      <button type="button" className={`summary-bar ${close ? 'tie' : diff > 0 ? 'buy' : 'rent'}`} onClick={() => go('results')} title={t('nav.results')}>
        <span className="sb-label">{t('bar.label', { years: horizon })}</span>
        <span className="sb-value">{close ? t('bar.tie') : diff > 0 ? t('bar.buy') : t('bar.rent')} · {fmt.signed(diff)}</span>
        <span className="sb-unit">{state.real ? t('unit.real') : t('unit.nominal')}</span>
      </button>
      <UnitToggle />
    </div>
  )
}

export default function App() {
  const { t, layout } = useApp()
  const [tab, setTab] = useState<Tab>('results')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  const idx = INPUT_TABS.indexOf(tab as (typeof INPUT_TABS)[number])
  const content = (
    <>
      <main id="main" className="wrap page">
        {tab !== 'results' && tab !== 'about' && <SummaryBar go={setTab} />}
        {tab === 'results' && (
          <div className="intro intro-row">
            <div>
              <p>{t('intro.text')}</p>
              <p className="muted small">{t('intro.edit')} <button type="button" className="link" onClick={() => setTab('profile')}>{t('intro.start')}</button></p>
            </div>
            <UnitToggle />
          </div>
        )}
        {tab === 'profile' && <Profile />}
        {tab === 'property' && <Property />}
        {tab === 'assumptions' && <Assumptions />}
        {tab === 'results' && <Results go={(k) => setTab(k as Tab)} />}
        {tab === 'compare' && <Compare />}
        {tab === 'risk' && <Risk />}
        {tab === 'feasibility' && <Feasibility />}
        {tab === 'about' && <About />}
        {idx >= 0 && idx < INPUT_TABS.length - 1 && (
          <div className="next">
            <button type="button" className="btn primary" onClick={() => setTab(INPUT_TABS[idx + 1])}>{t('common.next')} →</button>
          </div>
        )}
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p>{t('footer.disclaimer')}</p>
          <p>
            <a href="https://github.com/Ltorre/immo" target="_blank" rel="noreferrer noopener">GitHub</a> ·{' '}
            <button type="button" className="link" onClick={() => setTab('about')}>{t('nav.about')}</button> · {t('footer.privacy')}
          </p>
        </div>
      </footer>
    </>
  )

  return (
    <>
      <a className="skip" href="#main">{t('hdr.skip')}</a>
      {layout === 'side' ? (
        <div className="shell side">
          <Sidebar tab={tab} setTab={setTab} toast={setToast} />
          <div className="shell-main">
            <div className="narrow-only"><TopBar tab={tab} setTab={setTab} toast={setToast} /></div>
            {content}
          </div>
        </div>
      ) : (
        <>
          <TopBar tab={tab} setTab={setTab} toast={setToast} />
          {content}
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
