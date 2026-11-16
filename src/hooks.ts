import { useDeferredValue, useMemo } from 'react'
import { breakEvenAppreciation, breakEvenPeaReturn, breakEvenRent, breakEvenYear, cutScenario, debtCheck } from './engine/analysis'
import { atHorizon, toReal } from './engine/simulate'
import { useApp } from './state'

/** The selected scenario, with the comparison stopped where one household runs out of savings. */
export function useCutScenario() {
  const { scenario } = useApp()
  const deferred = useDeferredValue(scenario)
  return useMemo(() => cutScenario(deferred), [deferred])
}

export function useMain() {
  const { state } = useApp()
  const { sc, res, cut } = useCutScenario()
  const horizon = Math.max(1, Math.round(sc.market.horizonYears))
  const pt = atHorizon(res, horizon)
  const dc = useMemo(() => debtCheck(sc), [sc])
  /** Convert a nominal amount at `years` into the displayed unit (today's euros or nominal). */
  const adj = (v: number, years: number) => (state.real ? toReal(v, years, sc.market.inflation) : v)
  return { sc, res, horizon, pt, dc, adj, cut }
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
