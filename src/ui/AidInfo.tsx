import { AID_TEMPLATES, type AidId } from '../engine/defaults'
import { useApp } from '../state'
import type { Key } from '../i18n'

const k = (id: string, part: string) => `aid.${id}.${part}` as Key

/** Who can get this loan, on what terms, how it stacks, and how reliable our information is. */
export function AidInfo({ id }: { id: AidId }) {
  const { t, fmt } = useApp()
  const a = AID_TEMPLATES.find((x) => x.id === id)
  if (!a) return null
  const parts: [Key, Key][] = [
    ['aid.who', k(id, 'who')],
    ['aid.terms', k(id, 'terms')],
    ['aid.limits', k(id, 'limits')],
    ['aid.stack', k(id, 'stack')],
  ]
  return (
    <details className="aid-info">
      <summary>
        {t('aid.conditions')} — {t(k(id, 'name'))}
        <span className={`badge ${a.confidence}`}>{a.confidence === 'confirmed' ? t('aid.confirmed') : t('aid.check')}</span>
      </summary>
      <dl>
        {parts.map(([title, text]) => (
          <div key={text}>
            <dt>{t(title)}</dt>
            <dd>{t(text)}</dd>
          </div>
        ))}
        <div>
          <dt>{t('aid.status')}</dt>
          <dd>{t(k(id, 'status'))}</dd>
        </div>
      </dl>
      <p className="muted small">
        {t('aid.checked', { date: fmt.month(a.checked) })}
        {a.source && (
          <>
            {' · '}
            <a href={a.source.url} target="_blank" rel="noreferrer noopener">
              {a.source.official ? t('aid.sourceOfficial') : t('aid.sourceSecondary')}
            </a>
          </>
        )}
      </p>
    </details>
  )
}

const OTHERS = ['pas', 'brs', 'psla', 'tva', 'mpr', 'taxe', 'local'] as const

/** Aids that cannot be modelled as a loan: listed so that nothing is forgotten. */
export function OtherAids() {
  const { t } = useApp()
  return (
    <details className="card">
      <summary>{t('aid.others.title')}</summary>
      <p className="muted desc">{t('aid.others.desc')}</p>
      <dl className="aid-list">
        {OTHERS.map((id) => (
          <div key={id}>
            <dt>{t(`aid.other.${id}.name` as Key)}</dt>
            <dd>{t(`aid.other.${id}.text` as Key)}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
