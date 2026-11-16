import { buildSchedule, rateForYears, type LoanSchedule } from './loan'
import type { Acquisition, Market, PropertyOption, Scenario, SimResult, YearPoint } from './types'

export function effectiveRate(o: PropertyOption, m: Market): number {
  return o.rateOverride ?? rateForYears(m.rateTable, o.years)
}

/**
 * Everything paid at signing and the amount to borrow.
 * The guarantee is a share of the loan, hence the closed form L = (need - down - other loans) / (1 - g).
 */
export function computeAcquisition(o: PropertyOption, m: Market): Acquisition {
  const notary = o.price * o.notaryPct
  const agency = o.price * o.agencyPct
  const extraLoansTotal = o.extraLoans.reduce((s, l) => s + Math.max(0, l.amount), 0)
  const need0 = o.price + notary + agency + o.worksInitial + o.movingFurnishing + o.bankFees
  const g = Math.min(Math.max(o.guaranteePct, 0), 0.5)
  let down = Math.max(0, o.downPayment)
  let loan = (need0 - down - extraLoansTotal) / (1 - g)
  if (loan < 0) {
    loan = 0
    down = Math.max(0, need0 - extraLoansTotal)
  }
  const guarantee = g * loan
  return {
    price: o.price,
    notary,
    agency,
    works: o.worksInitial,
    furnishing: o.movingFurnishing,
    bankFees: o.bankFees,
    guarantee,
    totalNeed: need0 + guarantee,
    extraLoansTotal,
    downPayment: down,
    mainLoan: loan,
    mainRate: effectiveRate(o, m),
    initialValue: o.price + o.worksInitial * o.worksValueAddedPct,
  }
}

/** Optional stochastic paths: monthly growth factors (1 + monthly return), before fees for the PEA. */
export interface Paths {
  pea: Float64Array
  home: Float64Array
}

export interface SimOptions {
  /** Months to simulate. Default: the market horizon. */
  months?: number
  paths?: Paths
}

/** Investment accounts of one household in one scenario. */
class Portfolio {
  livret: number
  peaValue = 0
  peaBasis = 0
  peaDeposits = 0
  ctoValue = 0
  ctoBasis = 0

  constructor(livret: number) {
    this.livret = livret
  }

  grow(growth: number, livretFactor: number) {
    this.peaValue *= growth
    this.ctoValue *= growth
    this.livret *= livretFactor
  }

  /** Put money to work: PEA first (until its ceiling), then the overflow vehicle. */
  invest(amount: number, cap: number, overflow: 'cto' | 'cash') {
    if (amount <= 0) return
    const room = Math.max(0, cap - this.peaDeposits)
    const toPea = Math.min(amount, room)
    this.peaValue += toPea
    this.peaBasis += toPea
    this.peaDeposits += toPea
    const rest = amount - toPea
    if (rest <= 0) return
    if (overflow === 'cto') {
      this.ctoValue += rest
      this.ctoBasis += rest
    } else {
      this.livret += rest
    }
  }

  /** Withdraw `net` euros after tax from the PEA, tax applied pro rata to the gains. Returns what could be obtained. */
  withdrawPea(net: number, taxRate: number): number {
    if (this.peaValue <= 0 || net <= 0) return 0
    const gainShare = Math.max(0, 1 - this.peaBasis / this.peaValue)
    const maxNet = this.peaValue * (1 - taxRate * gainShare)
    const got = Math.min(net, maxNet)
    const gross = got / (1 - taxRate * gainShare)
    const keep = 1 - gross / this.peaValue
    this.peaBasis *= keep
    this.peaValue -= gross
    return got
  }

  withdrawCto(net: number, taxRate: number): number {
    if (this.ctoValue <= 0 || net <= 0) return 0
    const gainShare = Math.max(0, 1 - this.ctoBasis / this.ctoValue)
    const maxNet = this.ctoValue * (1 - taxRate * gainShare)
    const got = Math.min(net, maxNet)
    const gross = got / (1 - taxRate * gainShare)
    const keep = 1 - gross / this.ctoValue
    this.ctoBasis *= keep
    this.ctoValue -= gross
    return got
  }

  /** Cover a cash need: CTO first, then livret, then PEA. Livret may go negative (= household out of money). */
  cover(need: number, peaTax: number, pfu: number) {
    let rest = need
    rest -= this.withdrawCto(rest, pfu)
    if (rest > 0 && this.livret > 0) {
      const take = Math.min(rest, this.livret)
      this.livret -= take
      rest -= take
    }
    if (rest > 0) rest -= this.withdrawPea(rest, peaTax)
    if (rest > 0) this.livret -= rest
  }

  peaNet(taxRate: number): number {
    return this.peaValue - Math.max(0, this.peaValue - this.peaBasis) * taxRate
  }

  ctoNet(pfu: number): number {
    return this.ctoValue - Math.max(0, this.ctoValue - this.ctoBasis) * pfu
  }

  netAssets(peaTax: number, pfu: number): number {
    return this.livret + this.peaNet(peaTax) + this.ctoNet(pfu)
  }
}

function zeroCum(): YearPoint['cum'] {
  return {
    interest: 0, loanInsurance: 0, propertyTax: 0, copro: 0, insurance: 0, energy: 0,
    maintenance: 0, oneOffs: 0, principal: 0, rent: 0, rentInsurance: 0, rentEnergy: 0,
  }
}

/**
 * Month-by-month simulation of two parallel lives with the same income, the same living expenses
 * and the same savings. Only the housing differs. Whatever is left each month is invested
 * (PEA first, then the overflow vehicle); a deficit is covered from savings.
 * Net worth is "liquidation value": what the household would hold after selling and paying every tax.
 */
export interface Prepared {
  sc: Scenario
  months: number
  acq: Acquisition
  loans: { s: LoanSchedule; rate: number }[]
  debtAt0: number
  creditPay: Float64Array
}

/** Deterministic part of a simulation (loan schedules, existing credits): computed once, reused by every Monte Carlo path. */
export function prepareSim(sc: Scenario, months: number): Prepared {
  const { profile: p, market: m, option: o } = sc
  const acq = computeAcquisition(o, m)
  const main = buildSchedule(
    { amount: acq.mainLoan, annualRate: acq.mainRate, years: o.years, insurancePct: o.insurancePct, extraMonthly: o.extraRepaymentMonthly },
    months,
  )
  const loans: { s: LoanSchedule; rate: number }[] = [{ s: main, rate: acq.mainRate }]
  for (const l of o.extraLoans) {
    if (l.amount <= 0) continue
    loans.push({
      s: buildSchedule(
        { amount: l.amount, annualRate: l.rate, years: l.years, insurancePct: l.insurancePct, deferralMonths: l.deferralMonths },
        months,
      ),
      rate: l.rate,
    })
  }
  const creditPay = new Float64Array(months)
  for (const c of p.credits) {
    const end = Math.min(months, Math.max(0, Math.round(c.remainingMonths)))
    for (let t = 0; t < end; t++) creditPay[t] += Math.max(0, c.monthlyPayment)
  }
  return { sc, months, acq, loans, debtAt0: acq.mainLoan + acq.extraLoansTotal, creditPay }
}

export function simulate(sc: Scenario, opts: SimOptions = {}): SimResult {
  const months = Math.max(1, Math.round(opts.months ?? sc.market.horizonYears * 12))
  return runSim(prepareSim(sc, months), opts.paths)
}

export function runSim(prep: Prepared, paths?: Paths): SimResult {
  const { sc, months, acq, loans, debtAt0, creditPay } = prep
  const { profile: p, rent, market: m, option: o } = sc

  // --- Growth factors ---
  const feeF = Math.pow(1 - Math.min(Math.max(m.peaFees, 0), 0.5), 1 / 12)
  const growF = Math.pow(1 + m.peaReturn, 1 / 12)
  const homeF = Math.pow(1 + m.homeAppreciation, 1 / 12)
  const livretF = Math.pow(1 + m.livretRate, 1 / 12)

  // --- Starting portfolios ---
  const hasPea = p.existingPea.value > 0 || p.existingPea.deposits > 0
  const peaAgeMonths0 = hasPea ? Math.max(0, p.existingPea.ageYears) * 12 : 0
  const emergency = Math.min(Math.max(0, p.emergencyFund), Math.max(0, p.savings))
  const free = Math.max(0, p.savings - emergency)

  const makePortfolio = (): Portfolio => {
    const pf = new Portfolio(emergency)
    pf.peaValue = p.existingPea.value
    // Without a known deposit total we assume no gain yet (basis = value).
    pf.peaBasis = p.existingPea.deposits > 0 ? p.existingPea.deposits : p.existingPea.value
    pf.peaDeposits = Math.max(p.existingPea.deposits, 0)
    return pf
  }
  const peaTaxAt = (ageMonths: number) => (ageMonths >= 60 ? m.psRate : m.pfuRate)

  const renter = makePortfolio()
  renter.invest(free, m.peaCap, m.overflow)

  const buyer = makePortfolio()
  const fromFree = Math.min(free, acq.downPayment)
  buyer.invest(free - fromFree, m.peaCap, m.overflow)
  let needCash = acq.downPayment - fromFree
  const gotFromPea = buyer.withdrawPea(needCash, peaTaxAt(peaAgeMonths0))
  needCash -= gotFromPea
  const shortfall = Math.max(0, needCash)
  if (shortfall > 0) buyer.livret -= shortfall

  // --- State ---
  let homeValue = acq.initialValue
  let incomeF = 1, exprF = 1, chF = 1, rentF = 1
  let deficitB = 0, deficitR = 0
  let firstB = 0, firstR = 0
  let insB = 0, insR = 0
  let minCashB = buyer.livret, minCashR = renter.livret
  const cumB = zeroCum()
  const cumR = { rent: 0, rentInsurance: 0, rentEnergy: 0 }
  const sellPct = o.sellingCostPct
  const liquidate = m.liquidateAtHorizon
  const guaranteeRefund = o.guaranteeRefundPct * acq.guarantee

  const debtAt = (idx: number): number => {
    if (idx < 0) return debtAt0
    let d = 0
    for (const l of loans) d += l.s.balance[idx]
    return d
  }
  const iraAt = (idx: number): number => {
    let ira = 0
    for (const l of loans) {
      const bal = idx < 0 ? 0 : l.s.balance[idx]
      if (bal > 0.5) ira += Math.min(0.03 * bal, (6 * bal * l.rate) / 12)
    }
    return ira
  }

  const points: YearPoint[] = []
  const snapshot = (t: number) => {
    const age = peaAgeMonths0 + t
    const ptax = peaTaxAt(age)
    const idx = t - 1
    const debt = debtAt(idx)
    const sell = liquidate ? homeValue * sellPct + o.sellingFixed : 0
    const ira = liquidate ? iraAt(idx) : 0
    const refund = liquidate || debt < 0.5 ? guaranteeRefund : 0
    const buyerAssets = buyer.netAssets(ptax, m.pfuRate)
    const renterAssets = renter.netAssets(ptax, m.pfuRate)
    const buyerNet = homeValue - sell - debt - ira + refund + buyerAssets
    const renterNet = renterAssets
    points.push({
      year: t / 12,
      buyerNet,
      renterNet,
      diff: buyerNet - renterNet,
      homeValue,
      debt,
      buyerPea: buyer.peaValue,
      buyerCto: buyer.ctoValue,
      buyerLivret: buyer.livret,
      renterPea: renter.peaValue,
      renterCto: renter.ctoValue,
      renterLivret: renter.livret,
      deficitMonthsBuyer: deficitB,
      deficitMonthsRenter: deficitR,
      firstDeficitMonthBuyer: firstB,
      firstDeficitMonthRenter: firstR,
      minCashBuyer: minCashB,
      minCashRenter: minCashR,
      sellCosts: sell,
      ira,
      refund,
      buyerTaxes: buyer.peaValue + buyer.ctoValue + buyer.livret - buyerAssets,
      renterTaxes: renter.peaValue + renter.ctoValue + renter.livret - renterAssets,
      cum: { ...cumB, ...cumR },
    })
  }
  snapshot(0)

  let y1Loan = 0, y1Running = 0, y1Rent = 0, y1SurB = 0, y1SurR = 0

  for (let idx = 0; idx < months; idx++) {
    const year = Math.floor(idx / 12)
    if (idx > 0 && idx % 12 === 0) {
      incomeF *= 1 + p.incomeGrowth
      exprF *= 1 + m.inflation
      chF *= 1 + m.chargesGrowth
      rentF *= 1 + m.rentGrowth
    }
    // Markets move.
    const pg = paths ? paths.pea[idx] : growF
    const hg = paths ? paths.home[idx] : homeF
    const growth = pg * feeF
    buyer.grow(growth, livretF)
    renter.grow(growth, livretF)
    homeValue *= hg

    // Common budget.
    const income = (p.netIncomeMonthly - p.incomeTaxMonthly) * incomeF
    const living = p.livingExpensesMonthly * exprF
    const base = income - living - creditPay[idx]

    // Renter housing.
    const rentPaid = rent.rentMonthly * rentF
    const rentIns = (rent.insuranceAnnual / 12) * chF
    const rentEn = (rent.energyAnnual / 12) * chF
    const rentTotal = rentPaid + rentIns + rentEn

    // Owner housing.
    let interest = 0, loanIns = 0, principal = 0
    for (const l of loans) {
      interest += l.s.interest[idx]
      principal += l.s.principal[idx]
      loanIns += l.s.insurance[idx]
    }
    const loanPay = interest + principal + loanIns
    const propTax = idx < o.propertyTaxExemptYears * 12 ? 0 : (o.propertyTaxAnnual / 12) * chF
    const copro = (o.coproAnnual / 12) * chF
    const ins = (o.insuranceAnnual / 12) * chF
    const energy = (o.energyAnnual / 12) * chF
    const maint = (o.maintenancePct * homeValue) / 12
    let oneOff = 0
    if (idx % 12 === 0) {
      for (const e of o.oneOffs) if (Math.round(e.year) === year + 1) oneOff += e.amount * Math.pow(1 + m.inflation, year)
    }
    const running = propTax + copro + ins + energy + maint + oneOff
    const buyTotal = loanPay + running

    const surB = base - buyTotal
    const surR = base - rentTotal
    const ptax = peaTaxAt(peaAgeMonths0 + idx + 1)
    if (surB >= 0) buyer.invest(surB, m.peaCap, m.overflow)
    else { buyer.cover(-surB, ptax, m.pfuRate); deficitB++; if (!firstB) firstB = idx + 1 }
    if (surR >= 0) renter.invest(surR, m.peaCap, m.overflow)
    else { renter.cover(-surR, ptax, m.pfuRate); deficitR++; if (!firstR) firstR = idx + 1 }
    if (buyer.livret < minCashB) minCashB = buyer.livret
    if (!insB && buyer.livret < -0.5) insB = idx + 1
    if (!insR && renter.livret < -0.5) insR = idx + 1
    if (renter.livret < minCashR) minCashR = renter.livret

    cumB.interest += interest
    cumB.loanInsurance += loanIns
    cumB.principal += principal
    cumB.propertyTax += propTax
    cumB.copro += copro
    cumB.insurance += ins
    cumB.energy += energy
    cumB.maintenance += maint
    cumB.oneOffs += oneOff
    cumR.rent += rentPaid
    cumR.rentInsurance += rentIns
    cumR.rentEnergy += rentEn

    if (idx < 12) {
      y1Loan += loanPay
      y1Running += running
      y1Rent += rentTotal
      y1SurB += surB
      y1SurR += surR
    }
    if ((idx + 1) % 12 === 0 || idx === months - 1) snapshot(idx + 1)
  }

  const n1 = Math.min(12, months)
  return {
    acquisition: acq,
    months,
    years: points,
    year1: {
      buyerHousingCash: (y1Loan + y1Running) / n1,
      rentHousingCash: y1Rent / n1,
      loanPayment: y1Loan / n1,
      runningCosts: y1Running / n1,
      surplusBuyer: y1SurB / n1,
      surplusRenter: y1SurR / n1,
    },
    downPaymentShortfall: shortfall,
    firstInsolventMonthBuyer: insB,
    firstInsolventMonthRenter: insR,
    deficitMonthsBuyer: deficitB,
    deficitMonthsRenter: deficitR,
    minCashBuyer: minCashB,
    minCashRenter: minCashR,
  }
}

/** Value of a year point in today's euros. */
export function toReal(value: number, years: number, inflation: number): number {
  return value / Math.pow(1 + inflation, years)
}

/** The snapshot at the comparison horizon (or the last one available). */
export function atHorizon(res: SimResult, horizonYears: number): YearPoint {
  const i = Math.min(res.years.length - 1, Math.max(0, Math.round(horizonYears)))
  return res.years[i]
}
