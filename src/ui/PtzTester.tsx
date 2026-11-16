import { newExtraLoan } from '../engine/defaults'
import { computeAcquisition } from '../engine/simulate'
import { computePtz, ptzKind, PTZ_ZONES, type PtzZone } from '../engine/ptz'
import type { Key } from '../i18n'
import { useApp } from '../state'
import { Button, Callout, Card, Check, Grid, Num, Select, Stat } from './fields'

/** Checks whether the household can get a PTZ for the selected home, and what amount to expect. */
export default function PtzTester() {
  const { t, fmt, state, update, option: o } = useApp()
  const p = state.ptz
  const idx = Math.max(0, state.options.findIndex((x) => x.id === state.selectedId))
  const kind = ptzKind(o, p)
  const m = state.market

  // The other loans as they would be without the PTZ.
  const without = { ...o, extraLoans: o.extraLoans.filter((l) => l.template !== 'ptz') }
  const acq = computeAcquisition(without, m)
  const operationCost = o.price * (1 + o.agencyPct) + o.worksInitial
  const r = computePtz(p, kind, {
    operationCost,
    otherLoansWithoutPtz: acq.mainLoan + acq.extraLoansTotal,
    guaranteePct: o.guaranteePct,
    longestOtherYears: Math.max(o.years, ...without.extraLoans.map((l) => l.years)),
    worksShare: operationCost > 0 ? o.worksInitial / operationCost : 0,
  })

  const existing = o.extraLoans.findIndex((l) => l.template === 'ptz')
  const use = () =>
    update((d) => {
      const opt = d.options[idx]
      const base = existing >= 0 ? opt.extraLoans[existing] : newExtraLoan('ptz')
      Object.assign(base, { amount: r.amount, rate: 0, years: r.totalYears, deferralMonths: r.deferralYears * 12 })
      if (existing < 0) opt.extraLoans.push(base)
    })

  const checkText = (id: string): string => {
    switch (id) {
      case 'income':
        return t('ptz.check.income', { income: fmt.eur(r.incomeUsed), ceiling: fmt.eur(r.ceiling) })
      case 'works':
        return t('ptz.check.works', { share: fmt.pct(operationCost > 0 ? o.worksInitial / operationCost : 0, 0) })
      default:
        return t(`ptz.check.${id}` as Key)
    }
  }

  const rfrEstimate = Math.round((state.profile.netIncomeMonthly * 12 * 0.9) / 100) * 100

  return (
    <Card title={t('ptz.title')} desc={t('ptz.desc')}>
      <Grid>
        <Select<PtzZone>
          label={t('ptz.zone')} value={p.zone} tip={t('ptz.zoneTip')}
          options={PTZ_ZONES.map((z) => ({ value: z, label: z === 'A' ? t('ptz.zoneA') : z }))}
          onChange={(v) => update((d) => { d.ptz.zone = v })}
        />
        <Num label={t('ptz.persons')} value={p.persons} step={1} min={1} max={8} tip={t('ptz.personsTip')} onChange={(v) => update((d) => { d.ptz.persons = Math.round(v) })} />
        <Num label={t('ptz.rfr')} unit="€ / an" value={p.rfr} step={1000} min={0} tip={t('ptz.rfrTip')} onChange={(v) => update((d) => { d.ptz.rfr = v })} />
        {o.kind === 'new' && (
          <Select<'collective' | 'house'>
            label={t('ptz.newKind')} value={p.newKind} tip={t('ptz.newKindTip')}
            options={[{ value: 'collective', label: t('ptz.newCollective') }, { value: 'house', label: t('ptz.newHouse') }]}
            onChange={(v) => update((d) => { d.ptz.newKind = v })}
          />
        )}
        <Check label={t('ptz.firstTime')} checked={p.firstTime} tip={t('ptz.firstTimeTip')} onChange={(v) => update((d) => { d.ptz.firstTime = v })} />
        {o.kind === 'old' && <Check label={t('ptz.dpe')} checked={p.dpeOk} tip={t('ptz.dpeTip')} onChange={(v) => update((d) => { d.ptz.dpeOk = v })} />}
      </Grid>
      <div className="btn-row">
        <Button kind="ghost" onClick={() => update((d) => { d.ptz.rfr = rfrEstimate })}>{t('ptz.rfrEstimate', { amount: fmt.eur(rfrEstimate) })}</Button>
      </div>

      <Callout kind={r.eligible ? 'ok' : 'bad'}>
        <strong>{r.eligible ? t('ptz.eligible') : t('ptz.notEligible')}</strong>
        <ul className="plain checks">
          {r.checks.map((c) => (
            <li key={c.id} className={c.ok ? 'ok' : 'ko'}>{c.ok ? '✓' : '✗'} {checkText(c.id)}</li>
          ))}
        </ul>
      </Callout>

      {r.eligible && r.tranche && (
        <>
          <div className="cols-3">
            <Stat label={t('ptz.tranche')} value={t('ptz.trancheN', { n: r.tranche })} sub={t('ptz.trancheSub', { income: fmt.eur(r.incomeUsed / r.coefficient), coef: r.coefficient.toLocaleString(state.lang === 'fr' ? 'fr-FR' : 'en-GB') })} />
            <Stat label={t('ptz.amount')} value={fmt.eur(r.amount)} sub={t('ptz.amountSub', { quotite: fmt.pct(r.quotite, 0), cost: fmt.eur(r.cappedCost) })} />
            <Stat label={t('ptz.terms')} value={t('ptz.termsValue', { total: r.totalYears, deferral: r.deferralYears })} sub={t('ptz.termsSub')} />
          </div>
          {r.limitedByOtherLoans && <Callout kind="warn">{t('ptz.limitedOther')}</Callout>}
          <div className="btn-row">
            <Button kind="primary" disabled={r.amount <= 0} onClick={use}>{existing >= 0 ? t('ptz.update') : t('ptz.use')}</Button>
          </div>
        </>
      )}
      <p className="muted small">{t('ptz.notes')}</p>
    </Card>
  )
}
