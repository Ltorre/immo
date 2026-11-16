import type { PropertyOption } from './types'

/**
 * PTZ (prêt à taux zéro) eligibility and amount, for offers issued from 1 April 2025.
 * Scales: ANIL "PTZ, offres à compter du 1er avril 2025" and service-public.gouv.fr (pages checked 15 Sept 2026),
 * which agree on ceilings, tranches, cost caps and quotités. The deferral/duration per tranche comes from the
 * ANIL table (CCH D.31-10-11) only. The scheme's end date (31 Dec 2027) is reported by secondary sources.
 */

/** Zones A bis and A share the same figures. */
export type PtzZone = 'A' | 'B1' | 'B2' | 'C'
export type PtzKind = 'newCollective' | 'newHouse' | 'existingWorks'

export interface PtzInputs {
  zone: PtzZone
  /** People who will live in the home (1 to 8+). */
  persons: number
  /** Sum of the revenus fiscaux de référence of the occupants, year N-2. */
  rfr: number
  /** For a new home: collective building (more than 2 superposed dwellings) or other (house). */
  newKind: 'collective' | 'house'
  /** Borrower(s) not owner of their main residence in the last 2 years (or one of the legal exceptions applies). */
  firstTime: boolean
  /** Existing home: energy class D or better, before or after the works. */
  dpeOk: boolean
}

export const DEFAULT_PTZ: PtzInputs = { zone: 'B1', persons: 2, rfr: 43_000, newKind: 'collective', firstTime: true, dpeOk: true }

const ZONES: PtzZone[] = ['A', 'B1', 'B2', 'C']

/** Coefficient familial for 1..8+ people. */
const COEF = [1, 1.5, 1.8, 2.1, 2.4, 2.7, 3, 3.3]

/** Income ceilings (RFR) by zone, for 1..8+ people. */
const CEILING: Record<PtzZone, number[]> = {
  A: [49_000, 73_500, 88_200, 102_900, 117_600, 132_300, 147_000, 161_700],
  B1: [34_500, 51_750, 62_100, 72_450, 82_800, 93_150, 103_500, 113_850],
  B2: [31_500, 47_250, 56_700, 66_150, 75_600, 85_050, 94_500, 103_950],
  C: [28_500, 42_750, 51_300, 59_850, 68_400, 76_950, 85_500, 94_050],
}

/** Upper bound of tranches 1 to 4 for income ÷ coefficient familial. */
const TRANCHE: Record<PtzZone, number[]> = {
  A: [25_000, 31_000, 37_000, 49_000],
  B1: [21_500, 26_000, 30_000, 34_500],
  B2: [18_000, 22_500, 27_000, 31_500],
  C: [15_000, 19_500, 24_000, 28_500],
}

/** Operation cost caps for 1..5+ people. */
const COST_CAP: Record<PtzZone, number[]> = {
  A: [150_000, 225_000, 270_000, 315_000, 360_000],
  B1: [135_000, 202_500, 243_000, 283_500, 324_000],
  B2: [110_000, 165_000, 198_000, 231_000, 264_000],
  C: [100_000, 150_000, 180_000, 210_000, 240_000],
}

/** Share of the capped cost financed, by tranche. */
const QUOTITE = {
  general: [0.5, 0.4, 0.4, 0.2],
  newHouse: [0.3, 0.2, 0.2, 0.1],
}

/** Deferral and repayment periods in years, by tranche. */
const TERMS = [
  { deferral: 10, repayment: 15 },
  { deferral: 8, repayment: 12 },
  { deferral: 2, repayment: 13 },
  { deferral: 0, repayment: 10 },
]

export const PTZ_ZONES = ZONES

export interface PtzContext {
  /** Purchase price + works (+ agency fee paid by the buyer); notary fees and furniture are excluded. */
  operationCost: number
  /** Other loans (main + other extra loans, PTZ excluded) as they would be without the PTZ. */
  otherLoansWithoutPtz: number
  guaranteePct: number
  /** Longest term among the other loans, in years. */
  longestOtherYears: number
  /** Works as a share of the total operation cost (existing homes). */
  worksShare: number
}

export type PtzCheckId = 'firstTime' | 'zone' | 'income' | 'works' | 'dpe'

export interface PtzResult {
  kind: PtzKind
  eligible: boolean
  checks: { id: PtzCheckId; ok: boolean }[]
  /** Income used: the higher of the RFR and operation cost ÷ 9. */
  incomeUsed: number
  ceiling: number
  coefficient: number
  tranche: 1 | 2 | 3 | 4 | null
  quotite: number
  cappedCost: number
  /** quotité × capped cost. */
  theoretical: number
  amount: number
  limitedByOtherLoans: boolean
  deferralYears: number
  repaymentYears: number
  totalYears: number
}

export function ptzKind(option: PropertyOption, input: PtzInputs): PtzKind {
  if (option.kind === 'old') return 'existingWorks'
  return input.newKind === 'house' ? 'newHouse' : 'newCollective'
}

export function ptzCostCap(zone: PtzZone, persons: number): number {
  return COST_CAP[zone][Math.min(5, Math.max(1, Math.round(persons))) - 1]
}

export function computePtz(input: PtzInputs, kind: PtzKind, ctx: PtzContext): PtzResult {
  const persons = Math.min(8, Math.max(1, Math.round(input.persons)))
  const coefficient = COEF[persons - 1]
  const ceiling = CEILING[input.zone][persons - 1]
  const incomeUsed = Math.max(input.rfr, ctx.operationCost / 9)

  const checks: PtzResult['checks'] = [{ id: 'firstTime', ok: input.firstTime }]
  const zoneOk = kind !== 'existingWorks' || input.zone === 'B2' || input.zone === 'C'
  checks.push({ id: 'zone', ok: zoneOk })
  const incomeOk = incomeUsed <= ceiling
  checks.push({ id: 'income', ok: incomeOk })
  if (kind === 'existingWorks') {
    checks.push({ id: 'works', ok: ctx.worksShare >= 0.25 })
    checks.push({ id: 'dpe', ok: input.dpeOk })
  }
  const eligible = checks.every((c) => c.ok)

  // Tranche: income ÷ coefficient against the zone thresholds.
  const perUnit = incomeUsed / coefficient
  let tranche: PtzResult['tranche'] = null
  if (incomeOk) {
    const idx = TRANCHE[input.zone].findIndex((limit) => perUnit <= limit)
    tranche = (idx === -1 ? 4 : idx + 1) as 1 | 2 | 3 | 4
  }

  const t = tranche ?? 4
  const quotite = (kind === 'newHouse' ? QUOTITE.newHouse : QUOTITE.general)[t - 1]
  const cappedCost = Math.min(ctx.operationCost, ptzCostCap(input.zone, persons))
  const theoretical = quotite * cappedCost

  // The PTZ cannot exceed the other loans (by more than 25 % in tranche 1). The other loans shrink as the PTZ grows
  // (the main loan is what is left to finance), hence the closed form x ≤ f·(O) / (1 + f/(1-g)).
  const f = t === 1 ? 1.25 : 1
  const g = Math.min(Math.max(ctx.guaranteePct, 0), 0.5)
  const limit = (f * ctx.otherLoansWithoutPtz) / (1 + f / (1 - g))
  const capped = Math.max(0, Math.min(theoretical, limit))
  const amount = eligible ? Math.round(capped / 100) * 100 : 0

  const terms = TERMS[t - 1]
  const repaymentYears = Math.max(1, Math.min(terms.repayment, Math.round(ctx.longestOtherYears)))
  return {
    kind,
    eligible,
    checks,
    incomeUsed,
    ceiling,
    coefficient,
    tranche,
    quotite,
    cappedCost,
    theoretical,
    amount,
    limitedByOtherLoans: eligible && limit < theoretical,
    deferralYears: terms.deferral,
    repaymentYears,
    totalYears: terms.deferral + repaymentYears,
  }
}
