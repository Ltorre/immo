import { useEffect, useRef, useState, type CSSProperties } from 'react'

export type Tone = 'buy' | 'rent' | 'neutral'

const TONE_VAR: Record<Tone, string> = {
  buy: 'var(--buy)',
  rent: 'var(--rent)',
  neutral: 'var(--text-2)',
}

export interface Pt {
  x: number
  y: number
}

export interface Series {
  id: string
  name: string
  tone: Tone
  points: Pt[]
  dashed?: boolean
}

export interface Band {
  id: string
  name: string
  tone: Tone
  lo: Pt[]
  hi: Pt[]
  opacity: number
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(el)
    setW(Math.max(260, Math.floor(el.getBoundingClientRect().width)))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return n * pow
}

function yTicks(min: number, max: number, count = 5): number[] {
  if (max === min) max = min + 1
  const step = niceStep((max - min) / count)
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return out
}

interface LineChartProps {
  series: Series[]
  bands?: Band[]
  height?: number
  yFormat: (v: number) => string
  xFormat?: (v: number) => string
  /** Vertical marker (e.g. the comparison horizon). */
  markX?: { x: number; label: string }
  ariaLabel: string
  xTitle?: string
}

export function LineChart({ series, bands = [], height = 300, yFormat, xFormat = (v) => String(v), markX, ariaLabel, xTitle }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const narrow = width < 520
  const m = { l: narrow ? 52 : 62, r: narrow ? 12 : 96, t: 12, b: xTitle ? 44 : 28 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b

  const allY: number[] = []
  const allX: number[] = []
  for (const s of series) for (const p of s.points) { allY.push(p.y); allX.push(p.x) }
  for (const b of bands) for (const p of [...b.lo, ...b.hi]) { allY.push(p.y); allX.push(p.x) }
  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  let yMin = Math.min(0, ...allY)
  let yMax = Math.max(0, ...allY)
  if (yMax === yMin) yMax = yMin + 1
  const ticks = yTicks(yMin, yMax)
  yMin = Math.min(yMin, ticks[0])
  yMax = Math.max(yMax, ticks[ticks.length - 1])

  const sx = (x: number) => m.l + (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * iw)
  const sy = (y: number) => m.t + ih - ((y - yMin) / (yMax - yMin)) * ih

  const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
  const areaPath = (lo: Pt[], hi: Pt[]) =>
    hi.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('') +
    [...lo].reverse().map((p) => `L${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('') + 'Z'

  const xs = (series[0]?.points ?? bands[0]?.hi ?? []).map((p) => p.x)
  const xStep = Math.max(1, Math.ceil((xMax - xMin) / (narrow ? 5 : 10)))
  const xTickVals: number[] = []
  for (let v = Math.ceil(xMin); v <= xMax; v += xStep) xTickVals.push(v)

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = xMin + ((e.clientX - r.left) / r.width) * (xMax - xMin)
    let best = xs[0]
    for (const v of xs) if (Math.abs(v - x) < Math.abs(best - x)) best = v
    setHover(best)
  }

  const valueAt = (pts: Pt[], x: number) => pts.find((p) => p.x === x)?.y

  // Direct end labels, nudged apart so they never collide.
  const labels = !narrow && series.length >= 2 && series.length <= 4
    ? (() => {
        const items = series
          .map((s) => ({ s, y: sy(s.points[s.points.length - 1].y) }))
          .sort((a, b) => a.y - b.y)
        for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 15) items[i].y = items[i - 1].y + 15
        return items
      })()
    : []

  const tipLeft = hover !== null ? sx(hover) : 0
  const flip = tipLeft > width * 0.6

  return (
    <div className="chart" ref={ref}>
      <div className="legend" aria-hidden={false}>
        {series.map((s) => (
          <span key={s.id} className="legend-item">
            <span className="legend-swatch" style={{ background: TONE_VAR[s.tone], borderTop: s.dashed ? '2px dashed var(--surface)' : undefined }} />
            {s.name}
          </span>
        ))}
        {bands.map((b) => (
          <span key={b.id} className="legend-item">
            <span className="legend-swatch" style={{ background: TONE_VAR[b.tone], opacity: Math.min(1, b.opacity * 2.2) }} />
            {b.name}
          </span>
        ))}
      </div>
      <div className="chart-box" style={{ height }}>
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + iw} y1={sy(v)} y2={sy(v)} className={v === 0 ? 'axis-zero' : 'grid-line'} />
              <text x={m.l - 8} y={sy(v)} className="tick" textAnchor="end" dominantBaseline="middle">{yFormat(v)}</text>
            </g>
          ))}
          {xTickVals.map((v) => (
            <text key={v} x={sx(v)} y={m.t + ih + 16} className="tick" textAnchor="middle">{xFormat(v)}</text>
          ))}
          {xTitle && <text x={m.l + iw / 2} y={height - 6} className="tick" textAnchor="middle">{xTitle}</text>}
          {markX && markX.x >= xMin && markX.x <= xMax && (
            <g>
              <line x1={sx(markX.x)} x2={sx(markX.x)} y1={m.t} y2={m.t + ih} className="mark-line" />
              <text x={sx(markX.x) + 4} y={m.t + 10} className="tick">{markX.label}</text>
            </g>
          )}
          {bands.map((b) => (
            <path key={b.id} d={areaPath(b.lo, b.hi)} style={{ fill: TONE_VAR[b.tone], opacity: b.opacity }} />
          ))}
          {series.map((s) => (
            <path
              key={s.id}
              d={path(s.points)}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '6 4' : undefined}
              style={{ stroke: TONE_VAR[s.tone] }}
            />
          ))}
          {labels.map(({ s, y }) => (
            <text key={s.id} x={m.l + iw + 8} y={y} className="end-label" dominantBaseline="middle">{s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name}</text>
          ))}
          {hover !== null && (
            <g>
              <line x1={sx(hover)} x2={sx(hover)} y1={m.t} y2={m.t + ih} className="crosshair" />
              {series.map((s) => {
                const v = valueAt(s.points, hover)
                return v === undefined ? null : (
                  <circle key={s.id} cx={sx(hover)} cy={sy(v)} r={4.5} style={{ fill: TONE_VAR[s.tone] }} className="dot" />
                )
              })}
            </g>
          )}
          <rect
            x={m.l} y={m.t} width={iw} height={ih} fill="transparent"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
            style={{ touchAction: 'pan-y' }}
          />
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: flip ? undefined : tipLeft + 12, right: flip ? width - tipLeft + 12 : undefined, top: m.t }}>
            <div className="tooltip-title">{xFormat(hover)}</div>
            {series.map((s) => {
              const v = valueAt(s.points, hover)
              return v === undefined ? null : (
                <div key={s.id} className="tooltip-row">
                  <span className="legend-swatch" style={{ background: TONE_VAR[s.tone] }} />
                  <span>{s.name}</span>
                  <strong>{yFormat(v)}</strong>
                </div>
              )
            })}
            {bands.map((b) => {
              const lo = valueAt(b.lo, hover)
              const hi = valueAt(b.hi, hover)
              return lo === undefined || hi === undefined ? null : (
                <div key={b.id} className="tooltip-row">
                  <span className="legend-swatch" style={{ background: TONE_VAR[b.tone], opacity: Math.min(1, b.opacity * 2.2) }} />
                  <span>{b.name}</span>
                  <strong>{yFormat(lo)} → {yFormat(hi)}</strong>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface HistProps {
  bins: { from: number; to: number; count: number }[]
  height?: number
  xFormat: (v: number) => string
  countLabel: (n: number, share: number) => string
  ariaLabel: string
  leftLabel: string
  rightLabel: string
}

/** Histogram with the zero line: bars on the left favour renting, bars on the right favour buying. */
export function Histogram({ bins, height = 220, xFormat, countLabel, ariaLabel, leftLabel, rightLabel }: HistProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { l: 12, r: 12, t: 12, b: 30 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const total = bins.reduce((s, b) => s + b.count, 0) || 1
  const maxC = Math.max(1, ...bins.map((b) => b.count))
  const lo = bins[0].from
  const hi = bins[bins.length - 1].to
  const sx = (x: number) => m.l + ((x - lo) / (hi - lo)) * iw
  const bw = iw / bins.length
  const zeroInRange = lo < 0 && hi > 0
  const ticks = yTicks(lo, hi, narrowTicks(width))
  return (
    <div className="chart" ref={ref}>
      <div className="legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--rent)' }} />{leftLabel}</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--buy)' }} />{rightLabel}</span>
      </div>
      <div className="chart-box" style={{ height }}>
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {bins.map((b, i) => {
            const h = (b.count / maxC) * ih
            const mid = (b.from + b.to) / 2
            return (
              <rect
                key={i} x={m.l + i * bw + 1} y={m.t + ih - h} width={Math.max(1, bw - 2)} height={h}
                rx={Math.min(3, bw / 2)}
                style={{ fill: mid >= 0 ? 'var(--buy)' : 'var(--rent)', opacity: hover === i ? 1 : 0.85 }}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
              />
            )
          })}
          <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} className="axis-zero" />
          {zeroInRange && <line x1={sx(0)} x2={sx(0)} y1={m.t} y2={m.t + ih} className="mark-line" />}
          {ticks.map((v) => (
            <text key={v} x={sx(v)} y={m.t + ih + 18} className="tick" textAnchor="middle">{xFormat(v)}</text>
          ))}
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: Math.min(width - 190, Math.max(0, m.l + hover * bw)), top: 0 }}>
            <div className="tooltip-title">{xFormat(bins[hover].from)} → {xFormat(bins[hover].to)}</div>
            <div>{countLabel(bins[hover].count, bins[hover].count / total)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function narrowTicks(width: number) {
  return width < 520 ? 3 : 6
}

/** Background of a diverging cell: neutral at 0, buy colour above, rent colour below. */
export function divergingStyle(v: number, maxAbs: number): CSSProperties {
  if (!Number.isFinite(v) || maxAbs <= 0) return {}
  const k = Math.min(1, Math.abs(v) / maxAbs)
  const pct = Math.round(8 + k * 52)
  const color = v >= 0 ? 'var(--buy)' : 'var(--rent)'
  return { background: `color-mix(in srgb, ${color} ${pct}%, var(--neutral))` }
}
