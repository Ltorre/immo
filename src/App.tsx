import { useEffect, useState } from 'react'
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

const TABS = ['profile', 'property', 'assumptions', 'results', 'compare', 'risk', 'feasibility', 'about'] as const
type Tab = (typeof TABS)[number]

function SummaryBar({ go }: { go: (t: Tab) => void }) {
  const { t, fmt, state } = useApp()
  const { horizon, pt, adj } = useMain()
  const diff = adj(pt.diff, horizon)
  const close = Math.abs(diff) < 0.03 * Math.max(adj(pt.buyerNet, horizon), adj(pt.renterNet, horizon), 1)
  return (
    <button type="button" className={`summary-bar ${close ? 'tie' : diff > 0 ? 'buy' : 'rent'}`} onClick={() => go('results')} title={t('nav.results')}>
      <span className="sb-label">{t('bar.label', { years: horizon })}</span>
      <span className="sb-value">{close ? t('bar.tie') : diff > 0 ? t('bar.buy') : t('bar.rent')} · {fmt.signed(diff)}</span>
      <span className="sb-unit">{state.real ? t('unit.real') : t('unit.nominal')}</span>
    </button>
  )
}

export default function App() {
  const { t, state, update, reset, shareLink, theme, cycleTheme } = useApp()
  const [tab, setTab] = useState<Tab>('results')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  const share = async () => {
    const link = shareLink()
    try {
      await navigator.clipboard.writeText(link)
      setToast(t('hdr.copied'))
    } catch {
      window.prompt(t('hdr.copyManual'), link)
    }
  }

  const themeLabel = theme === 'auto' ? t('hdr.themeAuto') : theme === 'light' ? t('hdr.themeLight') : t('hdr.themeDark')

  return (
    <>
      <a className="skip" href="#main">{t('hdr.skip')}</a>
      <header className="site-header">
        <div className="wrap head-row">
          <div className="brand">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill="#1f6f5c" /><path d="M6 16 16 7l10 9v9h-7v-6h-6v6H6z" fill="#fff" /></svg>
            <div>
              <h1>{t('app.name')}</h1>
              <p>{t('app.tagline')}</p>
            </div>
          </div>
          <div className="head-actions">
            <div className="seg" role="group" aria-label={t('hdr.units')}>
              <button type="button" className={state.real ? 'on' : ''} onClick={() => update((d) => { d.real = true })} title={t('hdr.realTip')}>{t('hdr.real')}</button>
              <button type="button" className={!state.real ? 'on' : ''} onClick={() => update((d) => { d.real = false })} title={t('hdr.nominalTip')}>{t('hdr.nominal')}</button>
            </div>
            <div className="seg" role="group" aria-label="Language">
              <button type="button" className={state.lang === 'fr' ? 'on' : ''} onClick={() => update((d) => { d.lang = 'fr' })} lang="fr">FR</button>
              <button type="button" className={state.lang === 'en' ? 'on' : ''} onClick={() => update((d) => { d.lang = 'en' })} lang="en">EN</button>
            </div>
            <button type="button" className="btn ghost" onClick={cycleTheme} title={t('hdr.theme')}>{themeLabel}</button>
            <button type="button" className="btn ghost" onClick={share}>{t('hdr.share')}</button>
            <button type="button" className="btn ghost" onClick={() => window.print()}>{t('hdr.print')}</button>
            <button type="button" className="btn ghost" onClick={() => { if (window.confirm(t('hdr.resetConfirm'))) reset() }}>{t('hdr.reset')}</button>
          </div>
        </div>
        <div className="wrap">
          <nav className="tabs" aria-label="Sections">
            {TABS.map((k, i) => (
              <button key={k} type="button" className={`tab ${tab === k ? 'on' : ''}`} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
                {i < 3 && <span className="step">{i + 1}</span>}
                {t(`nav.${k}` as 'nav.results')}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="wrap">
        {tab !== 'results' && tab !== 'about' && <SummaryBar go={setTab} />}
        {tab === 'results' && (
          <div className="intro">
            <p>{t('intro.text')}</p>
            <p className="muted small">{t('intro.edit')} <button type="button" className="link" onClick={() => setTab('profile')}>{t('intro.start')}</button></p>
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
        <div className="next">
          {TABS.indexOf(tab) < 3 && (
            <button type="button" className="btn primary" onClick={() => setTab(TABS[TABS.indexOf(tab) + 1])}>{t('common.next')} →</button>
          )}
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>{t('footer.disclaimer')}</p>
          <p>
            <a href="https://github.com/Ltorre/immo" target="_blank" rel="noreferrer noopener">GitHub</a> · {t('footer.privacy')}
          </p>
        </div>
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
