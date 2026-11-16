import type { RatePoint } from './types'

/** Constant monthly payment (capital + interest) of an amortising loan. */
export function annuity(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 12
  if (r === 0) return principal / months
  return (principal * r) / (1 - Math.pow(1 + r, -months))
}

export interface LoanSchedule {
  /** Length = number of months simulated; zeros once the loan is repaid. */
  interest: Float64Array
  principal: Float64Array
  insurance: Float64Array
  /** Outstanding capital at the end of each month (index 0 = after the first payment). */
  balance: Float64Array
  /** Month index (1-based) of the last payment, 0 for no loan. */
  endMonth: number
  /** Scheduled payment during the amortising period (capital + interest, no insurance). */
  payment: number
}

export interface LoanParams {
  amount: number
  annualRate: number
  /** Total term in years, deferral included. */
  years: number
  /** Yearly insurance as a share of the initial capital. */
  insurancePct: number
  deferralMonths?: number
  /** Extra principal repaid each month (shortens the loan). */
  extraMonthly?: number
}

/**
 * Month-by-month schedule. During the deferral only interest (and insurance) is paid.
 * Insurance is computed on the initial capital until the loan is repaid, as most banks do.
 */
export function buildSchedule(p: LoanParams, horizonMonths: number): LoanSchedule {
  const n = Math.max(0, Math.round(horizonMonths))
  const interest = new Float64Array(n)
  const principal = new Float64Array(n)
  const insurance = new Float64Array(n)
  const balance = new Float64Array(n)
  if (p.amount <= 0 || p.years <= 0) {
    return { interest, principal, insurance, balance, endMonth: 0, payment: 0 }
  }
  const total = Math.round(p.years * 12)
  const deferral = Math.min(Math.max(0, p.deferralMonths ?? 0), total - 1)
  const amortMonths = total - deferral
  const payment = annuity(p.amount, p.annualRate, amortMonths)
  const r = p.annualRate / 12
  const monthlyInsurance = (p.amount * p.insurancePct) / 12
  const extra = Math.max(0, p.extraMonthly ?? 0)
  let bal = p.amount
  let endMonth = 0
  for (let t = 0; t < total && t < n; t++) {
    if (bal <= 0.005) break
    const i = bal * r
    let cap = t < deferral ? 0 : payment - i
    if (t >= deferral) cap += extra
    if (cap > bal || t === total - 1) cap = bal
    interest[t] = i
    principal[t] = cap
    insurance[t] = monthlyInsurance
    bal -= cap
    balance[t] = bal
    endMonth = t + 1
  }
  // Balance stays at its last value (0 once repaid) for the months after the end.
  for (let t = endMonth; t < n; t++) balance[t] = 0
  return { interest, principal, insurance, balance, endMonth, payment }
}

/** Total cost of credit (interest + insurance) of a schedule over its life. */
export function totalCost(s: LoanSchedule): number {
  let c = 0
  for (let t = 0; t < s.interest.length; t++) c += s.interest[t] + s.insurance[t]
  return c
}

/** Linear interpolation in the rate table, clamped at both ends. */
export function rateForYears(table: RatePoint[], years: number): number {
  const pts = [...table].sort((a, b) => a.years - b.years)
  if (pts.length === 0) return 0.035
  if (years <= pts[0].years) return pts[0].rate
  const last = pts[pts.length - 1]
  if (years >= last.years) return last.rate
  for (let i = 1; i < pts.length; i++) {
    if (years <= pts[i].years) {
      const a = pts[i - 1]
      const b = pts[i]
      return a.rate + ((b.rate - a.rate) * (years - a.years)) / (b.years - a.years)
    }
  }
  return last.rate
}
