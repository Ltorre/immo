// Domain types for the buy-vs-rent simulator. All rates are fractions (0.035 = 3.5 %),
// all amounts are in euros, durations are in years unless the name says otherwise.

export type Lang = 'fr' | 'en'

/** A credit the household already repays (consumer loan, car, student...). */
export interface ExistingCredit {
  id: string
  label: string
  monthlyPayment: number
  remainingMonths: number
}

export interface ExistingPea {
  /** Current market value of the PEA. */
  value: number
  /** Total amount paid in since opening (versements): it counts against the 150 k€ ceiling. */
  deposits: number
  /** Age of the plan in years (decides the tax regime: 5 years). */
  ageYears: number
}

export interface Profile {
  /** Household net monthly income before income tax ("net avant impôt" on the payslip). */
  netIncomeMonthly: number
  /** Income tax withheld each month (prélèvement à la source). */
  incomeTaxMonthly: number
  /** Yearly raise of the net income. */
  incomeGrowth: number
  /** Everything that is not housing: food, leisure, transport, subscriptions... */
  livingExpensesMonthly: number
  /** All liquid savings (livrets, current account...). */
  savings: number
  /** Part of the savings kept as a safety net: never invested, never used for the purchase. */
  emergencyFund: number
  existingPea: ExistingPea
  credits: ExistingCredit[]
  /** Age of the (main) borrower: only used for the indicative loan-insurance hint. */
  borrowerAge: number
}

export interface RentPlan {
  /** Monthly rent, charges included. */
  rentMonthly: number
  /** Tenant home insurance per year. */
  insuranceAnnual: number
  /** Energy / water bills per year when renting. */
  energyAnnual: number
}

export interface RatePoint {
  years: number
  rate: number
}

export type OverflowVehicle = 'cto' | 'cash'

export interface Market {
  /** Expected yearly gross return of the equity ETF held in the PEA (nominal, before fees). */
  peaReturn: number
  /** Yearly all-in fees: fund TER + broker custody fees. */
  peaFees: number
  /** PEA ceiling on cumulative deposits (150 000 € for a classic PEA). */
  peaCap: number
  /** Social levies on gains (18.6 % since 2026). */
  psRate: number
  /** Flat tax on gains for an early PEA withdrawal or for a CTO (12.8 % + social levies). */
  pfuRate: number
  /** Where money goes once the PEA ceiling is reached. */
  overflow: OverflowVehicle
  /** Yearly rate of the livret (Livret A...), tax free. */
  livretRate: number
  /** Yearly nominal appreciation of the property. */
  homeAppreciation: number
  /** Yearly rent indexation. */
  rentGrowth: number
  /** General inflation (used for the "real euros" view and for the living expenses). */
  inflation: number
  /** Yearly growth of co-ownership charges, property tax, insurance and energy. */
  chargesGrowth: number
  /** Indicative mortgage rates by duration (editable). */
  rateTable: RatePoint[]
  /** Years until the comparison date. */
  horizonYears: number
  /** true: the home is sold at the horizon (selling costs paid). false: it is kept (market value counted). */
  liquidateAtHorizon: boolean
}

export interface ExtraLoan {
  id: string
  label: string
  amount: number
  rate: number
  /** Total term in years, deferral included. */
  years: number
  /** Yearly insurance as a share of the borrowed amount. */
  insurancePct: number
  /** Months during which only interest is paid (a PTZ typically defers the capital). */
  deferralMonths: number
}

export interface OneOff {
  id: string
  label: string
  /** Year of the expense (1 = during the first year). */
  year: number
  amount: number
}

export interface PropertyOption {
  id: string
  name: string
  kind: 'old' | 'new'
  /** Net seller price. */
  price: number
  /** Notary fees as a share of the price (≈ 7.5 % old, ≈ 2.5 % new). */
  notaryPct: number
  /** Agency fee paid by the buyer, as a share of the price (0 when already included in the price). */
  agencyPct: number
  /** Works done right after the purchase. */
  worksInitial: number
  /** Share of those works that is added to the property value. */
  worksValueAddedPct: number
  /** Furniture, appliances, moving. */
  movingFurnishing: number
  /** Cash brought in by the buyer. */
  downPayment: number
  // Main mortgage
  /** null = use the indicative rate table for the chosen duration. */
  rateOverride: number | null
  years: number
  /** Yearly borrower insurance as a share of the initial capital. */
  insurancePct: number
  /** Guarantee cost as a share of the main loan (Crédit Logement caution, mortgage...). */
  guaranteePct: number
  /** Share of the guarantee given back at the end (caution: ≈ 60-75 %, mortgage: 0). */
  guaranteeRefundPct: number
  /** Fixed bank and broker fees. */
  bankFees: number
  extraLoans: ExtraLoan[]
  /** Extra principal repaid every month on the main loan. */
  extraRepaymentMonthly: number
  // Running costs of owning
  coproAnnual: number
  propertyTaxAnnual: number
  /** Years without property tax (new build: 2 years used to apply). */
  propertyTaxExemptYears: number
  /** Owner home insurance per year. */
  insuranceAnnual: number
  energyAnnual: number
  /** Yearly maintenance and small works, as a share of the property value. */
  maintenancePct: number
  oneOffs: OneOff[]
  // Exit
  /** Agency fee when selling, share of the sale price. */
  sellingCostPct: number
  /** Fixed selling costs: diagnostics, lien release... */
  sellingFixed: number
}

export interface Scenario {
  profile: Profile
  rent: RentPlan
  market: Market
  option: PropertyOption
}

/** Cost of the acquisition, with the amount to borrow. */
export interface Acquisition {
  price: number
  notary: number
  agency: number
  works: number
  furnishing: number
  bankFees: number
  guarantee: number
  /** Total need = everything paid at signing. */
  totalNeed: number
  extraLoansTotal: number
  /** Down payment really needed (the requested one, clamped to what is useful). */
  downPayment: number
  mainLoan: number
  mainRate: number
  /** Property value right after the purchase (price + value added by works). */
  initialValue: number
}

/** A snapshot at the end of a year (year 0 = just after signing). */
export interface YearPoint {
  year: number
  buyerNet: number
  renterNet: number
  /** buyerNet - renterNet. Positive = buying wins. */
  diff: number
  homeValue: number
  debt: number
  buyerPea: number
  buyerCto: number
  buyerLivret: number
  renterPea: number
  renterCto: number
  renterLivret: number
  /** Costs of selling the home (agency, diagnostics) when liquidating, early-repayment penalty, guarantee refund. */
  sellCosts: number
  ira: number
  refund: number
  /** Months (up to this date) in which the household had to dip into savings, and the first such month (1-based, 0 = never). */
  deficitMonthsBuyer: number
  deficitMonthsRenter: number
  firstDeficitMonthBuyer: number
  firstDeficitMonthRenter: number
  /** Lowest cash balance seen up to this date. */
  minCashBuyer: number
  minCashRenter: number
  /** Taxes that liquidating the investment accounts would trigger. */
  buyerTaxes: number
  renterTaxes: number
  /** Cumulated housing spending to that date. */
  cum: {
    interest: number
    loanInsurance: number
    propertyTax: number
    copro: number
    insurance: number
    energy: number
    maintenance: number
    oneOffs: number
    principal: number
    rent: number
    rentInsurance: number
    rentEnergy: number
  }
}

export interface SimResult {
  acquisition: Acquisition
  months: number
  years: YearPoint[]
  /** Monthly figures of year 1. */
  year1: {
    buyerHousingCash: number
    rentHousingCash: number
    loanPayment: number
    runningCosts: number
    surplusBuyer: number
    surplusRenter: number
  }
  /** Shortfall of the down payment once savings and the PEA are used (0 when feasible). */
  downPaymentShortfall: number
  /** Number of months in which the household has to dip into savings. */
  deficitMonthsBuyer: number
  deficitMonthsRenter: number
  /** Lowest cash balance seen (negative = the household runs out of money). */
  minCashBuyer: number
  minCashRenter: number
}
