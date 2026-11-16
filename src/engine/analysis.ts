import { HCSF_MAX_DEBT_RATIO } from './defaults'
import { annuity, rateForYears } from './loan'
import { atHorizon, computeAcquisition, simulate, toReal } from './simulate'
import type { Market, PropertyOption, Scenario, SimResult } from './types'

export const MAX_YEARS = 40

/** Set the gross yearly return of what the money is invested in: the PEA, or the savings account when there is no PEA. */
export function setInvestReturn(s: Scenario, x: number): void {
  if (s.market.vehicle === 'savings') s.market.savingsGross = x
  else s.market.peaReturn = x
}

function clone<T>(x: T): T {
  return structuredClone(x)
}

/** Simulation long enough to read any horizon up to 40 years. */
export function simulateLong(sc: Scenario): SimResult {
  return simulate(sc, { months: MAX_YEARS * 12 })
}

/** Advantage of buying at a horizon, in euros (positive = buying wins). */
export function diffAt(sc: Scenario, horizonYears = sc.market.horizonYears, real = false): number {
  const res = simulate(sc, { months: Math.round(horizonYears * 12) })
  const pt = atHorizon(res, horizonYears)
  return real ? toReal(pt.diff, horizonYears, sc.market.inflation) : pt.diff
}

/**
 * First year (fractional) from which buying stays ahead until the end of the simulated range.
 * 0 = ahead from the start, null = never ahead.
 */
export function breakEvenYear(res: SimResult): number | null {
  const pts = res.years
  let i = pts.length - 1
  if (pts[i].diff < 0) return null
  while (i > 0 && pts[i - 1].diff >= 0) i--
  if (i === 0) return 0
  const a = pts[i - 1]
  const b = pts[i]
  const frac = -a.diff / (b.diff - a.diff)
  return a.year + frac * (b.year - a.year)
}

export type SolveStatus = 'ok' | 'always' | 'never'
export interface Solved {
  status: SolveStatus
  value: number | null
}

/** Bisection on a monotonic function f(x) = 0 within [lo, hi]. */
function bisect(f: (x: number) => number, lo: number, hi: number, increasing: boolean): Solved {
  const flo = f(lo)
  const fhi = f(hi)
  // The sign we want to see at the "buy wins" end of the interval.
  if (increasing) {
    if (flo >= 0) return { status: 'always', value: null }
    if (fhi < 0) return { status: 'never', value: null }
  } else {
    if (fhi >= 0) return { status: 'always', value: null }
    if (flo < 0) return { status: 'never', value: null }
  }
  let a = lo
  let b = hi
  for (let k = 0; k < 40; k++) {
    const mid = (a + b) / 2
    const fm = f(mid)
    if ((fm >= 0) === increasing) b = mid
    else a = mid
  }
  return { status: 'ok', value: (a + b) / 2 }
}

/** Yearly property appreciation for which buying and renting end equal at the horizon. */
export function breakEvenAppreciation(sc: Scenario): Solved {
  return bisect(
    (x) => {
      const s = clone(sc)
      s.market.homeAppreciation = x
      return diffAt(s)
    },
    -0.1, 0.15, true,
  )
}

/** Monthly rent (all-in) at which renting costs as much as buying at the horizon. */
export function breakEvenRent(sc: Scenario): Solved {
  return bisect(
    (x) => {
      const s = clone(sc)
      s.rent.equivalentYield = null
      s.rent.rentMonthly = x
      return diffAt(s)
    },
    0, 6_000, true,
  )
}

/** Gross PEA return for which buying and renting end equal. */
export function breakEvenPeaReturn(sc: Scenario): Solved {
  return bisect(
    (x) => {
      const s = clone(sc)
      setInvestReturn(s, x)
      return diffAt(s)
    },
    -0.05, 0.2, false,
  )
}

/** Same option with another loan duration; the rate follows the rate table (shape kept if overridden). */
export function withDuration(sc: Scenario, years: number): Scenario {
  const s = clone(sc)
  const o = s.option
  const table = s.market.rateTable
  if (o.rateOverride !== null) o.rateOverride += rateForYears(table, years) - rateForYears(table, o.years)
  o.years = years
  return s
}

export interface GridCell {
  loanYears: number
  horizon: number
  diff: number
  diffReal: number
  rate: number
}

/** Advantage of buying for every (loan duration, horizon) pair. */
export function durationHorizonGrid(sc: Scenario, loanYears: number[], horizons: number[]): GridCell[] {
  const out: GridCell[] = []
  for (const ly of loanYears) {
    const s = withDuration(sc, ly)
    const res = simulateLong(s)
    const rate = computeAcquisition(s.option, s.market).mainRate
    for (const h of horizons) {
      const pt = atHorizon(res, h)
      out.push({ loanYears: ly, horizon: h, diff: pt.diff, diffReal: toReal(pt.diff, h, s.market.inflation), rate })
    }
  }
  return out
}

export interface DownRow {
  down: number
  share: number
  diff: number
  diffReal: number
  loan: number
  payment: number
  debtRatio: number
  shortfall: number
}

/** Advantage of buying for several down payments (share of the price). */
export function downPaymentSweep(sc: Scenario, shares: number[]): DownRow[] {
  return shares.map((share) => {
    const s = clone(sc)
    s.option.downPayment = share * s.option.price
    const res = simulate(s)
    const pt = atHorizon(res, s.market.horizonYears)
    const dc = debtCheck(s)
    return {
      down: res.acquisition.downPayment,
      share,
      diff: pt.diff,
      diffReal: toReal(pt.diff, s.market.horizonYears, s.market.inflation),
      loan: res.acquisition.mainLoan,
      payment: dc.newPayment,
      debtRatio: dc.ratio,
      shortfall: res.downPaymentShortfall,
    }
  })
}

/** Advantage of buying (at the horizon) over a grid of property appreciation × PEA return. */
export function returnsHeatmap(sc: Scenario, appreciations: number[], peaReturns: number[]): number[][] {
  return peaReturns.map((pr) =>
    appreciations.map((ap) => {
      const s = clone(sc)
      s.market.homeAppreciation = ap
      setInvestReturn(s, pr)
      return diffAt(s)
    }),
  )
}

export interface Preset {
  id: string
  patch: Partial<Pick<Market, 'peaReturn' | 'homeAppreciation' | 'rentGrowth' | 'inflation'>>
}

export function applyPatch(sc: Scenario, patch: Preset['patch']): Scenario {
  const s = clone(sc)
  const p = { ...patch }
  if (s.market.vehicle === 'savings') delete p.peaReturn // the PEA return does not exist without a PEA
  Object.assign(s.market, p)
  return s
}

export interface OptionResult {
  option: PropertyOption
  res: SimResult
  diff: number
  diffReal: number
  buyerNet: number
  renterNet: number
  dc: DebtCheck
}

export function evaluateOption(sc: Scenario, option: PropertyOption): OptionResult {
  const s = clone(sc)
  s.option = clone(option)
  const res = simulate(s)
  const pt = atHorizon(res, s.market.horizonYears)
  return {
    option,
    res,
    diff: pt.diff,
    diffReal: toReal(pt.diff, s.market.horizonYears, s.market.inflation),
    buyerNet: pt.buyerNet,
    renterNet: pt.renterNet,
    dc: debtCheck(s),
  }
}

// ---------- Borrowing capacity and bank checks ----------

export interface DebtCheck {
  /** Monthly payment of the new loans, insurance included (after any deferral). */
  newPayment: number
  existingPayments: number
  /** Debt ratio the bank looks at: (existing + new payments) / net income before tax. */
  ratio: number
  ok: boolean
  /** Money left each month once credits and the owner's running costs are paid (first year). */
  restToLive: number
  /** Monthly payment the 35 % rule allows for the new loan(s). */
  maxNewPayment: number
}

/** Highest payment (capital + interest + insurance) for the main loan that keeps the household under the ratio. */
export function debtCheck(sc: Scenario, maxRatio = HCSF_MAX_DEBT_RATIO): DebtCheck {
  const { profile: p, option: o, market: m } = sc
  const acq = computeAcquisition(o, m)
  let newPayment = 0
  const months = Math.round(o.years * 12)
  newPayment += annuity(acq.mainLoan, acq.mainRate, months) + (acq.mainLoan * o.insurancePct) / 12
  for (const l of o.extraLoans) {
    if (l.amount <= 0) continue
    const total = Math.round(l.years * 12)
    const amort = Math.max(1, total - Math.min(l.deferralMonths, total - 1))
    newPayment += annuity(l.amount, l.rate, amort) + (l.amount * l.insurancePct) / 12
  }
  const existing = p.credits.reduce((s, c) => s + (c.remainingMonths > 0 ? c.monthlyPayment : 0), 0)
  const income = Math.max(1, p.netIncomeMonthly)
  const ratio = (existing + newPayment) / income
  const running = (o.propertyTaxAnnual + o.coproAnnual + o.insuranceAnnual + o.energyAnnual) / 12 + (o.maintenancePct * acq.initialValue) / 12
  const restToLive = p.netIncomeMonthly - p.incomeTaxMonthly - existing - newPayment - running
  return {
    newPayment,
    existingPayments: existing,
    ratio,
    ok: ratio <= maxRatio + 1e-9,
    restToLive,
    maxNewPayment: Math.max(0, maxRatio * income - existing),
  }
}

export interface Capacity {
  maxPayment: number
  maxLoan: number
  /** Highest price whose total cost fits the loan plus the available down payment. */
  maxPrice: number
}

/** What the household can borrow, and the price it can aim at, for a given duration. */
export function borrowingCapacity(sc: Scenario, years: number, down: number, maxRatio = HCSF_MAX_DEBT_RATIO): Capacity {
  const { profile: p, option: o, market: m } = sc
  const existing = p.credits.reduce((s, c) => s + (c.remainingMonths > 0 ? c.monthlyPayment : 0), 0)
  const maxPayment = Math.max(0, maxRatio * p.netIncomeMonthly - existing)
  const rate = o.rateOverride !== null
    ? o.rateOverride + rateForYears(m.rateTable, years) - rateForYears(m.rateTable, o.years)
    : rateForYears(m.rateTable, years)
  const factor = annuity(1, rate, Math.round(years * 12)) + o.insurancePct / 12
  const extra = o.extraLoans.reduce((s, l) => s + Math.max(0, l.amount), 0)
  const maxLoan = factor > 0 ? maxPayment / factor : 0
  const g = Math.min(o.guaranteePct, 0.5)
  const fixed = o.worksInitial + o.movingFurnishing + o.bankFees
  const price = (maxLoan * (1 - g) + down + extra - fixed) / (1 + o.notaryPct + o.agencyPct)
  return { maxPayment, maxLoan, maxPrice: Math.max(0, price) }
}

export interface Cut {
  requested: number
  effective: number
  /** Who runs out of money first. */
  who: 'buy' | 'rent' | 'both'
  /** Year (1-based) in which the savings run out. */
  year: number
}

/**
 * A scenario in which every account is empty and cash would go negative is not viable: beyond that
 * point the model would silently borrow money for free. The comparison is therefore stopped at the last
 * full year before the first of the two households runs dry.
 */
export function cutScenario(sc: Scenario): { sc: Scenario; cut: Cut | null; res: SimResult } {
  const res = simulateLong(sc)
  const h = Math.max(1, Math.round(sc.market.horizonYears))
  const yb = res.firstInsolventMonthBuyer ? Math.floor((res.firstInsolventMonthBuyer - 1) / 12) + 1 : 0
  const yr = res.firstInsolventMonthRenter ? Math.floor((res.firstInsolventMonthRenter - 1) / 12) + 1 : 0
  const year = Math.min(yb || Infinity, yr || Infinity)
  if (!Number.isFinite(year) || year > h) return { sc, cut: null, res }
  const effective = Math.max(1, year - 1)
  const who = yb === yr ? 'both' : yb === year ? 'buy' : 'rent'
  const s = clone(sc)
  s.market.horizonYears = effective
  return { sc: s, cut: { requested: h, effective, who, year }, res }
}
