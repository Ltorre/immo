import type { ExistingCredit, ExtraLoan, Market, OneOff, Profile, PropertyOption, RentPlan, Scenario } from './types'

let counter = 0
/** Small unique id for list items (credits, loans, options...). */
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/**
 * Market data snapshot, November 2026. Everything here can be edited in the UI.
 *  - Mortgage rates: broker price lists (Pretto, DB France Invest), November 2026, mid profiles.
 *  - Social levies on PEA gains 18.6 % and flat tax 31.4 %: LFSS 2026 (CSG 9.2 → 10.6 %), applied from 1 Jan 2026.
 *  - Livret A: 1.50 % since 1 Feb 2026 (reviewed every 1 Feb / 1 Aug; a rise to 1.70 % was reported for Aug 2026 but not confirmed).
 *  - HCSF: max debt ratio 35 % (insurance included), max term 25 years (27 for new builds / major works).
 */
export const MARKET_SNAPSHOT_DATE = '2026-11'

export const HCSF_MAX_DEBT_RATIO = 0.35
export const HCSF_MAX_YEARS = 25
export const HCSF_MAX_YEARS_WORKS = 27

export const DEFAULT_MARKET: Market = {
  peaReturn: 0.06,
  peaFees: 0.004,
  peaCap: 150_000,
  psRate: 0.186,
  pfuRate: 0.314,
  overflow: 'cto',
  livretRate: 0.015,
  homeAppreciation: 0.02,
  rentGrowth: 0.02,
  inflation: 0.02,
  chargesGrowth: 0.025,
  rateTable: [
    { years: 10, rate: 0.034 },
    { years: 15, rate: 0.0355 },
    { years: 20, rate: 0.0375 },
    { years: 25, rate: 0.0385 },
  ],
  horizonYears: 20,
  liquidateAtHorizon: true,
}

export const DEFAULT_PROFILE: Profile = {
  netIncomeMonthly: 4000,
  incomeTaxMonthly: 300,
  incomeGrowth: 0.02,
  livingExpensesMonthly: 1200,
  savings: 40_000,
  emergencyFund: 10_000,
  existingPea: { value: 0, deposits: 0, ageYears: 0 },
  credits: [],
  borrowerAge: 32,
}

export const DEFAULT_RENT: RentPlan = {
  rentMonthly: 1000,
  insuranceAnnual: 150,
  energyAnnual: 1200,
}

export function newCredit(): ExistingCredit {
  return { id: uid('credit'), label: '', monthlyPayment: 200, remainingMonths: 36 }
}

export type AidId = 'ptz' | 'actionLogement' | 'pel' | 'ecoPtz' | 'custom'

export interface AidTemplate {
  id: AidId
  defaults: Omit<ExtraLoan, 'id' | 'template'>
  /** Where the conditions come from. `official` = a public or institutional page. */
  source?: { url: string; official: boolean }
  /** Month the conditions were last checked. */
  checked: string
  /** `confirmed` = consistent official source; `check` = sources disagree or are secondary. */
  confidence: 'confirmed' | 'check'
}

/**
 * Loans that can be added with sensible defaults. Figures are indicative (November 2026) and must be
 * confirmed with the lender: the texts shown in the UI live in the i18n dictionaries (`aid.<id>.*`).
 */
export const AID_TEMPLATES: AidTemplate[] = [
  {
    id: 'ptz',
    defaults: { label: 'PTZ', amount: 30_000, rate: 0, years: 20, insurancePct: 0.0025, deferralMonths: 60 },
    source: { url: 'https://www.economie.gouv.fr/particuliers/emprunter-et-sassurer/pret-taux-zero-ptz-tout-ce-quil-faut-savoir', official: true },
    checked: '2026-11',
    confidence: 'check',
  },
  {
    id: 'actionLogement',
    defaults: { label: 'Action Logement', amount: 40_000, rate: 0.005, years: 25, insurancePct: 0.003, deferralMonths: 0 },
    source: { url: 'https://www.actionlogement.fr/le-pret-accession', official: true },
    checked: '2026-11',
    confidence: 'check',
  },
  {
    id: 'pel',
    defaults: { label: 'PEL', amount: 40_000, rate: 0.032, years: 15, insurancePct: 0.003, deferralMonths: 0 },
    source: { url: 'https://www.service-public.gouv.fr/particuliers/actualites/A16217?lang=fr', official: true },
    checked: '2026-11',
    confidence: 'confirmed',
  },
  {
    id: 'ecoPtz',
    defaults: { label: 'Éco-PTZ', amount: 30_000, rate: 0, years: 15, insurancePct: 0, deferralMonths: 0 },
    source: { url: 'https://finalib.fr/blog/credit-financement/eco-ptz-2026-conditions-montant-travaux', official: false },
    checked: '2026-11',
    confidence: 'check',
  },
  {
    id: 'custom',
    defaults: { label: '', amount: 20_000, rate: 0.01, years: 10, insurancePct: 0, deferralMonths: 0 },
    checked: '2026-11',
    confidence: 'confirmed',
  },
]

export function newExtraLoan(template: AidId = 'ptz'): ExtraLoan {
  const t = AID_TEMPLATES.find((x) => x.id === template) ?? AID_TEMPLATES[0]
  return { id: uid('loan'), template: t.id, ...t.defaults }
}

export function newOneOff(): OneOff {
  return { id: uid('oneoff'), label: '', year: 10, amount: 8_000 }
}

/** Typical notary fees (droits de mutation + émoluments + débours). */
export const NOTARY_PCT = { old: 0.075, new: 0.025 } as const

export function newOption(name = ''): PropertyOption {
  return {
    id: uid('opt'),
    name,
    kind: 'old',
    price: 250_000,
    notaryPct: NOTARY_PCT.old,
    agencyPct: 0,
    worksInitial: 0,
    worksValueAddedPct: 0.5,
    movingFurnishing: 2_000,
    downPayment: 30_000,
    rateOverride: null,
    years: 25,
    insurancePct: 0.003,
    guaranteePct: 0.012,
    guaranteeRefundPct: 0.6,
    bankFees: 1_500,
    extraLoans: [],
    extraRepaymentMonthly: 0,
    coproAnnual: 1_500,
    propertyTaxAnnual: 1_400,
    propertyTaxExemptYears: 0,
    insuranceAnnual: 250,
    energyAnnual: 1_200,
    maintenancePct: 0.005,
    oneOffs: [],
    sellingCostPct: 0.05,
    sellingFixed: 700,
  }
}

export function defaultScenario(): Scenario {
  return {
    profile: structuredClone(DEFAULT_PROFILE),
    rent: { ...DEFAULT_RENT },
    market: structuredClone(DEFAULT_MARKET),
    option: newOption('Appartement'),
  }
}

/**
 * Market regimes used to stress the result. Each overrides only the listed fields.
 * They are named after what happens in the markets, not "optimistic/pessimistic",
 * because a good outcome for the stock market is a bad one for the buyer, and vice versa.
 */
export interface Regime {
  id: string
  patch: Partial<Pick<Market, 'peaReturn' | 'homeAppreciation' | 'rentGrowth' | 'inflation'>>
}

export const REGIMES: Regime[] = [
  { id: 'central', patch: { peaReturn: 0.06, homeAppreciation: 0.02, rentGrowth: 0.02 } },
  { id: 'cautious', patch: { peaReturn: 0.04, homeAppreciation: 0.01, rentGrowth: 0.015 } },
  { id: 'dynamic', patch: { peaReturn: 0.08, homeAppreciation: 0.035, rentGrowth: 0.025 } },
  { id: 'homeDrop', patch: { peaReturn: 0.06, homeAppreciation: -0.01, rentGrowth: 0.02 } },
  { id: 'homeBoom', patch: { peaReturn: 0.06, homeAppreciation: 0.045, rentGrowth: 0.03 } },
  { id: 'stocksDisappoint', patch: { peaReturn: 0.025, homeAppreciation: 0.02, rentGrowth: 0.02 } },
  { id: 'stocksBoom', patch: { peaReturn: 0.09, homeAppreciation: 0.02, rentGrowth: 0.02 } },
]
