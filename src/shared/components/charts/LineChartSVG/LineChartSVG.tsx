import { useState } from 'react'

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

interface DataPoint {
  [key: string]: number | string
}

interface TooltipState {
  i: number
  x: number
}

interface LineChartSVGProps {
  data: DataPoint[]
  keys: string[]
  colors: string[]
  names: string[]
  labelKey: string
  isCurrency?: boolean
}

export function LineChartSVG({
  data,
  keys,
  colors,
  names,
  labelKey,
  isCurrency = false,
}: LineChartSVGProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

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
  const VH = 200
  const CW = VW - PAD.left - PAD.right
  const CH = VH - PAD.top - PAD.bottom
  const rawMax = Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)), 1)
  const maxV = niceMax(rawMax)
  const ticks = yTicks(maxV, 4)
  const xStep = data.length > 1 ? CW / (data.length - 1) : CW
  const yOf = (v: number) => CH - (v / maxV) * CH
  const maxLabels = Math.floor(636 / 48)
  const every = Math.max(1, Math.ceil(data.length / maxLabels))

  const pathD = (k: string) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${yOf(Number(d[k]) || 0)}`).join(' ')

  const areaD = (k: string) =>
    pathD(k) + ` L${(data.length - 1) * xStep},${CH} L0,${CH} Z`

  function handleMouse(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * VW - PAD.left
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(mx / xStep)))
    setTooltip({ i: idx, x: idx * xStep })
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setTooltip(null)}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} y1={yOf(t)} x2={CW} y2={yOf(t)} stroke={t === 0 ? '#ddd' : '#f2f2f2'} strokeWidth="1" />
              <text x={-8} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="#bbb" fontFamily="sans-serif">
                {fmtY(t, isCurrency)}
              </text>
            </g>
          ))}
          {keys.map((k, ki) => (
            <path key={'a' + k} d={areaD(k)} fill={colors[ki]} opacity="0.06" />
          ))}
          {keys.map((k, ki) => (
            <path
              key={k}
              d={pathD(k)}
              fill="none"
              stroke={colors[ki]}
              strokeWidth={ki === 0 ? '2' : '1.5'}
              strokeLinejoin="round"
            />
          ))}
          {data.map((d, i) => {
            const lastShown = Math.floor((data.length - 1) / every) * every
            const tooClose = data.length - 1 - lastShown < Math.ceil(every * 0.5)
            const showL = i % every === 0 || (i === data.length - 1 && !tooClose)
            if (!showL) return null
            return (
              <text key={'lx' + i} x={i * xStep} y={CH + 24} textAnchor="middle" fontSize="10" fill="#bbb" fontFamily="sans-serif">
                {String(d[labelKey])}
              </text>
            )
          })}
          {tooltip && (
            <>
              <line x1={tooltip.x} y1={0} x2={tooltip.x} y2={CH} stroke="#ddd" strokeWidth="1" strokeDasharray="3,3" />
              {keys.map((k, ki) => (
                <circle
                  key={'dot' + k}
                  cx={tooltip.x}
                  cy={yOf(Number(data[tooltip.i][k]) || 0)}
                  r="4"
                  fill={colors[ki]}
                  stroke="#fff"
                  strokeWidth="2"
                />
              ))}
            </>
          )}
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#e0e0e0" strokeWidth="1" />
        </g>
      </svg>
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
          <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>
            {String(data[tooltip.i][labelKey])}
          </div>
          {keys.map((k, ki) => (
            <div key={k} style={{ color: ki === 0 ? '#fff' : '#ccc' }}>
              {names[ki]}:{' '}
              <strong>
                {isCurrency
                  ? 'R$ ' + (Number(data[tooltip.i][k]) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                  : Number(data[tooltip.i][k]) || 0}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
