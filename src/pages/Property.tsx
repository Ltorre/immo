import { AID_TEMPLATES, NOTARY_PCT, newExtraLoan, newOneOff, newOption, uid, type AidId } from '../engine/defaults'
import { buildSchedule, totalCost } from '../engine/loan'
import type { PropertyOption } from '../engine/types'
import { Button, Callout, Card, Check, Grid, Num, Pct, Select, Text } from '../ui/fields'
import { useMain } from '../hooks'
import { useApp } from '../state'
import { AidInfo, OtherAids } from '../ui/AidInfo'
import PtzTester from '../ui/PtzTester'

export default function Property() {
  const { t, fmt, state, update, option: o } = useApp()
  const { res, dc } = useMain()
  const a = res.acquisition
  const idx = Math.max(0, state.options.findIndex((x) => x.id === state.selectedId))
  const set = (fn: (o: PropertyOption) => void) => update((d) => { fn(d.options[idx]) })
  const free = Math.max(0, state.profile.savings - state.profile.emergencyFund)

  const sched = buildSchedule(
    { amount: a.mainLoan, annualRate: a.mainRate, years: o.years, insurancePct: o.insurancePct, extraMonthly: o.extraRepaymentMonthly },
    o.years * 12,
  )
  const creditCost = totalCost(sched)

  const addOption = () => update((d) => {
    const n = newOption(`${t('prop.defaultName')} ${d.options.length + 1}`)
    d.options.push(n)
    d.selectedId = n.id
  })
  const duplicate = () => update((d) => {
    const copy = structuredClone(d.options[idx])
    copy.id = uid('opt')
    copy.name = `${copy.name || t('prop.defaultName')} (${t('prop.copy')})`
    copy.extraLoans.forEach((l) => { l.id = uid('loan') })
    copy.oneOffs.forEach((l) => { l.id = uid('oneoff') })
    d.options.splice(idx + 1, 0, copy)
    d.selectedId = copy.id
  })
  const remove = () => update((d) => {
    if (d.options.length < 2) return
    d.options.splice(idx, 1)
    d.selectedId = d.options[Math.max(0, idx - 1)].id
  })

  const tableRate = a.mainRate

  return (
    <div className="stack">
      <Card title={t('prop.options')} desc={t('prop.optionsDesc')}>
        <div className="chips" role="tablist">
          {state.options.map((x, i) => (
            <button
              key={x.id} type="button" role="tab" aria-selected={x.id === state.selectedId}
              className={`chip ${x.id === state.selectedId ? 'on' : ''}`}
              onClick={() => update((d) => { d.selectedId = x.id })}
            >
              {x.name || `${t('prop.defaultName')} ${i + 1}`}
            </button>
          ))}
          <Button onClick={addOption}>+ {t('prop.add')}</Button>
          <Button kind="ghost" onClick={duplicate}>{t('prop.duplicate')}</Button>
          <Button kind="ghost" onClick={remove} disabled={state.options.length < 2}>{t('prop.delete')}</Button>
        </div>
      </Card>

      <div className="with-aside">
        <div className="stack">
          <Card title={t('prop.property')}>
            <Grid>
              <Text label={t('prop.name')} value={o.name} placeholder={t('prop.namePlaceholder')} onChange={(v) => set((x) => { x.name = v })} />
              <Select
                label={t('prop.kind')} value={o.kind} tip={t('prop.kindTip')}
                options={[{ value: 'old', label: t('prop.kindOld') }, { value: 'new', label: t('prop.kindNew') }]}
                onChange={(v) => set((x) => { x.kind = v; x.notaryPct = NOTARY_PCT[v] })}
              />
              <Num label={t('prop.price')} unit="€" value={o.price} step={5000} min={0} onChange={(v) => set((x) => { x.price = v })} tip={t('prop.priceTip')} />
              <Pct label={t('prop.notary')} value={o.notaryPct} step={0.1} min={0} max={0.15} onChange={(v) => set((x) => { x.notaryPct = v })} tip={t('prop.notaryTip')} />
              <Pct label={t('prop.agency')} value={o.agencyPct} step={0.1} min={0} max={0.12} onChange={(v) => set((x) => { x.agencyPct = v })} tip={t('prop.agencyTip')} />
              <Num label={t('prop.works')} unit="€" value={o.worksInitial} step={1000} min={0} onChange={(v) => set((x) => { x.worksInitial = v })} tip={t('prop.worksTip')} />
              <Pct label={t('prop.worksValue')} value={o.worksValueAddedPct} step={5} min={0} max={1} onChange={(v) => set((x) => { x.worksValueAddedPct = v })} tip={t('prop.worksValueTip')} />
              <Num label={t('prop.moving')} unit="€" value={o.movingFurnishing} step={500} min={0} onChange={(v) => set((x) => { x.movingFurnishing = v })} tip={t('prop.movingTip')} />
            </Grid>
          </Card>

          <Card title={t('prop.financing')} desc={t('prop.financingDesc')}>
            <Grid>
              <Num label={t('prop.down')} unit="€" value={o.downPayment} step={1000} min={0} onChange={(v) => set((x) => { x.downPayment = v })} tip={t('prop.downTip')} />
              <Num label={t('prop.years')} unit={t('unit.years')} value={o.years} step={1} min={1} max={30} onChange={(v) => set((x) => { x.years = Math.round(v) })} tip={t('prop.yearsTip')} />
              <Check
                label={t('prop.rateAuto')} checked={o.rateOverride === null} tip={t('prop.rateAutoTip')}
                onChange={(on) => set((x) => { x.rateOverride = on ? null : tableRate })}
              />
              {o.rateOverride !== null ? (
                <Pct label={t('prop.rate')} value={o.rateOverride} step={0.05} min={0} max={0.15} onChange={(v) => set((x) => { x.rateOverride = v })} tip={t('prop.rateTip')} />
              ) : (
                <div className="field"><label>{t('prop.rate')}</label><div className="static-value"><span className="nowrap">{fmt.pct(tableRate, 2)}</span> <small className="muted">({t('prop.rateFromTable')})</small></div></div>
              )}
              <Pct label={t('prop.insurance')} value={o.insurancePct} step={0.01} min={0} max={1} onChange={(v) => set((x) => { x.insurancePct = v })} tip={t('prop.insuranceTip')} />
              <Pct label={t('prop.guarantee')} value={o.guaranteePct} step={0.1} min={0} max={0.05} onChange={(v) => set((x) => { x.guaranteePct = v })} tip={t('prop.guaranteeTip')} />
              <Pct label={t('prop.guaranteeRefund')} value={o.guaranteeRefundPct} step={5} min={0} max={1} onChange={(v) => set((x) => { x.guaranteeRefundPct = v })} tip={t('prop.guaranteeRefundTip')} />
              <Num label={t('prop.bankFees')} unit="€" value={o.bankFees} step={100} min={0} onChange={(v) => set((x) => { x.bankFees = v })} tip={t('prop.bankFeesTip')} />
              <Num label={t('prop.extraRepay')} unit="€ / mois" value={o.extraRepaymentMonthly} step={50} min={0} onChange={(v) => set((x) => { x.extraRepaymentMonthly = v })} tip={t('prop.extraRepayTip')} />
            </Grid>
            <div className="btn-row">
              <Button kind="ghost" onClick={() => set((x) => { x.downPayment = Math.round(free) })}>{t('prop.downMax', { amount: fmt.eur(free) })}</Button>
              {[0.1, 0.2, 0.3].map((s) => (
                <Button key={s} kind="ghost" onClick={() => set((x) => { x.downPayment = Math.round(x.price * s) })}>{t('prop.downPct', { pct: s * 100 })}</Button>
              ))}
            </div>
          </Card>

          <Card title={t('prop.extraLoans')} desc={t('prop.extraLoansDesc')}>
            <div className="presets">
              <span className="muted small">{t('aid.add')}</span>
              {AID_TEMPLATES.map((a) => (
                <Button key={a.id} kind="ghost" onClick={() => set((x) => { x.extraLoans.push(newExtraLoan(a.id)) })}>
                  + {t(`aid.${a.id}.name` as 'aid.ptz.name')}
                </Button>
              ))}
            </div>
            {o.extraLoans.length === 0 && <p className="muted">{t('prop.noExtraLoans')}</p>}
            <div className="stack tight">
              {o.extraLoans.map((l, i) => (
                <div key={l.id} className="stack tight">
                <div className="row-card">
                  <Grid min={140}>
                    <Text label={t('prop.loanLabel')} value={l.label} onChange={(v) => set((x) => { x.extraLoans[i].label = v })} />
                    <Num label={t('prop.loanAmount')} unit="€" value={l.amount} step={1000} min={0} onChange={(v) => set((x) => { x.extraLoans[i].amount = v })} />
                    <Pct label={t('prop.rate')} value={l.rate} step={0.05} min={0} max={0.15} onChange={(v) => set((x) => { x.extraLoans[i].rate = v })} />
                    <Num label={t('prop.years')} unit={t('unit.years')} value={l.years} step={1} min={1} max={40} onChange={(v) => set((x) => { x.extraLoans[i].years = Math.round(v) })} />
                    <Pct label={t('prop.insurance')} value={l.insurancePct} step={0.01} min={0} max={1} onChange={(v) => set((x) => { x.extraLoans[i].insurancePct = v })} />
                    <Num label={t('prop.deferral')} unit={t('unit.months')} value={l.deferralMonths} step={6} min={0} max={240} onChange={(v) => set((x) => { x.extraLoans[i].deferralMonths = Math.round(v) })} tip={t('prop.deferralTip')} />
                  </Grid>
                  <Button kind="ghost" onClick={() => set((x) => { x.extraLoans.splice(i, 1) })}>{t('common.remove')}</Button>
                </div>
                <AidInfo id={(l.template ?? 'custom') as AidId} />
                </div>
              ))}
            </div>
          </Card>

          <PtzTester />

          <OtherAids />

          <Card title={t('prop.running')} desc={t('prop.runningDesc')}>
            <Grid>
              <Num label={t('prop.copro')} unit="€ / an" value={o.coproAnnual} step={100} min={0} onChange={(v) => set((x) => { x.coproAnnual = v })} tip={t('prop.coproTip')} />
              <Num label={t('prop.propTax')} unit="€ / an" value={o.propertyTaxAnnual} step={50} min={0} onChange={(v) => set((x) => { x.propertyTaxAnnual = v })} tip={t('prop.propTaxTip')} />
              <Num label={t('prop.propTaxExempt')} unit={t('unit.years')} value={o.propertyTaxExemptYears} step={1} min={0} max={5} onChange={(v) => set((x) => { x.propertyTaxExemptYears = Math.round(v) })} tip={t('prop.propTaxExemptTip')} />
              <Num label={t('prop.ownerIns')} unit="€ / an" value={o.insuranceAnnual} step={25} min={0} onChange={(v) => set((x) => { x.insuranceAnnual = v })} tip={t('prop.ownerInsTip')} />
              <Num label={t('prop.energy')} unit="€ / an" value={o.energyAnnual} step={100} min={0} onChange={(v) => set((x) => { x.energyAnnual = v })} tip={t('prop.energyTip')} />
              <Pct label={t('prop.maintenance')} value={o.maintenancePct} step={0.1} min={0} max={0.05} onChange={(v) => set((x) => { x.maintenancePct = v })} tip={t('prop.maintenanceTip')} />
            </Grid>
            <h4>{t('prop.oneOffs')}</h4>
            <p className="muted small">{t('prop.oneOffsDesc')}</p>
            <div className="stack tight">
              {o.oneOffs.map((e, i) => (
                <div className="row-card" key={e.id}>
                  <Grid min={140}>
                    <Text label={t('prop.oneOffLabel')} value={e.label} placeholder={t('prop.oneOffPlaceholder')} onChange={(v) => set((x) => { x.oneOffs[i].label = v })} />
                    <Num label={t('prop.oneOffYear')} unit={t('unit.yearN')} value={e.year} step={1} min={1} max={40} onChange={(v) => set((x) => { x.oneOffs[i].year = Math.round(v) })} />
                    <Num label={t('prop.oneOffAmount')} unit="€" value={e.amount} step={500} min={0} onChange={(v) => set((x) => { x.oneOffs[i].amount = v })} />
                  </Grid>
                  <Button kind="ghost" onClick={() => set((x) => { x.oneOffs.splice(i, 1) })}>{t('common.remove')}</Button>
                </div>
              ))}
            </div>
            <div className="btn-row"><Button onClick={() => set((x) => { x.oneOffs.push(newOneOff()) })}>{t('prop.addOneOff')}</Button></div>
          </Card>

          <Card title={t('prop.exit')} desc={t('prop.exitDesc')}>
            <Grid>
              <Pct label={t('prop.sellPct')} value={o.sellingCostPct} step={0.5} min={0} max={0.15} onChange={(v) => set((x) => { x.sellingCostPct = v })} tip={t('prop.sellPctTip')} />
              <Num label={t('prop.sellFixed')} unit="€" value={o.sellingFixed} step={100} min={0} onChange={(v) => set((x) => { x.sellingFixed = v })} tip={t('prop.sellFixedTip')} />
            </Grid>
          </Card>
        </div>

        <aside className="aside">
          <Card title={t('sum.title')}>
            <table className="table compact">
              <tbody>
                <tr><td>{t('sum.price')}</td><td className="num">{fmt.eur(a.price)}</td></tr>
                <tr><td>{t('sum.notary')}</td><td className="num">{fmt.eur(a.notary + a.agency)}</td></tr>
                <tr><td>{t('sum.other')}</td><td className="num">{fmt.eur(a.works + a.furnishing + a.bankFees + a.guarantee)}</td></tr>
                <tr className="total"><td>{t('sum.need')}</td><td className="num">{fmt.eur(a.totalNeed)}</td></tr>
                <tr><td>{t('sum.down')}</td><td className="num">{fmt.eur(a.downPayment)}</td></tr>
                {a.extraLoansTotal > 0 && <tr><td>{t('sum.extraLoans')}</td><td className="num">{fmt.eur(a.extraLoansTotal)}</td></tr>}
                <tr><td>{t('sum.loan')}</td><td className="num"><strong>{fmt.eur(a.mainLoan)}</strong></td></tr>
                <tr><td>{t('sum.rate')}</td><td className="num">{fmt.pct(a.mainRate, 2)}</td></tr>
                <tr><td>{t('sum.payment')}</td><td className="num"><strong>{fmt.eur(dc.newPayment)}</strong></td></tr>
                <tr><td>{t('sum.credit')}</td><td className="num">{fmt.eur(creditCost)}</td></tr>
                <tr><td>{t('sum.ratio')}</td><td className={`num ${dc.ok ? '' : 'neg'}`}>{fmt.pct(dc.ratio)} {dc.ok ? '✓' : '▲'}</td></tr>
              </tbody>
            </table>
            {res.downPaymentShortfall > 0 && <Callout kind="bad">{t('warn.shortfall', { amount: fmt.eur(res.downPaymentShortfall) })}</Callout>}
            {!dc.ok && <Callout kind="warn">{t('sum.ratioWarn')}</Callout>}
          </Card>
        </aside>
      </div>
    </div>
  )
}
