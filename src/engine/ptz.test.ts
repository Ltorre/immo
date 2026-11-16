import { describe, expect, it } from 'vitest'
import { computePtz, DEFAULT_PTZ, ptzCostCap, type PtzContext, type PtzInputs } from './ptz'

const ctx = (over: Partial<PtzContext> = {}): PtzContext => ({
  operationCost: 250_000,
  otherLoansWithoutPtz: 220_000,
  guaranteePct: 0,
  longestOtherYears: 25,
  worksShare: 0,
  ...over,
})
const inp = (over: Partial<PtzInputs> = {}): PtzInputs => ({ ...DEFAULT_PTZ, ...over })

describe('PTZ scales (April 2025)', () => {
  it('B1, 2 people, RFR 40 000: tranche 3, 40 % of the capped cost, 2 years deferral', () => {
    const r = computePtz(inp({ zone: 'B1', persons: 2, rfr: 40_000 }), 'newCollective', ctx())
    expect(r.eligible).toBe(true)
    expect(r.ceiling).toBe(51_750)
    expect(r.tranche).toBe(3) // 40 000 / 1.5 = 26 667 ∈ ]26 000 ; 30 000]
    expect(r.quotite).toBe(0.4)
    expect(r.cappedCost).toBe(202_500)
    expect(r.theoretical).toBe(81_000)
    expect(r.amount).toBe(81_000)
    expect(r.deferralYears).toBe(2)
    expect(r.totalYears).toBe(15)
  })

  it('refuses an income above the zone ceiling', () => {
    const r = computePtz(inp({ zone: 'C', persons: 1, rfr: 29_000 }), 'newCollective', ctx({ operationCost: 150_000 }))
    expect(r.eligible).toBe(false)
    expect(r.amount).toBe(0)
    expect(r.checks.find((c) => c.id === 'income')?.ok).toBe(false)
  })

  it('uses the minimum income (cost ÷ 9) when the declared income is lower', () => {
    const r = computePtz(inp({ zone: 'B1', persons: 1, rfr: 10_000 }), 'newCollective', ctx({ operationCost: 270_000 }))
    expect(r.incomeUsed).toBe(30_000)
    expect(r.tranche).toBe(3) // 30 000 / 1 ∈ ]26 000 ; 30 000] in zone B1
  })

  it('applies the lower quotité to a new house', () => {
    const house = computePtz(inp({ rfr: 20_000 }), 'newHouse', ctx())
    const coll = computePtz(inp({ rfr: 20_000 }), 'newCollective', ctx())
    expect(house.tranche).toBe(1)
    expect(house.quotite).toBe(0.3)
    expect(coll.quotite).toBe(0.5)
  })

  it('reserves existing homes to zones B2 and C with at least 25 % of works and energy class D', () => {
    const base = ctx({ worksShare: 0.3 })
    expect(computePtz(inp({ zone: 'A' }), 'existingWorks', base).eligible).toBe(false)
    expect(computePtz(inp({ zone: 'B1' }), 'existingWorks', base).checks.find((c) => c.id === 'zone')?.ok).toBe(false)
    expect(computePtz(inp({ zone: 'B2', rfr: 25_000 }), 'existingWorks', base).eligible).toBe(true)
    expect(computePtz(inp({ zone: 'B2', rfr: 25_000 }), 'existingWorks', ctx({ worksShare: 0.2 })).eligible).toBe(false)
    expect(computePtz(inp({ zone: 'B2', rfr: 25_000, dpeOk: false }), 'existingWorks', base).eligible).toBe(false)
  })

  it('requires a first-time buyer', () => {
    expect(computePtz(inp({ firstTime: false }), 'newCollective', ctx()).eligible).toBe(false)
  })

  it('never exceeds the other loans (tranche 2-4) nor 125 % of them (tranche 1)', () => {
    const small = computePtz(inp({ rfr: 20_000, persons: 2 }), 'newCollective', ctx({ otherLoansWithoutPtz: 60_000 }))
    expect(small.tranche).toBe(1)
    expect(small.limitedByOtherLoans).toBe(true)
    // with the PTZ x, the other loans are 60 000 - x; x <= 1.25 (60 000 - x)
    expect(small.amount).toBeLessThanOrEqual(1.25 * (60_000 - small.amount) + 100)
    const t4 = computePtz(inp({ zone: 'B1', persons: 2, rfr: 50_000 }), 'newCollective', ctx({ otherLoansWithoutPtz: 60_000 }))
    expect(t4.tranche).toBe(4)
    expect(t4.amount).toBeLessThanOrEqual(60_000 - t4.amount + 100)
  })

  it('shortens the repayment to the longest other loan', () => {
    const r = computePtz(inp({ rfr: 20_000 }), 'newCollective', ctx({ longestOtherYears: 10 }))
    expect(r.tranche).toBe(1)
    expect(r.repaymentYears).toBe(10)
    expect(r.totalYears).toBe(20)
  })

  it('cost caps match the printed table', () => {
    expect(ptzCostCap('A', 1)).toBe(150_000)
    expect(ptzCostCap('C', 5)).toBe(240_000)
    expect(ptzCostCap('B2', 9)).toBe(264_000)
  })
})
