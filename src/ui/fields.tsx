import { useEffect, useId, useState, type ReactNode } from 'react'

/** Little "i" that shows an explanation on hover / focus. Pure CSS, works on touch via focus. */
export function Tip({ text }: { text: string }) {
  return (
    <span className="tip" tabIndex={0} role="note" aria-label={text} data-tip={text}>
      i
    </span>
  )
}

function clean(n: number): string {
  // 0.1 + 0.2 style noise away, but keep real decimals.
  return String(Math.round(n * 1e6) / 1e6)
}

interface NumProps {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  step?: number
  min?: number
  max?: number
  hint?: string
  tip?: string
  disabled?: boolean
}

/** Number input that keeps what the user types (including a trailing comma) and commits valid numbers. */
export function Num({ label, value, onChange, unit, step = 1, min, max, hint, tip, disabled }: NumProps) {
  const id = useId()
  const [text, setText] = useState(clean(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(clean(value))
  }, [value, focused])

  const commit = (raw: string) => {
    setText(raw)
    const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(n)) {
      let v = n
      if (min !== undefined) v = Math.max(min, v)
      if (max !== undefined) v = Math.min(max, v)
      onChange(v)
    }
  }

  const bump = (dir: 1 | -1) => {
    const base = Number.isFinite(value) ? value : 0
    let v = Math.round((base + dir * step) * 1e6) / 1e6
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    onChange(v)
    setText(clean(v))
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {tip && <Tip text={tip} />}
      </label>
      <div className="input-wrap">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setText(clean(value))
          }}
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); bump(1) }
            if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1) }
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  )
}

/** Percentage input: the model stores a fraction, the user types a percentage. */
export function Pct(props: Omit<NumProps, 'unit' | 'value' | 'onChange'> & { value: number; onChange: (v: number) => void }) {
  const { value, onChange, min, max, step, ...rest } = props
  return (
    <Num
      {...rest}
      unit="%"
      value={Math.round(value * 1e6) / 1e4}
      step={step ?? 0.1}
      min={min !== undefined ? min * 100 : undefined}
      max={max !== undefined ? max * 100 : undefined}
      onChange={(v) => onChange(v / 100)}
    />
  )
}

export function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

export function Select<T extends string | number>({
  label, value, options, onChange, tip,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; tip?: string }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {tip && <Tip text={tip} />}
      </label>
      <div className="input-wrap">
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value
            const match = options.find((o) => String(o.value) === raw)
            if (match) onChange(match.value)
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function Check({ label, checked, onChange, tip }: { label: string; checked: boolean; onChange: (v: boolean) => void; tip?: string }) {
  const id = useId()
  return (
    <div className="field check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {label}
        {tip && <Tip text={tip} />}
      </label>
    </div>
  )
}

export function Card({ title, desc, children, actions, id }: { title?: string; desc?: ReactNode; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section className="card" id={id}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {desc && <p className="muted desc">{desc}</p>}
      {children}
    </section>
  )
}

export function Grid({ children, min }: { children: ReactNode; min?: number }) {
  return <div className="grid" style={min ? { gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` } : undefined}>{children}</div>
}

export function Callout({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  const icon = kind === 'warn' ? '▲' : kind === 'bad' ? '⬣' : kind === 'ok' ? '✓' : 'i'
  return (
    <div className={`callout ${kind}`} role={kind === 'bad' || kind === 'warn' ? 'alert' : undefined}>
      <span className="callout-icon" aria-hidden>{icon}</span>
      <div>{children}</div>
    </div>
  )
}

export function Button({ children, onClick, kind = 'default', title, disabled }: { children: ReactNode; onClick: () => void; kind?: 'default' | 'primary' | 'ghost' | 'danger'; title?: string; disabled?: boolean }) {
  return (
    <button type="button" className={`btn ${kind}`} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'buy' | 'rent' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">
        {tone && <span className={`swatch ${tone}`} aria-hidden />}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
