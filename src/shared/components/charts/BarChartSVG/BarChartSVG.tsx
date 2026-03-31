import { useState } from 'react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function niceMax(val: number): number {
  if (val === 0) return 10
  const mag = Math.pow(10, Math.floor(Math.log10(val)))
  const norm = val / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

function yTicks(max: number, count = 4): number[] {
  const step = max / count
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

function fmtY(v: number, isCurrency: boolean): string {
  if (!isCurrency) return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v))
  if (v === 0) return '0'
  if (v >= 1000) return 'R$' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k'
  return 'R$' + Math.round(v)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataPoint {
  [key: string]: number | string
}

interface Tooltip {
  i: number
  x: number
  v1: number
  v2: number
  label: string
}

interface BarChartSVGProps {
  data: DataPoint[]
  valueKey: string
  labelKey: string
  isCurrency?: boolean
  secondKey?: string
  secondLabel?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BarChartSVG({
  data,
  valueKey,
  labelKey,
  isCurrency = false,
  secondKey,
  secondLabel,
}: BarChartSVGProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f5f5f5' }}>
        <p style={{ fontFamily: "'Questrial', sans-serif", fontSize: 12, color: '#bbb', letterSpacing: '0.1em' }}>
          SEM DADOS NO PERIODO
        </p>
      </div>
    )
  }

  const PAD = { top: 12, right: 12, bottom: 36, left: 52 }
  const VW = 700
  const VH = 220
  const CW = VW - PAD.left - PAD.right
  const CH = VH - PAD.top - PAD.bottom

  const rawMax = Math.max(
    ...data.map((d) => (Number(d[valueKey]) || 0) + (secondKey ? Number(d[secondKey]) || 0 : 0)),
    1
  )
  const maxV = niceMax(rawMax)
  const ticks = yTicks(maxV, 4)
  const barSlot = CW / data.length
  const barPad = Math.max(barSlot * 0.2, 2)
  const maxLabels = Math.floor(636 / 48)
  const every = Math.max(1, Math.ceil(data.length / maxLabels))
  const yOf = (v: number) => CH - (v / maxV) * CH

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display: 'block', overflow: 'visible' }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Y grid + labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} y1={yOf(t)} x2={CW} y2={yOf(t)} stroke={t === 0 ? '#ddd' : '#f2f2f2'} strokeWidth="1" />
              <text x={-8} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="#bbb" fontFamily="sans-serif">
                {fmtY(t, isCurrency)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const v1 = Number(d[valueKey]) || 0
            const v2 = secondKey ? Number(d[secondKey]) || 0 : 0
            const x0 = i * barSlot + barPad
            const bw = barSlot - barPad * 2
            const bw1 = secondKey ? bw / 2 - 1 : bw
            const h1 = Math.max((v1 / maxV) * CH, v1 > 0 ? 1 : 0)
            const h2 = Math.max((v2 / maxV) * CH, v2 > 0 ? 1 : 0)
            const lastShown = Math.floor((data.length - 1) / every) * every
            const tooClose = data.length - 1 - lastShown < Math.ceil(every * 0.5)
            const showLbl = i % every === 0 || (i === data.length - 1 && !tooClose)

            return (
              <g
                key={i}
                onMouseEnter={() =>
                  setTooltip({ i, x: x0 + bw / 2, v1, v2, label: String(d[labelKey]) })
                }
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'default' }}
              >
                <rect x={x0} y={yOf(v1)} width={bw1} height={h1} fill="#111" opacity={tooltip?.i === i ? 1 : 0.85} />
                {secondKey && (
                  <rect x={x0 + bw / 2 + 1} y={yOf(v2)} width={bw1} height={h2} fill="#ccc" opacity={tooltip?.i === i ? 1 : 0.85} />
                )}
                {showLbl && (
                  <text x={x0 + bw / 2} y={CH + 24} textAnchor="middle" fontSize="10" fill="#bbb" fontFamily="sans-serif">
                    {String(d[labelKey])}
                  </text>
                )}
              </g>
            )
          })}

          {/* Baseline */}
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#e0e0e0" strokeWidth="1" />
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: `${((PAD.left + tooltip.x) / VW) * 100}%`,
            transform: 'translateX(-50%)',
            background: '#111',
            color: '#fff',
            fontFamily: "'Questrial', sans-serif",
            fontSize: 11,
            padding: '8px 12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
            letterSpacing: '0.03em',
            lineHeight: 1.7,
          }}
        >
          <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>{tooltip.label}</div>
          <div>
            {isCurrency
              ? 'R$ ' + tooltip.v1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              : tooltip.v1}
          </div>
          {secondKey && (
            <div style={{ color: '#ccc' }}>
              {secondLabel}:{' '}
              {isCurrency
                ? 'R$ ' + tooltip.v2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                : tooltip.v2}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
