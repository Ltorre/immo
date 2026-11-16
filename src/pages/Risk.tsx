import { useDeferredValue, useMemo } from 'react'
import { monteCarlo } from '../engine/montecarlo'
import { Callout, Card, Grid, Num, Pct, Stat } from '../ui/fields'
import { Histogram, LineChart } from '../ui/charts'
import { useApp } from '../state'
import { useCutScenario } from '../hooks'
import CutNotice from '../ui/CutNotice'

export default function Risk() {
  const { t, fmt, state, update } = useApp()
  const { sc, cut } = useCutScenario()
  const mcp = useDeferredValue(state.mc)
  const mc = useMemo(() => monteCarlo(sc, mcp), [sc, mcp])
  const p = state.mc
  const unit = t('unit.real')
  const pct = Math.round(mc.probBuyWins * 100)
  const yearFmt = (v: number) => t('chart.yearN', { n: v })

  const fan = mc.fan
  const years = fan.map((_, i) => i)
  const line = (k: 'p10' | 'p25' | 'p50' | 'p75' | 'p90') => fan.map((b, i) => ({ x: years[i], y: b[k] }))

  return (
    <div className="stack">
      <CutNotice cut={cut} />
      <Callout kind="info">{t('risk.intro')}</Callout>

      <Card title={t('risk.params')} desc={t('risk.paramsDesc')}>
        <Grid>
          <Pct label={t('risk.peaVol')} value={p.peaVol} step={0.5} min={0} max={0.6} onChange={(v) => update((d) => { d.mc.peaVol = v })} tip={t('risk.peaVolTip')} />
          <Pct label={t('risk.homeVol')} value={p.homeVol} step={0.5} min={0} max={0.3} onChange={(v) => update((d) => { d.mc.homeVol = v })} tip={t('risk.homeVolTip')} />
          <Num label={t('risk.corr')} value={p.correlation} step={0.1} min={-0.9} max={0.9} onChange={(v) => update((d) => { d.mc.correlation = v })} tip={t('risk.corrTip')} />
          <Num label={t('risk.paths')} value={p.paths} step={500} min={200} max={6000} onChange={(v) => update((d) => { d.mc.paths = Math.round(v) })} tip={t('risk.pathsTip')} />
        </Grid>
      </Card>

      <div className="cols-3">
        <Stat label={t('risk.prob')} value={`${pct} %`} sub={t('risk.probSub', { years: mc.horizon, n: mc.params.paths })} tone={pct >= 50 ? 'buy' : 'rent'} />
        <Stat label={t('risk.median')} value={fmt.signed(mc.diffReal.p50)} sub={t('risk.medianSub', { unit })} />
        <Stat label={t('risk.range')} value={`${fmt.eurShort(mc.diffReal.p10)} → ${fmt.eurShort(mc.diffReal.p90)}`} sub={t('risk.rangeSub')} />
      </div>

      <Card title={t('risk.fan')} desc={t('risk.fanDesc', { unit })}>
        <LineChart
          ariaLabel={t('risk.fan')}
          bands={[
            { id: 'b8', name: t('risk.band80'), tone: 'neutral', lo: line('p10'), hi: line('p90'), opacity: 0.14 },
            { id: 'b50', name: t('risk.band50'), tone: 'neutral', lo: line('p25'), hi: line('p75'), opacity: 0.22 },
          ]}
          series={[{ id: 'med', name: t('risk.medianLine'), tone: 'neutral', points: line('p50') }]}
          yFormat={fmt.eurShort}
          xFormat={yearFmt}
          xTitle={t('chart.years')}
        />
      </Card>

      <Card title={t('risk.hist')} desc={t('risk.histDesc', { unit })}>
        <Histogram
          bins={mc.histogram}
          xFormat={fmt.eurShort}
          ariaLabel={t('risk.hist')}
          leftLabel={t('risk.rentWins')}
          rightLabel={t('risk.buyWins')}
          countLabel={(n, share) => t('risk.histCount', { n, pct: (share * 100).toFixed(1) })}
        />
      </Card>

      <Card title={t('risk.table')}>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr><th /><th className="num">10 %</th><th className="num">25 %</th><th className="num">{t('risk.medianLine')}</th><th className="num">75 %</th><th className="num">90 %</th></tr>
            </thead>
            <tbody>
              {([['series.buy', mc.buyerReal], ['series.rent', mc.renterReal], ['series.diff', mc.diffReal]] as const).map(([k, b]) => (
                <tr key={k}>
                  <td>{t(k)}</td>
                  <td className="num">{fmt.eur(b.p10)}</td><td className="num">{fmt.eur(b.p25)}</td><td className="num">{fmt.eur(b.p50)}</td>
                  <td className="num">{fmt.eur(b.p75)}</td><td className="num">{fmt.eur(b.p90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(mc.ruinShareBuyer > 0.005 || mc.ruinShareRenter > 0.005) && (
          <Callout kind="warn">{t('risk.ruin', { buyer: (mc.ruinShareBuyer * 100).toFixed(1), renter: (mc.ruinShareRenter * 100).toFixed(1) })}</Callout>
        )}
        <p className="muted small">{t('risk.note')}</p>
      </Card>
    </div>
  )
}
