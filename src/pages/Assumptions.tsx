import { MARKET_SNAPSHOT_DATE, REGIMES } from '../engine/defaults'
import { Button, Callout, Card, Check, Grid, Num, Pct, Select } from '../ui/fields'
import { useApp } from '../state'

export default function Assumptions() {
  const { t, fmt, state, update } = useApp()
  const m = state.market
  const r = state.rent

  return (
    <div className="stack">
      <Card title={t('ass.rent')} desc={t('ass.rentDesc')}>
        <Grid>
          <Num label={t('ass.rentMonthly')} unit="€ / mois" value={r.rentMonthly} step={25} min={0} onChange={(v) => update((d) => { d.rent.rentMonthly = v })} tip={t('ass.rentMonthlyTip')} />
          <Num label={t('ass.rentIns')} unit="€ / an" value={r.insuranceAnnual} step={10} min={0} onChange={(v) => update((d) => { d.rent.insuranceAnnual = v })} />
          <Num label={t('ass.rentEnergy')} unit="€ / an" value={r.energyAnnual} step={100} min={0} onChange={(v) => update((d) => { d.rent.energyAnnual = v })} />
          <Pct label={t('ass.rentGrowth')} value={m.rentGrowth} step={0.1} min={-0.05} max={0.1} onChange={(v) => update((d) => { d.market.rentGrowth = v })} tip={t('ass.rentGrowthTip')} />
        </Grid>
      </Card>

      <Card title={t('ass.horizon')} desc={t('ass.horizonDesc')}>
        <Grid>
          <Num label={t('ass.horizonYears')} unit={t('unit.years')} value={m.horizonYears} step={1} min={1} max={40} onChange={(v) => update((d) => { d.market.horizonYears = Math.round(v) })} />
          <Check label={t('ass.liquidate')} checked={m.liquidateAtHorizon} tip={t('ass.liquidateTip')} onChange={(v) => update((d) => { d.market.liquidateAtHorizon = v })} />
        </Grid>
      </Card>

      <Card title={t('ass.markets')} desc={t('ass.marketsDesc')}>
        <div className="presets">
          <span className="muted small">{t('ass.presets')}</span>
          {REGIMES.map((g) => (
            <Button key={g.id} kind="ghost" onClick={() => update((d) => { Object.assign(d.market, g.patch) })} title={t(`regime.${g.id}.desc` as 'regime.central.desc')}>
              {t(`regime.${g.id}` as 'regime.central')}
            </Button>
          ))}
        </div>
        <Grid>
          <Pct label={t('ass.peaReturn')} value={m.peaReturn} step={0.1} min={-0.1} max={0.25} onChange={(v) => update((d) => { d.market.peaReturn = v })} tip={t('ass.peaReturnTip')} />
          <Pct label={t('ass.peaFees')} value={m.peaFees} step={0.05} min={0} max={0.05} onChange={(v) => update((d) => { d.market.peaFees = v })} tip={t('ass.peaFeesTip')} />
          <Pct label={t('ass.homeGrowth')} value={m.homeAppreciation} step={0.1} min={-0.1} max={0.15} onChange={(v) => update((d) => { d.market.homeAppreciation = v })} tip={t('ass.homeGrowthTip')} />
          <Pct label={t('ass.inflation')} value={m.inflation} step={0.1} min={-0.02} max={0.15} onChange={(v) => update((d) => { d.market.inflation = v })} tip={t('ass.inflationTip')} />
          <Pct label={t('ass.chargesGrowth')} value={m.chargesGrowth} step={0.1} min={-0.02} max={0.15} onChange={(v) => update((d) => { d.market.chargesGrowth = v })} tip={t('ass.chargesGrowthTip')} />
          <Pct label={t('ass.livret')} value={m.livretRate} step={0.1} min={0} max={0.1} onChange={(v) => update((d) => { d.market.livretRate = v })} tip={t('ass.livretTip')} />
        </Grid>
      </Card>

      <Card title={t('ass.tax')} desc={t('ass.taxDesc')}>
        <Grid>
          <Num label={t('ass.peaCap')} unit="€" value={m.peaCap} step={5000} min={0} onChange={(v) => update((d) => { d.market.peaCap = v })} tip={t('ass.peaCapTip')} />
          <Pct label={t('ass.ps')} value={m.psRate} step={0.1} min={0} max={0.5} onChange={(v) => update((d) => { d.market.psRate = v })} tip={t('ass.psTip')} />
          <Pct label={t('ass.pfu')} value={m.pfuRate} step={0.1} min={0} max={0.6} onChange={(v) => update((d) => { d.market.pfuRate = v })} tip={t('ass.pfuTip')} />
          <Select
            label={t('ass.overflow')} value={m.overflow} tip={t('ass.overflowTip')}
            options={[{ value: 'cto', label: t('ass.overflowCto') }, { value: 'cash', label: t('ass.overflowCash') }]}
            onChange={(v) => update((d) => { d.market.overflow = v })}
          />
        </Grid>
      </Card>

      <Card
        title={t('ass.rates')} desc={t('ass.ratesDesc', { date: fmt.month(MARKET_SNAPSHOT_DATE) })}
        actions={<Button onClick={() => update((d) => { d.market.rateTable.push({ years: 30, rate: 0.04 }) })}>{t('common.add')}</Button>}
      >
        <div className="stack tight">
          {m.rateTable.map((p, i) => (
            <div className="row-card" key={i}>
              <Grid min={140}>
                <Num label={t('ass.rateYears')} unit={t('unit.years')} value={p.years} step={1} min={1} max={40} onChange={(v) => update((d) => { d.market.rateTable[i].years = Math.round(v) })} />
                <Pct label={t('ass.rateValue')} value={p.rate} step={0.05} min={0} max={0.15} onChange={(v) => update((d) => { d.market.rateTable[i].rate = v })} />
              </Grid>
              <Button kind="ghost" disabled={m.rateTable.length < 2} onClick={() => update((d) => { d.market.rateTable.splice(i, 1) })}>{t('common.remove')}</Button>
            </div>
          ))}
        </div>
        <Callout kind="info">{t('ass.ratesNote')}</Callout>
      </Card>
    </div>
  )
}
