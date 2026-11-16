import { HCSF_MAX_DEBT_RATIO, HCSF_MAX_YEARS, HCSF_MAX_YEARS_WORKS } from '../engine/defaults'
import { effectiveRent } from '../engine/simulate'
import { Callout, Card, Stat } from '../ui/fields'
import { LineChart } from '../ui/charts'
import CutNotice from '../ui/CutNotice'
import { useBreakEvens, useMain } from '../hooks'
import { useApp } from '../state'
import type { Solved } from '../engine/analysis'

export default function Results({ go }: { go: (tab: string) => void }) {
  const { t, fmt, state, option, rentName } = useApp()
  const { sc, res, horizon, pt, dc, adj, cut } = useMain()
  const be = useBreakEvens()
  const a = res.acquisition

  const diff = adj(pt.diff, horizon)
  const buyer = adj(pt.buyerNet, horizon)
  const renter = adj(pt.renterNet, horizon)
  const close = Math.abs(diff) < 0.03 * Math.max(buyer, renter, 1)
  const buyWins = diff > 0
  const unit = state.real ? t('unit.real') : t('unit.nominal')

  // ---- warnings ----
  const maxYears = option.kind === 'new' || option.worksInitial > 0 ? HCSF_MAX_YEARS_WORKS : HCSF_MAX_YEARS
  const warnings: { kind: 'warn' | 'bad' | 'info'; text: string }[] = []
  if (res.downPaymentShortfall > 0) warnings.push({ kind: 'bad', text: t('warn.shortfall', { amount: fmt.eur(res.downPaymentShortfall) }) })
  if (pt.deficitMonthsBuyer > 0) warnings.push({ kind: 'warn', text: t('warn.deficit', { months: pt.deficitMonthsBuyer, year: Math.floor((pt.firstDeficitMonthBuyer - 1) / 12) + 1 }) })
  if (dc.ratio > HCSF_MAX_DEBT_RATIO + 1e-9) warnings.push({ kind: 'warn', text: t('warn.ratio', { ratio: fmt.pct(dc.ratio), max: fmt.pct(HCSF_MAX_DEBT_RATIO, 0) }) })
  if (option.years > maxYears) warnings.push({ kind: 'warn', text: t('warn.duration', { years: option.years, max: maxYears }) })
  if (a.downPayment < a.notary + a.agency) warnings.push({ kind: 'warn', text: t('warn.apport', { fees: fmt.eur(a.notary + a.agency) }) })
  const rentYield = option.price > 0 ? (effectiveRent(sc.rent, option) * 12) / option.price : 0
  if (sc.rent.equivalentYield === null && rentYield > 0.055) warnings.push({ kind: 'info', text: t('warn.rentHigh', { ratio: fmt.pct(rentYield) }) })
  if (sc.rent.equivalentYield === null && rentYield > 0 && rentYield < 0.03) warnings.push({ kind: 'info', text: t('warn.rentLow', { ratio: fmt.pct(rentYield) }) })
  if (horizon < 5) warnings.push({ kind: 'warn', text: t('warn.short') })
  if (pt.deficitMonthsRenter > 0) warnings.push({ kind: 'warn', text: t('warn.deficitRent', { months: pt.deficitMonthsRenter, year: Math.floor((pt.firstDeficitMonthRenter - 1) / 12) + 1 }) })
  if (sc.market.vehicle !== 'savings' && pt.renterCto > 0 && sc.market.overflow === 'cto') warnings.push({ kind: 'info', text: t('info.cap', { cap: fmt.eur(sc.market.peaCap) }) })

  // ---- chart data ----
  const lastYear = Math.min(res.years.length - 1, horizon + 10)
  const pts = res.years.slice(0, lastYear + 1)
  const buyerSeries = pts.map((p) => ({ x: p.year, y: adj(p.buyerNet, p.year) }))
  const renterSeries = pts.map((p) => ({ x: p.year, y: adj(p.renterNet, p.year) }))
  const diffSeries = pts.map((p) => ({ x: p.year, y: adj(p.diff, p.year) }))
  const yearFmt = (v: number) => t('chart.yearN', { n: v })

  // ---- spending breakdown (cumulative, nominal) ----
  const c = pt.cum
  const worksLost = a.works * (1 - option.worksValueAddedPct) + a.furnishing
  const acqFees = a.notary + a.agency + a.bankFees + a.guarantee
  const exitCosts = pt.sellCosts + pt.ira - pt.refund
  const buyerRows: [string, number][] = [
    [t('cost.acq'), acqFees],
    [t('cost.worksLost'), worksLost],
    [t('cost.interest'), c.interest],
    [t('cost.loanIns'), c.loanInsurance],
    [t('cost.propTax'), c.propertyTax],
    [t('cost.copro'), c.copro],
    [t('cost.ownerIns'), c.insurance],
    [t('cost.energy'), c.energy],
    [t('cost.maint'), c.maintenance + c.oneOffs],
    [t('cost.exit'), exitCosts],
    [t('cost.taxes'), pt.buyerTaxes],
  ]
  const renterRows: [string, number][] = [
    [t('cost.rent'), c.rent],
    [t('cost.rentIns'), c.rentInsurance],
    [t('cost.energy'), c.rentEnergy],
    [t('cost.taxes'), pt.renterTaxes],
  ]
  const sum = (rows: [string, number][]) => rows.reduce((s, r) => s + r[1], 0)
  const maxRow = Math.max(1, ...buyerRows.map((r) => r[1]), ...renterRows.map((r) => r[1]))

  // ---- first-year budget ----
  const p = sc.profile
  const income = p.netIncomeMonthly - p.incomeTaxMonthly
  const creditsNow = p.credits.reduce((s, x) => s + (x.remainingMonths > 0 ? x.monthlyPayment : 0), 0)
  const y1 = res.year1

  const solvedText = (s: Solved, fmtVal: (v: number) => string, always: string, never: string) =>
    s.status === 'ok' ? fmtVal(s.value as number) : s.status === 'always' ? always : never

  return (
    <div className="stack">
      <Card>
        <div className={`verdict ${close ? 'tie' : buyWins ? 'buy' : 'rent'}`}>
          <div className="verdict-kicker">{t('verdict.kicker', { years: horizon, unit })}</div>
          <div className="verdict-title">
            {close ? t('verdict.tie') : buyWins ? t('verdict.buy') : t('verdict.rent')}
          </div>
          <div className="verdict-number">{fmt.signed(diff)}</div>
          <div className="verdict-sub">
            {close
              ? t('verdict.tieSub', { buyer: fmt.eur(buyer), renter: fmt.eur(renter) })
              : t(buyWins ? 'verdict.buySub' : 'verdict.rentSub', { amount: fmt.eur(Math.abs(diff)), buyer: fmt.eur(buyer), renter: fmt.eur(renter) })}
          </div>
        </div>
        <div className="be-grid">
          <Stat
            label={t('be.year')}
            value={be.year === null ? t('be.never', { max: 40 }) : be.year === 0 ? t('be.immediate') : t('be.years', { n: fmt.yrs(be.year) })}
            sub={t('be.yearSub')}
          />
          <Stat
            label={t('be.appreciation')}
            value={solvedText(be.appreciation, (v) => fmt.pct(v), t('be.alwaysBuy'), t('be.neverBuy'))}
            sub={t('be.appreciationSub', { current: fmt.pct(sc.market.homeAppreciation) })}
          />
          <Stat
            label={t('be.rent')}
            value={solvedText(be.rent, (v) => fmt.eur(v), t('be.alwaysBuy'), t('be.neverBuy'))}
            sub={t('be.rentSub', { current: fmt.eur(effectiveRent(sc.rent, option)) })}
          />
          <Stat
            label={sc.market.vehicle === 'savings' ? t('be.savings') : t('be.pea')}
            value={solvedText(be.pea, (v) => fmt.pct(v), t('be.alwaysBuy'), t('be.neverBuy'))}
            sub={sc.market.vehicle === 'savings'
              ? t('be.savingsSub', { current: fmt.pct(sc.market.savingsKind === 'current' ? 0 : sc.market.savingsGross) })
              : t('be.peaSub', { current: fmt.pct(sc.market.peaReturn) })}
          />
        </div>
      </Card>

      <CutNotice cut={cut} />

      {warnings.length > 0 && (
        <div className="stack tight">
          {warnings.map((w, i) => (
            <Callout key={i} kind={w.kind === 'info' ? 'info' : w.kind}>{w.text}</Callout>
          ))}
          {warnings.some((w) => w.kind !== 'info') && <div><button type="button" className="link" onClick={() => go('feasibility')}>{t('warn.more')}</button></div>}
        </div>
      )}

      <div className="cols-2">
        <Stat tone="buy" label={t('kpi.buyerNet')} value={fmt.eur(buyer)} sub={t('kpi.buyerNetSub', { home: fmt.eur(adj(pt.homeValue, horizon)), debt: fmt.eur(adj(pt.debt, horizon)) })} />
        <Stat tone="rent" label={t('kpi.renterNet')} value={fmt.eur(renter)} sub={t('kpi.renterNetSub', { pea: fmt.eur(adj(pt.renterPea + pt.renterCto + pt.renterLivret, horizon)) })} />
      </div>

      <Card title={t('chart.netWorth')} desc={t('chart.netWorthDesc', { unit })}>
        <LineChart
          ariaLabel={t('chart.netWorth')}
          series={[
            { id: 'buy', name: t('series.buy'), tone: 'buy', points: buyerSeries },
            { id: 'rent', name: rentName, tone: 'rent', points: renterSeries },
          ]}
          yFormat={fmt.eurShort}
          xFormat={yearFmt}
          markX={{ x: horizon, label: t('chart.horizon') }}
          xTitle={t('chart.years')}
        />
      </Card>

      <Card title={t('chart.diff')} desc={t('chart.diffDesc')}>
        <LineChart
          height={220}
          ariaLabel={t('chart.diff')}
          series={[{ id: 'diff', name: t('series.diff'), tone: 'neutral', points: diffSeries }]}
          yFormat={fmt.eurShort}
          xFormat={yearFmt}
          markX={{ x: horizon, label: t('chart.horizon') }}
          xTitle={t('chart.years')}
        />
      </Card>

      <Card title={t('budget.title')} desc={t('budget.desc')}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th /><th className="num"><span className="swatch buy" /> {t('series.buy')}</th><th className="num"><span className="swatch rent" /> {rentName}</th></tr>
            </thead>
            <tbody>
              <tr><td>{t('budget.income')}</td><td className="num">{fmt.eur(income)}</td><td className="num">{fmt.eur(income)}</td></tr>
              <tr><td>{t('budget.living')}</td><td className="num">−{fmt.eur(p.livingExpensesMonthly)}</td><td className="num">−{fmt.eur(p.livingExpensesMonthly)}</td></tr>
              {creditsNow > 0 && <tr><td>{t('budget.credits')}</td><td className="num">−{fmt.eur(creditsNow)}</td><td className="num">−{fmt.eur(creditsNow)}</td></tr>}
              <tr><td>{t('budget.loan')}</td><td className="num">−{fmt.eur(y1.loanPayment)}</td><td className="num">—</td></tr>
              <tr><td>{t('budget.running')}</td><td className="num">−{fmt.eur(y1.runningCosts)}</td><td className="num">—</td></tr>
              <tr><td>{t('budget.rent')}</td><td className="num">—</td><td className="num">−{fmt.eur(y1.rentHousingCash)}</td></tr>
              <tr className="total"><td>{t('budget.left')}</td>
                <td className={`num ${y1.surplusBuyer < 0 ? 'neg' : ''}`}>{fmt.eur(y1.surplusBuyer)}</td>
                <td className={`num ${y1.surplusRenter < 0 ? 'neg' : ''}`}>{fmt.eur(y1.surplusRenter)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="cols-2 top">
        <Card title={t('spend.buyer')} desc={t('spend.desc')}>
          <div className="table-wrap">
            <table className="table bars">
              <tbody>
                {buyerRows.filter((r) => r[1] > 0.5).map(([label, v]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="barcell"><span className="bar buy" style={{ width: `${(v / maxRow) * 100}%` }} /></td>
                    <td className="num">{fmt.eur(v)}</td>
                  </tr>
                ))}
                <tr className="total"><td colSpan={2}>{t('spend.total')}</td><td className="num">{fmt.eur(sum(buyerRows))}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="muted small">{t('spend.principal', { amount: fmt.eur(c.principal) })}</p>
        </Card>
        <Card title={t('spend.renter')} desc={t('spend.descRent')}>
          <div className="table-wrap">
            <table className="table bars">
              <tbody>
                {renterRows.filter((r) => r[1] > 0.5).map(([label, v]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="barcell"><span className="bar rent" style={{ width: `${(v / maxRow) * 100}%` }} /></td>
                    <td className="num">{fmt.eur(v)}</td>
                  </tr>
                ))}
                <tr className="total"><td colSpan={2}>{t('spend.total')}</td><td className="num">{fmt.eur(sum(renterRows))}</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title={t('end.title', { years: horizon })} desc={t('end.desc', { unit })}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th /><th className="num"><span className="swatch buy" /> {t('series.buy')}</th><th className="num"><span className="swatch rent" /> {rentName}</th></tr>
            </thead>
            <tbody>
              {sc.market.liquidateAtHorizon ? (
                <>
                  <tr><td>{t('end.home')}</td><td className="num">{fmt.eur(adj(pt.homeValue, horizon))}</td><td className="num">—</td></tr>
                  <tr><td>{t('end.sellCosts')}</td><td className="num">−{fmt.eur(adj(pt.sellCosts + pt.ira - pt.refund, horizon))}</td><td className="num">—</td></tr>
                </>
              ) : (
                <tr><td>{t('end.homeKept')}</td><td className="num">{fmt.eur(adj(pt.homeValue, horizon))}</td><td className="num">—</td></tr>
              )}
              <tr><td>{t('end.debt')}</td><td className="num">−{fmt.eur(adj(pt.debt, horizon))}</td><td className="num">—</td></tr>
              <tr><td>{t('end.pea')}</td><td className="num">{fmt.eur(adj(pt.buyerPea, horizon))}</td><td className="num">{fmt.eur(adj(pt.renterPea, horizon))}</td></tr>
              <tr><td>{t('end.cto')}</td><td className="num">{fmt.eur(adj(pt.buyerCto, horizon))}</td><td className="num">{fmt.eur(adj(pt.renterCto, horizon))}</td></tr>
              <tr><td>{t('end.cash')}</td><td className="num">{fmt.eur(adj(pt.buyerLivret, horizon))}</td><td className="num">{fmt.eur(adj(pt.renterLivret, horizon))}</td></tr>
              <tr><td>{t('end.taxes')}</td><td className="num">−{fmt.eur(adj(pt.buyerTaxes, horizon))}</td><td className="num">−{fmt.eur(adj(pt.renterTaxes, horizon))}</td></tr>
              <tr className="total"><td>{t('end.total')}</td><td className="num">{fmt.eur(buyer)}</td><td className="num">{fmt.eur(renter)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <details className="card">
        <summary>{t('table.title')}</summary>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>{t('table.year')}</th>
                <th className="num">{t('table.home')}</th>
                <th className="num">{t('table.debt')}</th>
                <th className="num">{t('series.buy')}</th>
                <th className="num">{rentName}</th>
                <th className="num">{t('series.diff')}</th>
              </tr>
            </thead>
            <tbody>
              {res.years.slice(0, Math.min(res.years.length, horizon + 11)).map((y) => (
                <tr key={y.year} className={y.year === horizon ? 'hl' : ''}>
                  <td>{y.year}</td>
                  <td className="num">{fmt.eur(adj(y.homeValue, y.year))}</td>
                  <td className="num">{fmt.eur(adj(y.debt, y.year))}</td>
                  <td className="num">{fmt.eur(adj(y.buyerNet, y.year))}</td>
                  <td className="num">{fmt.eur(adj(y.renterNet, y.year))}</td>
                  <td className={`num ${y.diff < 0 ? 'neg' : ''}`}>{fmt.signed(adj(y.diff, y.year))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
