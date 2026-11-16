import { newCredit } from '../engine/defaults'
import { Button, Callout, Card, Grid, Num, Pct, Text } from '../ui/fields'
import { useApp } from '../state'

export default function Profile() {
  const { t, fmt, state, update } = useApp()
  const p = state.profile
  const free = Math.max(0, p.savings - p.emergencyFund)
  const income = p.netIncomeMonthly - p.incomeTaxMonthly

  return (
    <div className="stack">
      <Callout kind="info">{t('profile.intro')}</Callout>

      <Card title={t('profile.income')} desc={t('profile.incomeDesc')}>
        <Grid>
          <Num label={t('profile.netIncome')} unit="€ / mois" value={p.netIncomeMonthly} step={50} min={0} onChange={(v) => update((d) => { d.profile.netIncomeMonthly = v })} tip={t('profile.netIncomeTip')} />
          <Num label={t('profile.tax')} unit="€ / mois" value={p.incomeTaxMonthly} step={10} min={0} onChange={(v) => update((d) => { d.profile.incomeTaxMonthly = v })} tip={t('profile.taxTip')} />
          <Pct label={t('profile.growth')} value={p.incomeGrowth} step={0.1} min={-0.1} max={0.2} onChange={(v) => update((d) => { d.profile.incomeGrowth = v })} tip={t('profile.growthTip')} />
          <Num label={t('profile.living')} unit="€ / mois" value={p.livingExpensesMonthly} step={50} min={0} onChange={(v) => update((d) => { d.profile.livingExpensesMonthly = v })} tip={t('profile.livingTip')} />
        </Grid>
        <p className="muted small">{t('profile.cashAfterTax', { amount: fmt.eur(income), left: fmt.eur(income - p.livingExpensesMonthly) })}</p>
      </Card>

      <Card title={t('profile.savings')} desc={t('profile.savingsDesc')}>
        <Grid>
          <Num label={t('profile.savingsTotal')} unit="€" value={p.savings} step={1000} min={0} onChange={(v) => update((d) => { d.profile.savings = v })} tip={t('profile.savingsTip')} />
          <Num label={t('profile.emergency')} unit="€" value={p.emergencyFund} step={500} min={0} onChange={(v) => update((d) => { d.profile.emergencyFund = v })} tip={t('profile.emergencyTip')} />
          <Num label={t('profile.age')} unit={t('unit.years')} value={p.borrowerAge} step={1} min={18} max={80} onChange={(v) => update((d) => { d.profile.borrowerAge = v })} tip={t('profile.ageTip')} />
        </Grid>
        <p className="muted small">{t('profile.free', { amount: fmt.eur(free) })}</p>
      </Card>

      <Card title={t('profile.pea')} desc={t('profile.peaDesc')}>
        <Grid>
          <Num label={t('profile.peaValue')} unit="€" value={p.existingPea.value} step={1000} min={0} onChange={(v) => update((d) => { d.profile.existingPea.value = v })} />
          <Num label={t('profile.peaDeposits')} unit="€" value={p.existingPea.deposits} step={1000} min={0} onChange={(v) => update((d) => { d.profile.existingPea.deposits = v })} tip={t('profile.peaDepositsTip')} />
          <Num label={t('profile.peaAge')} unit={t('unit.years')} value={p.existingPea.ageYears} step={1} min={0} max={40} onChange={(v) => update((d) => { d.profile.existingPea.ageYears = v })} tip={t('profile.peaAgeTip')} />
        </Grid>
      </Card>

      <Card
        title={t('profile.credits')}
        desc={t('profile.creditsDesc')}
        actions={<Button onClick={() => update((d) => { d.profile.credits.push(newCredit()) })}>{t('common.add')}</Button>}
      >
        {p.credits.length === 0 && <p className="muted">{t('profile.noCredits')}</p>}
        <div className="stack tight">
          {p.credits.map((c, i) => (
            <div className="row-card" key={c.id}>
              <Grid min={150}>
                <Text label={t('profile.creditLabel')} value={c.label} placeholder={t('profile.creditPlaceholder')} onChange={(v) => update((d) => { d.profile.credits[i].label = v })} />
                <Num label={t('profile.creditPayment')} unit="€ / mois" value={c.monthlyPayment} step={10} min={0} onChange={(v) => update((d) => { d.profile.credits[i].monthlyPayment = v })} />
                <Num label={t('profile.creditMonths')} unit={t('unit.months')} value={c.remainingMonths} step={1} min={0} max={480} onChange={(v) => update((d) => { d.profile.credits[i].remainingMonths = Math.round(v) })} />
              </Grid>
              <Button kind="ghost" onClick={() => update((d) => { d.profile.credits.splice(i, 1) })}>{t('common.remove')}</Button>
            </div>
          ))}
        </div>
        {p.credits.length > 0 && (
          <p className="muted small">{t('profile.creditsTotal', { amount: fmt.eur(p.credits.reduce((s, c) => s + c.monthlyPayment, 0)) })}</p>
        )}
      </Card>
    </div>
  )
}
