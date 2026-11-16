import { describe, expect, it } from 'vitest'
import { annuity, buildSchedule, rateForYears, totalCost } from './loan'
import { defaultScenario, newOption } from './defaults'
import { atHorizon, computeAcquisition, simulate } from './simulate'
import type { Scenario } from './types'

/** A scenario where every rate, fee and tax is zero so the books can be balanced by hand. */
function flat(): Scenario {
  const sc = defaultScenario()
  sc.market = {
    ...sc.market,
    peaReturn: 0, peaFees: 0, livretRate: 0, homeAppreciation: 0, rentGrowth: 0, inflation: 0, chargesGrowth: 0,
    psRate: 0, pfuRate: 0, liquidateAtHorizon: false, horizonYears: 10,
  }
  sc.profile.incomeGrowth = 0
  sc.rent.equivalentYield = null // fixed rent: the books are balanced by hand
  sc.option = { ...newOption('flat'), rateOverride: 0.03, years: 20, maintenancePct: 0, guaranteeRefundPct: 0 }
  return sc
}

describe('loan maths', () => {
  it('matches the known payment of 200 000 € at 3.5 % over 20 years', () => {
    expect(annuity(200_000, 0.035, 240)).toBeCloseTo(1159.92, 2)
  })

  it('amortises to exactly zero and costs payment × n − capital in interest', () => {
    const s = buildSchedule({ amount: 180_000, annualRate: 0.0385, years: 25, insurancePct: 0 }, 300)
    const principal = s.principal.reduce((a, b) => a + b, 0)
    const interest = s.interest.reduce((a, b) => a + b, 0)
    expect(principal).toBeCloseTo(180_000, 4)
    expect(interest).toBeCloseTo(s.payment * 300 - 180_000, 2)
    expect(s.balance[299]).toBeCloseTo(0, 4)
  })

  it('shortens the loan with extra repayments', () => {
    const s = buildSchedule({ amount: 180_000, annualRate: 0.035, years: 25, insurancePct: 0.003, extraMonthly: 300 }, 300)
    expect(s.endMonth).toBeLessThan(300)
    expect(s.principal.reduce((a, b) => a + b, 0)).toBeCloseTo(180_000, 4)
  })

  it('pays only interest during a deferral', () => {
    const s = buildSchedule({ amount: 30_000, annualRate: 0, years: 20, insurancePct: 0, deferralMonths: 60 }, 240)
    expect(s.principal[0]).toBe(0)
    expect(s.principal[60]).toBeCloseTo(30_000 / 180, 6)
    expect(s.principal.reduce((a, b) => a + b, 0)).toBeCloseTo(30_000, 4)
  })

  it('computes insurance on the initial capital', () => {
    const s = buildSchedule({ amount: 100_000, annualRate: 0.03, years: 10, insurancePct: 0.003 }, 120)
    expect(s.insurance[0]).toBeCloseTo(25, 6)
    expect(totalCost(s)).toBeGreaterThan(s.interest.reduce((a, b) => a + b, 0))
  })

  it('interpolates the rate table and clamps at both ends', () => {
    const t = [{ years: 10, rate: 0.03 }, { years: 20, rate: 0.04 }]
    expect(rateForYears(t, 15)).toBeCloseTo(0.035, 10)
    expect(rateForYears(t, 5)).toBe(0.03)
    expect(rateForYears(t, 30)).toBe(0.04)
  })
})

describe('acquisition', () => {
  it('balances: down payment + loans = costs + guarantee', () => {
    const sc = defaultScenario()
    sc.option.extraLoans = [{ id: 'a', label: 'PTZ', amount: 20_000, rate: 0, years: 20, insurancePct: 0, deferralMonths: 0 }]
    sc.option.worksInitial = 15_000
    const a = computeAcquisition(sc.option, sc.market)
    expect(a.downPayment + a.extraLoansTotal + a.mainLoan).toBeCloseTo(a.totalNeed, 6)
    expect(a.guarantee).toBeCloseTo(sc.option.guaranteePct * a.mainLoan, 6)
    expect(a.initialValue).toBe(250_000 + 15_000 * 0.5)
  })

  it('never borrows a negative amount when the down payment exceeds the need', () => {
    const sc = defaultScenario()
    sc.option.downPayment = 10_000_000
    const a = computeAcquisition(sc.option, sc.market)
    expect(a.mainLoan).toBe(0)
    expect(a.downPayment).toBeCloseTo(a.totalNeed, 6)
  })
})

describe('simulation books', () => {
  it('renter net worth = savings + cumulated surplus when nothing earns anything', () => {
    const sc = flat()
    const res = simulate(sc)
    const p = sc.profile
    const monthlySurplus = p.netIncomeMonthly - p.incomeTaxMonthly - p.livingExpensesMonthly
      - sc.rent.rentMonthly - (sc.rent.insuranceAnnual + sc.rent.energyAnnual) / 12
    const end = atHorizon(res, 10)
    expect(end.renterNet).toBeCloseTo(p.savings + 120 * monthlySurplus, 4)
  })

  it('buyer books balance (conservation of money) with zero returns', () => {
    const sc = flat()
    sc.option.oneOffs = [{ id: 'x', label: 'roof', year: 3, amount: 9_000 }]
    sc.option.propertyTaxExemptYears = 2
    const res = simulate(sc)
    const a = res.acquisition
    const end = atHorizon(res, 10)
    const p = sc.profile
    const base = 120 * (p.netIncomeMonthly - p.incomeTaxMonthly - p.livingExpensesMonthly)
    const c = end.cum
    const spent = c.interest + c.loanInsurance + c.principal + c.propertyTax + c.copro + c.insurance
      + c.energy + c.maintenance + c.oneOffs
    const debt0 = a.mainLoan + a.extraLoansTotal
    const expected = a.initialValue + (p.savings - a.downPayment) + base - spent - (debt0 - c.principal)
    expect(end.buyerNet).toBeCloseTo(expected, 3)
    expect(c.oneOffs).toBeCloseTo(9_000, 6)
    expect(c.propertyTax).toBeCloseTo(sc.option.propertyTaxAnnual * 8, 6)
  })

  it('right after signing, the buyer is poorer by the acquisition costs only when liquidating', () => {
    const sc = flat()
    sc.market.liquidateAtHorizon = true
    sc.option.sellingCostPct = 0.05
    sc.option.sellingFixed = 0
    const res = simulate(sc)
    const y0 = res.years[0]
    expect(y0.renterNet).toBeCloseTo(sc.profile.savings, 6)
    // value - selling costs - debt + leftover cash
    const a = res.acquisition
    const expected = a.initialValue * 0.95 - (a.mainLoan + a.extraLoansTotal) + (sc.profile.savings - a.downPayment)
    expect(y0.buyerNet).toBeCloseTo(expected, 4)
  })

  it('a higher appreciation helps the buyer, a higher rent helps the buyer, a higher PEA return helps the renter', () => {
    const base = defaultScenario()
    base.rent.equivalentYield = null; base.rent.rentMonthly = 1000
    const d = (s: Scenario) => atHorizon(simulate(s), s.market.horizonYears).diff
    const ref = d(base)
    const a = structuredClone(base); a.market.homeAppreciation += 0.02
    const r = structuredClone(base); r.rent.equivalentYield = null; r.rent.rentMonthly = 1300
    const e = structuredClone(base); e.market.peaReturn += 0.02
    expect(d(a)).toBeGreaterThan(ref)
    expect(d(r)).toBeGreaterThan(ref)
    expect(d(e)).toBeLessThan(ref)
  })
})

describe('PEA rules', () => {
  it('sends money above the ceiling to the overflow account', () => {
    const sc = flat()
    sc.profile.savings = 200_000
    sc.profile.emergencyFund = 0
    sc.market.peaCap = 150_000
    const res = simulate(sc)
    expect(res.years[0].renterPea).toBeCloseTo(150_000, 6)
    expect(res.years[0].renterCto).toBeCloseTo(50_000, 6)
  })

  it('keeps the overflow as cash on request', () => {
    const sc = flat()
    sc.profile.savings = 200_000
    sc.profile.emergencyFund = 0
    sc.market.overflow = 'cash'
    const res = simulate(sc)
    expect(res.years[0].renterCto).toBe(0)
    expect(res.years[0].renterLivret).toBeCloseTo(50_000, 6)
  })

  it('taxes only the gains: 5+ years → social levies, early → flat tax', () => {
    const sc = flat()
    sc.market.psRate = 0.186
    sc.market.pfuRate = 0.314
    sc.market.peaReturn = 0.05
    sc.profile.savings = 100_000
    sc.profile.emergencyFund = 0
    sc.profile.netIncomeMonthly = 3200
    sc.profile.livingExpensesMonthly = 3000 // nothing left to invest
    sc.profile.incomeTaxMonthly = 200
    sc.rent.equivalentYield = null
    sc.rent.rentMonthly = 0
    sc.rent.insuranceAnnual = 0
    sc.rent.energyAnnual = 0
    const res = simulate(sc)
    const at10 = res.years[10]
    const gain = at10.renterPea - 100_000
    expect(at10.renterNet).toBeCloseTo(at10.renterPea - gain * 0.186, 3)
    const at2 = res.years[2]
    expect(at2.renterNet).toBeCloseTo(at2.renterPea - (at2.renterPea - 100_000) * 0.314, 3)
  })

  it('flags a down payment the household cannot fund', () => {
    const sc = defaultScenario()
    sc.profile.savings = 20_000
    sc.profile.emergencyFund = 10_000
    sc.option.downPayment = 60_000
    const res = simulate(sc)
    expect(res.downPaymentShortfall).toBeCloseTo(50_000, 3)
  })

  it('draws the down payment from an existing PEA, net of tax', () => {
    const sc = flat()
    sc.market.psRate = 0.2
    sc.profile.savings = 10_000
    sc.profile.emergencyFund = 10_000
    sc.profile.existingPea = { value: 60_000, deposits: 40_000, ageYears: 6 }
    sc.option.downPayment = 30_000
    const res = simulate(sc)
    expect(res.downPaymentShortfall).toBe(0)
    // gain share 1/3, tax 20 % → net/gross = 1 - 0.2/3
    const gross = 30_000 / (1 - 0.2 / 3)
    expect(res.years[0].buyerPea).toBeCloseTo(60_000 - gross, 3)
  })
})

describe('deficit warnings', () => {
  it('only count months up to the comparison date, not the whole 40-year run', () => {
    const sc = defaultScenario()
    sc.profile.netIncomeMonthly = 5300
    sc.profile.incomeTaxMonthly = 350
    sc.profile.incomeGrowth = 0 // flat pay while spending follows inflation
    sc.profile.livingExpensesMonthly = 1500
    sc.rent.equivalentYield = null
    sc.rent.rentMonthly = 1640
    sc.market.rentGrowth = 0.015
    const res = simulate(sc, { months: 480 })
    expect(res.deficitMonthsRenter).toBeGreaterThan(0) // the whole run does run dry eventually
    const at20 = atHorizon(res, 20)
    expect(at20.deficitMonthsRenter).toBe(0) // but not within a 20-year comparison
    const last = res.years[res.years.length - 1]
    expect(last.deficitMonthsRenter).toBe(res.deficitMonthsRenter)
    expect(Math.floor((last.firstDeficitMonthRenter - 1) / 12) + 1).toBeGreaterThan(20)
  })
})

describe('insolvency cut', () => {
  it('stops the comparison before the household runs out of savings', async () => {
    const { cutScenario } = await import('./analysis')
    const sc = defaultScenario()
    Object.assign(sc.profile, { netIncomeMonthly: 5300, incomeTaxMonthly: 350, incomeGrowth: 0.01, livingExpensesMonthly: 2800, savings: 76000, emergencyFund: 25000, existingPea: { value: 8790, deposits: 7200, ageYears: 2 } })
    Object.assign(sc.option, { price: 335000, downPayment: 40000, years: 25, rateOverride: 0.0385 })
    Object.assign(sc.rent, { equivalentYield: null, rentMonthly: 1640, insuranceAnnual: 280, energyAnnual: 1200 })
    Object.assign(sc.market, { peaReturn: 0.04, homeAppreciation: 0.01, rentGrowth: 0.015, horizonYears: 20 })
    const { sc: cutSc, cut } = cutScenario(sc)
    expect(cut).not.toBeNull()
    expect(cut!.who).toBe('buy')
    expect(cut!.effective).toBeLessThan(20)
    expect(cutSc.market.horizonYears).toBe(cut!.effective)
    // within the cut horizon nobody is overdrawn
    const res = simulate(cutSc)
    expect(res.minCashBuyer).toBeGreaterThanOrEqual(-0.5)
    expect(res.minCashRenter).toBeGreaterThanOrEqual(-0.5)
  })

  it('leaves a viable scenario untouched', async () => {
    const { cutScenario } = await import('./analysis')
    const { cut } = cutScenario(defaultScenario())
    expect(cut).toBeNull()
  })
})

describe('rent tied to the price', () => {
  it('follows the price of the home when an equivalent yield is set', () => {
    const a = defaultScenario(); a.rent.equivalentYield = 0.048; a.option.price = 250_000
    const b = structuredClone(a); b.option.price = 500_000
    const ra = simulate(a), rb = simulate(b)
    // 250 000 × 4.8 % / 12 = 1 000 € rent (+ insurance and energy), twice that for twice the price
    expect(ra.year1.rentHousingCash).toBeCloseTo(1000 + (a.rent.insuranceAnnual + a.rent.energyAnnual) / 12, 6)
    expect(rb.year1.rentHousingCash).toBeCloseTo(2000 + (b.rent.insuranceAnnual + b.rent.energyAnnual) / 12, 6)
  })

  it('keeps the fixed rent when no yield is set', () => {
    const a = defaultScenario(); a.rent.equivalentYield = null; a.rent.rentMonthly = 1640; a.option.price = 150_000
    expect(simulate(a).year1.rentHousingCash).toBeCloseTo(1640 + (a.rent.insuranceAnnual + a.rent.energyAnnual) / 12, 6)
  })
})

describe('no PEA: savings account', () => {
  /** No flows at all: income exactly covers spending and rent, so only the interest moves the capital. */
  function idle(): Scenario {
    const sc = flat()
    sc.profile.savings = 100_000
    sc.profile.emergencyFund = 0
    sc.profile.netIncomeMonthly = 3000
    sc.profile.incomeTaxMonthly = 0
    sc.profile.livingExpensesMonthly = 3000
    sc.rent.rentMonthly = 0
    sc.rent.insuranceAnnual = 0
    sc.rent.energyAnnual = 0
    sc.market.psRate = 0.186
    sc.market.pfuRate = 0.314
    sc.market.vehicle = 'savings'
    return sc
  }

  it('a current account earns nothing: capital is unchanged', () => {
    const sc = idle(); sc.market.savingsKind = 'current'; sc.market.savingsGross = 0.05
    const end = atHorizon(simulate(sc), 10)
    expect(end.renterNet).toBeCloseTo(100_000, 4)
  })

  it('flat tax: interest is taxed every year at 31.4 %', () => {
    const sc = idle(); Object.assign(sc.market, { savingsKind: 'remunerated', savingsGross: 0.04, savingsTax: 'pfu' })
    const end = atHorizon(simulate(sc), 10)
    expect(end.renterNet).toBeCloseTo(100_000 * Math.pow(1 + 0.04 * (1 - 0.314), 10), 2)
  })

  it('progressive scale: marginal rate on interest net of the deductible CSG, plus social levies', () => {
    const sc = idle(); Object.assign(sc.market, { savingsKind: 'remunerated', savingsGross: 0.04, savingsTax: 'bareme', marginalRate: 0.3 })
    const tax = 0.186 + 0.3 * (1 - 0.068)
    const end = atHorizon(simulate(sc), 10)
    expect(end.renterNet).toBeCloseTo(100_000 * Math.pow(1 + 0.04 * (1 - tax), 10), 2)
    // a 0 % bracket only pays the social levies
    sc.market.marginalRate = 0
    expect(atHorizon(simulate(sc), 10).renterNet).toBeCloseTo(100_000 * Math.pow(1 + 0.04 * (1 - 0.186), 10), 2)
  })

  it('exempt savings (regulated) pay no tax', () => {
    const sc = idle(); Object.assign(sc.market, { savingsKind: 'remunerated', savingsGross: 0.03, savingsTax: 'none' })
    expect(atHorizon(simulate(sc), 10).renterNet).toBeCloseTo(100_000 * Math.pow(1.03, 10), 2)
  })

  it('has no PEA ceiling and ignores an existing PEA', () => {
    const sc = idle(); Object.assign(sc.market, { savingsKind: 'current' })
    sc.profile.savings = 400_000
    sc.profile.existingPea = { value: 50_000, deposits: 40_000, ageYears: 8 }
    const r = simulate(sc)
    expect(r.years[0].renterPea).toBe(0)
    expect(atHorizon(r, 5).renterNet).toBeCloseTo(400_000, 3)
  })

  it('the buyer books still balance in savings mode', () => {
    const sc = flat(); sc.market.vehicle = 'savings'; sc.market.savingsKind = 'current'
    const res = simulate(sc); const a = res.acquisition; const end = atHorizon(res, 10); const p = sc.profile
    const c = end.cum
    const spent = c.interest + c.loanInsurance + c.principal + c.propertyTax + c.copro + c.insurance + c.energy + c.maintenance + c.oneOffs
    const expected = a.initialValue + (p.savings - a.downPayment) + 120 * (p.netIncomeMonthly - p.incomeTaxMonthly - p.livingExpensesMonthly) - spent - (a.mainLoan + a.extraLoansTotal - c.principal)
    expect(end.buyerNet).toBeCloseTo(expected, 3)
  })

  it('is idempotent: resolving an already resolved market changes nothing', async () => {
    const { resolveMarket } = await import('./simulate')
    const m = idle().market
    const once = resolveMarket(m)
    expect(resolveMarket(once)).toEqual(once)
  })
})
