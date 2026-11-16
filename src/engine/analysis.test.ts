import { describe, expect, it } from 'vitest'
import {
  borrowingCapacity, breakEvenAppreciation, breakEvenPeaReturn, breakEvenRent, breakEvenYear, debtCheck,
  diffAt, downPaymentSweep, durationHorizonGrid, returnsHeatmap, simulateLong,
} from './analysis'
import { defaultScenario } from './defaults'
import { monteCarlo } from './montecarlo'
import { atHorizon, simulate, toReal } from './simulate'

describe('break-even solvers', () => {
  it('appreciation: the buyer and the renter end equal at the solved value', () => {
    const sc = defaultScenario()
    const r = breakEvenAppreciation(sc)
    expect(r.status).toBe('ok')
    sc.market.homeAppreciation = r.value!
    expect(Math.abs(diffAt(sc))).toBeLessThan(5)
  })

  it('rent: equal at the solved rent', () => {
    const sc = defaultScenario()
    const r = breakEvenRent(sc)
    expect(r.status).toBe('ok')
    sc.rent.equivalentYield = null
    sc.rent.rentMonthly = r.value!
    expect(Math.abs(diffAt(sc))).toBeLessThan(5)
  })

  it('PEA return: equal at the solved return', () => {
    const sc = defaultScenario()
    const r = breakEvenPeaReturn(sc)
    expect(r.status).toBe('ok')
    sc.market.peaReturn = r.value!
    expect(Math.abs(diffAt(sc))).toBeLessThan(5)
  })

  it('reports never when the property can not win', () => {
    const sc = defaultScenario()
    sc.rent.rentMonthly = 200
    expect(breakEvenAppreciation(sc).status).not.toBe('always')
  })

  it('break-even year is consistent with the series', () => {
    const sc = defaultScenario()
    const res = simulateLong(sc)
    const be = breakEvenYear(res)
    if (be !== null) {
      const i = Math.ceil(be)
      expect(res.years[Math.min(i, res.years.length - 1)].diff).toBeGreaterThanOrEqual(-1)
      if (i > 0) expect(res.years[i - 1].diff).toBeLessThan(res.years[i].diff)
    }
  })
})

describe('sweeps', () => {
  it('grid cell equals a direct simulation', () => {
    const sc = defaultScenario()
    const cells = durationHorizonGrid(sc, [20], [15])
    const direct = defaultScenario()
    direct.option.years = 20
    direct.market.horizonYears = 15
    expect(cells[0].diff).toBeCloseTo(diffAt(direct), 4)
  })

  it('heatmap: more appreciation helps the buyer along a row, more PEA return hurts down a column', () => {
    const h = returnsHeatmap(defaultScenario(), [0, 0.02, 0.04], [0.03, 0.06])
    expect(h[0][2]).toBeGreaterThan(h[0][0])
    expect(h[1][0]).toBeLessThan(h[0][0])
  })

  it('down payment sweep returns coherent loans', () => {
    const rows = downPaymentSweep(defaultScenario(), [0.1, 0.2])
    expect(rows[0].loan).toBeGreaterThan(rows[1].loan)
  })
})

describe('bank checks', () => {
  it('applies the 35 % rule with existing credits', () => {
    const sc = defaultScenario()
    sc.profile.netIncomeMonthly = 4000
    sc.profile.credits = [{ id: 'a', label: 'car', monthlyPayment: 300, remainingMonths: 20 }]
    const dc = debtCheck(sc)
    expect(dc.existingPayments).toBe(300)
    expect(dc.maxNewPayment).toBeCloseTo(0.35 * 4000 - 300, 6)
    expect(dc.ratio).toBeCloseTo((300 + dc.newPayment) / 4000, 8)
  })

  it('max loan reproduces the max payment', () => {
    const sc = defaultScenario()
    const cap = borrowingCapacity(sc, 25, 30_000)
    expect(cap.maxLoan).toBeGreaterThan(0)
    // taking the max price back through the option gives a ratio at the limit
    sc.option.price = cap.maxPrice
    sc.option.downPayment = 30_000
    const dc = debtCheck(sc)
    expect(dc.ratio).toBeCloseTo(0.35, 2)
  })
})

describe('monte carlo', () => {
  it('with no volatility it reproduces the deterministic run', () => {
    const sc = defaultScenario()
    const mc = monteCarlo(sc, { paths: 20, peaVol: 0, homeVol: 0, correlation: 0, seed: 1 })
    const det = atHorizon(simulate(sc), sc.market.horizonYears)
    const real = toReal(det.diff, sc.market.horizonYears, sc.market.inflation)
    expect(mc.diffReal.p50).toBeCloseTo(real, 3)
    expect(mc.diffReal.p10).toBeCloseTo(mc.diffReal.p90, 3)
  })

  it('is reproducible and bounded', () => {
    const sc = defaultScenario()
    const a = monteCarlo(sc, { paths: 200, peaVol: 0.16, homeVol: 0.05, correlation: 0.2, seed: 7 })
    const b = monteCarlo(sc, { paths: 200, peaVol: 0.16, homeVol: 0.05, correlation: 0.2, seed: 7 })
    expect(a.probBuyWins).toBe(b.probBuyWins)
    expect(a.probBuyWins).toBeGreaterThanOrEqual(0)
    expect(a.probBuyWins).toBeLessThanOrEqual(1)
    expect(a.diffReal.p10).toBeLessThan(a.diffReal.p90)
    expect(a.histogram.reduce((s, h) => s + h.count, 0)).toBe(200)
  })

  it('runs fast enough for the browser', () => {
    const sc = defaultScenario()
    const t0 = performance.now()
    monteCarlo(sc, { paths: 1500, peaVol: 0.16, homeVol: 0.05, correlation: 0.2, seed: 3 })
    const t1 = performance.now()
    returnsHeatmap(sc, [0, 0.01, 0.02, 0.03, 0.04, 0.05], [0.02, 0.04, 0.06, 0.08, 0.1, 0.12])
    const t2 = performance.now()
    breakEvenAppreciation(sc)
    const t3 = performance.now()
    console.log(`MC1500=${(t1 - t0).toFixed(0)}ms heatmap36=${(t2 - t1).toFixed(0)}ms breakEven=${(t3 - t2).toFixed(0)}ms`)
    expect(t1 - t0).toBeLessThan(5000)
  })
})
