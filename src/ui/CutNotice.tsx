import type { Cut } from '../engine/analysis'
import { useApp } from '../state'
import { Callout } from './fields'

/** Explains that the comparison stops early because someone runs out of savings. */
export default function CutNotice({ cut }: { cut: Cut | null }) {
  const { t } = useApp()
  if (!cut) return null
  const who = t(cut.who === 'buy' ? 'who.buy' : cut.who === 'rent' ? 'who.rent' : 'who.both')
  return <Callout kind="bad">{t('warn.insolvent', { who, year: cut.year, effective: cut.effective, requested: cut.requested })}</Callout>
}
