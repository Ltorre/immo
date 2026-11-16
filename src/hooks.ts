import { useDeferredValue, useMemo } from 'react'
import { breakEvenAppreciation, breakEvenPeaReturn, breakEvenRent, breakEvenYear, debtCheck, simulateLong } from './engine/analysis'
import { atHorizon, toReal } from './engine/simulate'
import { useApp } from './state'

/** Main simulation (40 years) for the selected property, kept responsive while the user types. */
export function useMain() {
  const { scenario, state } = useApp()
  const sc = useDeferredValue(scenario)
  const res = useMemo(() => simulateLong(sc), [sc])
  const horizon = Math.max(1, Math.round(sc.market.horizonYears))
  const pt = atHorizon(res, horizon)
  const dc = useMemo(() => debtCheck(sc), [sc])
  /** Convert a nominal amount at `years` into the displayed unit (today's euros or nominal). */
  const adj = (v: number, years: number) => (state.real ? toReal(v, years, sc.market.inflation) : v)
  return { sc, res, horizon, pt, dc, adj, stale: sc !== scenario }
}

export function useBreakEvens() {
  const { sc, res } = useMain()
  return useMemo(
    () => ({
      appreciation: breakEvenAppreciation(sc),
      rent: breakEvenRent(sc),
      pea: breakEvenPeaReturn(sc),
      year: breakEvenYear(res),
    }),
    [sc, res],
  )
}
