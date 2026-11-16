import { useMemo } from 'react'
import { borrowingCapacity } from '../engine/analysis'
import { HCSF_MAX_DEBT_RATIO, HCSF_MAX_YEARS, HCSF_MAX_YEARS_WORKS } from '../engine/defaults'
import { Callout, Card, Stat } from '../ui/fields'
import { useMain } from '../hooks'
import { useApp } from '../state'

export default function Feasibility() {
  const { t, fmt, option } = useApp()
  const { sc, res, dc } = useMain()
  const a = res.acquisition
  const p = sc.profile
  const free = Math.max(0, p.savings - p.emergencyFund)
  const maxYears = option.kind === 'new' || option.worksInitial > 0 ? HCSF_MAX_YEARS_WORKS : HCSF_MAX_YEARS
  const minDown = a.notary + a.agency + a.guarantee + a.bankFees
  const years = [15, 20, 25]
  const caps = useMemo(() => years.map((y) => ({ y, c: borrowingCapacity(sc, y, Math.min(a.downPayment, free + p.existingPea.value)) })), [sc, a.downPayment, free, p.existingPea.value])
  const pctBar = Math.min(100, (dc.ratio / 0.5) * 100)
  const limitPos = (HCSF_MAX_DEBT_RATIO / 0.5) * 100
  const leftover = free - a.downPayment

  return (
    <div className="stack">
      <Callout kind="info">{t('feas.intro')}</Callout>

      <Card title={t('feas.ratio')} desc={t('feas.ratioDesc', { max: fmt.pct(HCSF_MAX_DEBT_RATIO, 0) })}>
        <div className="gauge" role="img" aria-label={`${t('feas.ratio')}: ${fmt.pct(dc.ratio)}`}>
          <div className={`gauge-fill ${dc.ok ? 'ok' : 'bad'}`} style={{ width: `${pctBar}%` }} />
          <div className="gauge-limit" style={{ left: `${limitPos}%` }}><span>{fmt.pct(HCSF_MAX_DEBT_RATIO, 0)}</span></div>
        </div>
        <div className="cols-3">
          <Stat label={t('feas.yourRatio')} value={<span className={dc.ok ? '' : 'neg'}>{fmt.pct(dc.ratio)} {dc.ok ? '✓' : '▲'}</span>} sub={dc.ok ? t('feas.ratioOk') : t('feas.ratioKo')} />
          <Stat label={t('feas.newPayment')} value={fmt.eur(dc.newPayment)} sub={t('feas.newPaymentSub', { max: fmt.eur(dc.maxNewPayment) })} />
          <Stat label={t('feas.existing')} value={fmt.eur(dc.existingPayments)} sub={t('feas.existingSub')} />
        </div>
        <div className="cols-3">
          <Stat label={t('feas.rest')} value={<span className={dc.restToLive < 0 ? 'neg' : ''}>{fmt.eur(dc.restToLive)}</span>} sub={t('feas.restSub')} />
          <Stat label={t('feas.duration')} value={`${option.years} ${t('unit.years')}`} sub={option.years > maxYears ? t('feas.durationKo', { max: maxYears }) : t('feas.durationOk', { max: maxYears })} />
          <Stat label={t('feas.dispo')} value={fmt.eur(leftover)} sub={t('feas.dispoSub', { fund: fmt.eur(p.emergencyFund) })} />
        </div>
      </Card>

      <Card title={t('feas.apport')} desc={t('feas.apportDesc')}>
        <div className="table-wrap">
          <table className="table compact">
            <tbody>
              <tr><td>{t('feas.minDown')}</td><td className="num">{fmt.eur(minDown)}</td></tr>
              <tr><td>{t('feas.yourDown')}</td><td className="num">{fmt.eur(a.downPayment)}</td></tr>
              <tr><td>{t('feas.downPct')}</td><td className="num">{fmt.pct(a.price > 0 ? a.downPayment / a.price : 0)}</td></tr>
              <tr><td>{t('feas.available')}</td><td className="num">{fmt.eur(free)}{p.existingPea.value > 0 ? ` + ${fmt.eur(p.existingPea.value)} PEA` : ''}</td></tr>
            </tbody>
          </table>
        </div>
        {a.downPayment < minDown && <Callout kind="warn">{t('feas.downLow')}</Callout>}
        {res.downPaymentShortfall > 0 && <Callout kind="bad">{t('warn.shortfall', { amount: fmt.eur(res.downPaymentShortfall) })}</Callout>}
      </Card>

      <Card title={t('feas.capacity')} desc={t('feas.capacityDesc', { max: fmt.pct(HCSF_MAX_DEBT_RATIO, 0) })}>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr><th>{t('cmp.loanYears')}</th><th className="num">{t('feas.maxPayment')}</th><th className="num">{t('feas.maxLoan')}</th><th className="num">{t('feas.maxPrice')}</th></tr>
            </thead>
            <tbody>
              {caps.map(({ y, c }) => (
                <tr key={y}>
                  <td>{y} {t('unit.years')}</td>
                  <td className="num">{fmt.eur(c.maxPayment)}</td>
                  <td className="num">{fmt.eur(c.maxLoan)}</td>
                  <td className="num"><strong>{fmt.eur(c.maxPrice)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">{t('feas.capacityNote')}</p>
      </Card>

      <Card title={t('feas.rules')}>
        <ul className="plain">
          <li>{t('feas.rule1')}</li>
          <li>{t('feas.rule2')}</li>
          <li>{t('feas.rule3')}</li>
        </ul>
      </Card>
    </div>
  )
}
