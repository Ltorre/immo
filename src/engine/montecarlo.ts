import { prepareSim, resolveMarket, runSim, toReal, type Paths } from './simulate'
import type { Scenario } from './types'

export interface McParams {
  paths: number
  /** Yearly volatility of the equity ETF. */
  peaVol: number
  /** Yearly volatility of the property price. */
  homeVol: number
  /** Correlation between the two. */
  correlation: number
  seed: number
}

export const DEFAULT_MC: McParams = { paths: 1500, peaVol: 0.16, homeVol: 0.05, correlation: 0.2, seed: 42 }

/** Small, fast, seedable PRNG (mulberry32) so results are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(rand: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    let u = 0
    while (u === 0) u = rand()
    const v = rand()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
}

export interface Band {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface McResult {
  params: McParams
  horizon: number
  /** Probability (0-1) that buying ends ahead at the horizon. */
  probBuyWins: number
  /** Distribution of the advantage of buying at the horizon (today's euros). */
  diffReal: Band
  buyerReal: Band
  renterReal: Band
  /** Advantage of buying per year (today's euros), 0..horizon. */
  fan: Band[]
  /** Histogram of the advantage at the horizon (today's euros). */
  histogram: { from: number; to: number; count: number }[]
  /** Share of paths where the household had to dip below zero cash. */
  ruinShareBuyer: number
  ruinShareRenter: number
}

function percentile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function band(values: Float64Array): Band {
  const s = Float64Array.from(values).sort()
  return {
    p10: percentile(s, 0.1),
    p25: percentile(s, 0.25),
    p50: percentile(s, 0.5),
    p75: percentile(s, 0.75),
    p90: percentile(s, 0.9),
  }
}

/** Random monthly growth factors whose arithmetic yearly mean equals the chosen return. */
export function randomPaths(sc: Scenario, months: number, mc: McParams, rand: () => number): Paths {
  const z = normal(rand)
  const pea = new Float64Array(months)
  const home = new Float64Array(months)
  const mu1 = Math.log(1 + sc.market.peaReturn) - (mc.peaVol * mc.peaVol) / 2
  const mu2 = Math.log(1 + sc.market.homeAppreciation) - (mc.homeVol * mc.homeVol) / 2
  const s1 = mc.peaVol / Math.sqrt(12)
  const s2 = mc.homeVol / Math.sqrt(12)
  const rho = Math.min(Math.max(mc.correlation, -0.99), 0.99)
  const c = Math.sqrt(1 - rho * rho)
  for (let t = 0; t < months; t++) {
    const a = z()
    const b = rho * a + c * z()
    pea[t] = Math.exp(mu1 / 12 + s1 * a)
    home[t] = Math.exp(mu2 / 12 + s2 * b)
  }
  return { pea, home }
}

export function monteCarlo(sc: Scenario, mc: McParams = DEFAULT_MC): McResult {
  const horizon = Math.max(1, Math.round(sc.market.horizonYears))
  const months = horizon * 12
  const prep = prepareSim(sc, months)
  const rand = rng(mc.seed)
  // Without a PEA the investment earns a known rate: only the property price is random.
  const noPea = sc.market.vehicle === 'savings'
  const rsc: Scenario = noPea ? { ...sc, market: resolveMarket(sc.market) } : sc
  const mcEff: McParams = noPea ? { ...mc, peaVol: 0 } : mc
  const n = mc.paths
  const infl = sc.market.inflation
  const fanVals: Float64Array[] = Array.from({ length: horizon + 1 }, () => new Float64Array(n))
  const diffs = new Float64Array(n)
  const buyers = new Float64Array(n)
  const renters = new Float64Array(n)
  let wins = 0
  let ruinB = 0
  let ruinR = 0
  for (let i = 0; i < n; i++) {
    const paths = randomPaths(rsc, months, mcEff, rand)
    const res = runSim(prep, paths)
    for (let y = 0; y <= horizon; y++) fanVals[y][i] = toReal(res.years[y].diff, y, infl)
    const end = res.years[horizon]
    diffs[i] = toReal(end.diff, horizon, infl)
    buyers[i] = toReal(end.buyerNet, horizon, infl)
    renters[i] = toReal(end.renterNet, horizon, infl)
    if (end.diff >= 0) wins++
    if (res.minCashBuyer < 0) ruinB++
    if (res.minCashRenter < 0) ruinR++
  }
  const sorted = Float64Array.from(diffs).sort()
  const lo = percentile(sorted, 0.02)
  const hi = percentile(sorted, 0.98)
  const bins = 30
  const width = (hi - lo) / bins || 1
  const histogram = Array.from({ length: bins }, (_, k) => ({ from: lo + k * width, to: lo + (k + 1) * width, count: 0 }))
  for (const d of diffs) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor((d - lo) / width)))
    histogram[k].count++
  }
  return {
    params: mc,
    horizon,
    probBuyWins: wins / n,
    diffReal: band(diffs),
    buyerReal: band(buyers),
    renterReal: band(renters),
    fan: fanVals.map(band),
    histogram,
    ruinShareBuyer: ruinB / n,
    ruinShareRenter: ruinR / n,
  }
}
