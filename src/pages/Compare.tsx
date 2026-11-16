import { useMemo } from 'react'
import {
  applyPatch, breakEvenYear, diffAt, downPaymentSweep, durationHorizonGrid, returnsHeatmap, simulateLong, debtCheck,
} from '../engine/analysis'
import { REGIMES, HCSF_MAX_DEBT_RATIO } from '../engine/defaults'
import { atHorizon, toReal } from '../engine/simulate'
import { Callout, Card } from '../ui/fields'
import { divergingStyle } from '../ui/charts'
import { useApp } from '../state'
import { useCutScenario } from '../hooks'
import CutNotice from '../ui/CutNotice'

const LOAN_YEARS = [10, 15, 20, 25]
const HORIZONS = [5, 7, 10, 15, 20, 25, 30]
const DOWN_SHARES = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]
const APPRECIATIONS = [-0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05]
const PEA_RETURNS = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1]
const SAVINGS_RETURNS = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06]

export default function Compare() {
  const { state } = useApp()
  const { sc, cut } = useCutScenario()
  return (
    <div className="stack">
      <CutNotice cut={cut} />
      <OptionsTable sc={sc} real={state.real} />
      <Regimes sc={sc} real={state.real} />
      <DurationGrid sc={sc} real={state.real} />
      <DownPayments sc={sc} real={state.real} />
      <Heatmap sc={sc} real={state.real} />
    </div>
  )
}

type Sc = ReturnType<typeof useApp>['scenario']

function Legend() {
  const { t } = useApp()
  return (
    <p className="legend-inline muted small">
      <span className="swatch buy" /> {t('cmp.legendBuy')} &nbsp; <span className="swatch rent" /> {t('cmp.legendRent')}
    </p>
  )
}

function OptionsTable({ sc, real }: { sc: Sc; real: boolean }) {
  const { t, fmt, state, update } = useApp()
  const rows = useMemo(
    () =>
      state.options.map((o) => {
        const s = { ...sc, option: o }
        const res = simulateLong(s)
        const h = Math.max(1, Math.round(s.market.horizonYears))
        const pt = atHorizon(res, h)
        const dc = debtCheck(s)
        const diff = real ? toReal(pt.diff, h, s.market.inflation) : pt.diff
        return { o, a: res.acquisition, dc, diff, be: breakEvenYear(res), short: res.downPaymentShortfall }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sc, real, state.options],
  )
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.diff)))
  const best = rows.reduce((b, r) => (r.diff > b.diff ? r : b), rows[0])
  return (
    <Card title={t('cmp.options')} desc={t('cmp.optionsDesc')}>
      <Legend />
      <div className="table-wrap">
        <table className="table compact">
          <thead>
            <tr>
              <th>{t('cmp.property')}</th>
              <th className="num">{t('sum.price')}</th>
              <th className="num">{t('sum.down')}</th>
              <th className="num">{t('sum.loan')}</th>
              <th className="num">{t('cmp.colPayment')}</th>
              <th className="num">{t('cmp.colRatio')}</th>
              <th className="num">{t('cmp.colBe')}</th>
              <th className="num">{t('cmp.advantage', { years: sc.market.horizonYears })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.o.id} className={r.o.id === state.selectedId ? 'hl' : ''}>
                <td>
                  <button type="button" className="link" onClick={() => update((d) => { d.selectedId = r.o.id })}>
                    {r.o.name || `${t('prop.defaultName')} ${i + 1}`}
                  </button>
                </td>
                <td className="num">{fmt.eur(r.a.price)}</td>
                <td className="num">{fmt.eur(r.a.downPayment)}{r.short > 0 ? ' ▲' : ''}</td>
                <td className="num">{fmt.eur(r.a.mainLoan)}</td>
                <td className="num">{fmt.eur(r.dc.newPayment)}</td>
                <td className={`num ${r.dc.ratio > HCSF_MAX_DEBT_RATIO ? 'neg' : ''}`}>{fmt.pct(r.dc.ratio)}{r.dc.ratio > HCSF_MAX_DEBT_RATIO ? ' ▲' : ''}</td>
                <td className="num">{r.be === null ? '—' : fmt.yrs(r.be)}</td>
                <td className="num cell" style={divergingStyle(r.diff, max)}>{fmt.signed(r.diff)}{rows.length > 1 && r === best ? ' ★' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.options.length < 2 && <Callout kind="info">{t('cmp.optionsHint')}</Callout>}
    </Card>
  )
}

function Regimes({ sc, real }: { sc: Sc; real: boolean }) {
  const { t, fmt } = useApp()
  const rows = useMemo(
    () => [
      { id: 'current', sc, patch: null as null | (typeof REGIMES)[number]['patch'] },
      ...REGIMES.map((g) => ({ id: g.id, sc: applyPatch(sc, g.patch), patch: g.patch })),
    ].map((r) => ({ ...r, diff: diffAt(r.sc, r.sc.market.horizonYears, real) })),
    [sc, real],
  )
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.diff)))
  return (
    <Card title={t('cmp.regimes')} desc={t('cmp.regimesDesc')}>
      <Legend />
      <div className="table-wrap">
        <table className="table compact">
          <thead>
            <tr>
              <th>{t('cmp.regime')}</th>
              <th className="num">{sc.market.vehicle === 'savings' ? t('ass.savingsGross') : t('ass.peaReturn')}</th>
              <th className="num">{t('ass.homeGrowth')}</th>
              <th className="num">{t('ass.rentGrowth')}</th>
              <th className="num">{t('cmp.advantage', { years: sc.market.horizonYears })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === 'current' ? 'hl' : ''}>
                <td>{r.id === 'current' ? t('cmp.yourAssumptions') : t(`regime.${r.id}` as 'regime.central')}</td>
                <td className="num">{fmt.pct(r.sc.market.vehicle === 'savings' ? (r.sc.market.savingsKind === 'current' ? 0 : r.sc.market.savingsGross) : r.sc.market.peaReturn)}</td>
                <td className="num">{fmt.pct(r.sc.market.homeAppreciation)}</td>
                <td className="num">{fmt.pct(r.sc.market.rentGrowth)}</td>
                <td className="num cell" style={divergingStyle(r.diff, max)}>{fmt.signed(r.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function DurationGrid({ sc, real }: { sc: Sc; real: boolean }) {
  const { t, fmt } = useApp()
  const years = useMemo(() => Array.from(new Set([...LOAN_YEARS, Math.round(sc.option.years)])).sort((a, b) => a - b), [sc.option.years])
  const horizons = useMemo(() => Array.from(new Set([...HORIZONS, Math.round(sc.market.horizonYears)])).sort((a, b) => a - b), [sc.market.horizonYears])
  const cells = useMemo(() => durationHorizonGrid(sc, years, horizons), [sc, years, horizons])
  const val = (c: (typeof cells)[number]) => (real ? c.diffReal : c.diff)
  const max = Math.max(1, ...cells.map((c) => Math.abs(val(c))))
  return (
    <Card title={t('cmp.grid')} desc={t('cmp.gridDesc')}>
      <Legend />
      <div className="table-wrap">
        <table className="table compact grid-table">
          <thead>
            <tr>
              <th>{t('cmp.loanYears')}</th>
              {horizons.map((h) => <th key={h} className="num">{t('cmp.horizonN', { n: h })}</th>)}
            </tr>
          </thead>
          <tbody>
            {years.map((ly) => (
              <tr key={ly}>
                <th scope="row">{ly} {t('unit.years')} <small className="muted">({fmt.pct(cells.find((c) => c.loanYears === ly)?.rate ?? 0, 2)})</small></th>
                {horizons.map((h) => {
                  const c = cells.find((x) => x.loanYears === ly && x.horizon === h)!
                  const current = ly === Math.round(sc.option.years) && h === Math.round(sc.market.horizonYears)
                  return (
                    <td key={h} className={`num cell ${current ? 'current' : ''}`} style={divergingStyle(val(c), max)} title={fmt.signed(val(c))}>
                      {fmt.eurShort(val(c))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('cmp.gridNote')}</p>
    </Card>
  )
}

function DownPayments({ sc, real }: { sc: Sc; real: boolean }) {
  const { t, fmt } = useApp()
  const rows = useMemo(() => downPaymentSweep(sc, DOWN_SHARES), [sc])
  const val = (r: (typeof rows)[number]) => (real ? r.diffReal : r.diff)
  const max = Math.max(1, ...rows.map((r) => Math.abs(val(r))))
  return (
    <Card title={t('cmp.down')} desc={t('cmp.downDesc')}>
      <Legend />
      <div className="table-wrap">
        <table className="table compact">
          <thead>
            <tr>
              <th>{t('cmp.downShare')}</th>
              <th className="num">{t('sum.down')}</th>
              <th className="num">{t('sum.loan')}</th>
              <th className="num">{t('cmp.colPayment')}</th>
              <th className="num">{t('cmp.colRatio')}</th>
              <th className="num">{t('cmp.advantage', { years: sc.market.horizonYears })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.share} className={r.shortfall > 0 ? 'dim' : ''}>
                <td>{fmt.pct(r.share, 0)}</td>
                <td className="num">{fmt.eur(r.down)}{r.shortfall > 0 ? ` ▲ ${t('cmp.notAffordable')}` : ''}</td>
                <td className="num">{fmt.eur(r.loan)}</td>
                <td className="num">{fmt.eur(r.payment)}</td>
                <td className={`num ${r.debtRatio > HCSF_MAX_DEBT_RATIO ? 'neg' : ''}`}>{fmt.pct(r.debtRatio)}{r.debtRatio > HCSF_MAX_DEBT_RATIO ? ' ▲' : ''}</td>
                <td className="num cell" style={divergingStyle(val(r), max)}>{fmt.signed(val(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('cmp.downNote')}</p>
    </Card>
  )
}

function Heatmap({ sc, real }: { sc: Sc; real: boolean }) {
  const { t, fmt } = useApp()
  const savings = sc.market.vehicle === 'savings'
  const RETURNS = savings ? SAVINGS_RETURNS : PEA_RETURNS
  const grid = useMemo(() => {
    const raw = returnsHeatmap(sc, APPRECIATIONS, RETURNS)
    const h = Math.max(1, Math.round(sc.market.horizonYears))
    return real ? raw.map((row) => row.map((v) => toReal(v, h, sc.market.inflation))) : raw
  }, [sc, real, RETURNS])
  const max = Math.max(1, ...grid.flat().map(Math.abs))
  const nearest = (arr: number[], v: number) => arr.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(arr[b] - v) ? i : b), 0)
  const ci = nearest(APPRECIATIONS, sc.market.homeAppreciation)
  const cj = nearest(RETURNS, savings ? sc.market.savingsGross : sc.market.peaReturn)
  return (
    <Card title={t('cmp.heat')} desc={t('cmp.heatDesc', { years: sc.market.horizonYears })}>
      <Legend />
      <div className="table-wrap">
        <table className="table compact grid-table">
          <thead>
            <tr>
              <th>{t(savings ? 'cmp.heatAxisSavings' : 'cmp.heatAxis')}</th>
              {APPRECIATIONS.map((a) => <th key={a} className="num">{fmt.pct(a, 0)}</th>)}
            </tr>
          </thead>
          <tbody>
            {RETURNS.map((p, j) => (
              <tr key={p}>
                <th scope="row">{fmt.pct(p, 0)}</th>
                {APPRECIATIONS.map((a, i) => (
                  <td key={a} className={`num cell ${i === ci && j === cj ? 'current' : ''}`} style={divergingStyle(grid[j][i], max)} title={fmt.signed(grid[j][i])}>
                    {fmt.eurShort(grid[j][i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t(savings ? 'cmp.heatNoteSavings' : 'cmp.heatNote')}</p>
    </Card>
  )
}
