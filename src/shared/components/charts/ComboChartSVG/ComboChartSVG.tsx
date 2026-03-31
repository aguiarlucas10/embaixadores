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

function fmtY(v: number): string {
  return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v))
}

interface DataPoint {
  [key: string]: number | string
}

interface TooltipState {
  i: number
}

interface ComboChartSVGProps {
  data: DataPoint[]
  barKey: string
  barLabel: string
  lineKey: string
  lineLabel: string
  labelKey: string
}

export function ComboChartSVG({
  data,
  barKey,
  barLabel,
  lineKey,
  lineLabel,
  labelKey,
}: ComboChartSVGProps) {
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
  const VH = 220
  const CW = VW - PAD.left - PAD.right
  const CH = VH - PAD.top - PAD.bottom
  const rawMax = Math.max(...data.map((d) => Math.max(Number(d[barKey]) || 0, Number(d[lineKey]) || 0)), 1)
  const maxV = niceMax(rawMax)
  const ticks = yTicks(maxV, 4)
  const yOf = (v: number) => CH - (v / maxV) * CH
  const barSlot = CW / data.length
  const barPad = Math.max(barSlot * 0.22, 2)
  const bw = barSlot - barPad * 2
  const xCenter = (i: number) => i * barSlot + barSlot / 2
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xCenter(i)},${yOf(Number(d[lineKey]) || 0)}`).join(' ')
  const areaD = pathD + ` L${xCenter(data.length - 1)},${CH} L${xCenter(0)},${CH} Z`
  const maxLbls = Math.floor(CW / 48)
  const every = Math.max(1, Math.ceil(data.length / maxLbls))

  function handleMouse(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * VW - PAD.left
    const idx = Math.max(0, Math.min(data.length - 1, Math.floor(mx / barSlot)))
    setTooltip({ i: idx })
  }

  const ttX = tooltip ? xCenter(tooltip.i) : 0

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 10, paddingLeft: PAD.left }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#111', display: 'inline-block', borderRadius: 1 }} />
          <span style={{ fontFamily: "'Questrial', sans-serif", fontSize: 10, color: '#999', letterSpacing: '0.05em' }}>{barLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 18, height: 2, background: '#bbb', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Questrial', sans-serif", fontSize: 10, color: '#999', letterSpacing: '0.05em' }}>{lineLabel}</span>
        </div>
      </div>

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
                {fmtY(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const v = Number(d[barKey]) || 0
            const h = Math.max((v / maxV) * CH, v > 0 ? 1 : 0)
            const x0 = i * barSlot + barPad
            return (
              <rect key={i} x={x0} y={yOf(v)} width={bw} height={h} fill="#111" opacity={tooltip?.i === i ? 1 : 0.8} />
            )
          })}
          <path d={areaD} fill="#aaa" opacity="0.08" />
          <path d={pathD} fill="none" stroke="#aaa" strokeWidth="2" strokeLinejoin="round" />
          {tooltip && (
            <>
              <line x1={ttX} y1={0} x2={ttX} y2={CH} stroke="#eee" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={ttX} cy={yOf(Number(data[tooltip.i][lineKey]) || 0)} r="4" fill="#aaa" stroke="#fff" strokeWidth="2" />
              <circle cx={ttX} cy={yOf(Number(data[tooltip.i][barKey]) || 0)} r="4" fill="#111" stroke="#fff" strokeWidth="2" />
            </>
          )}
          {data.map((d, i) => {
            const lastS = Math.floor((data.length - 1) / every) * every
            const tooClose = data.length - 1 - lastS < Math.ceil(every * 0.5)
            const show = i % every === 0 || (i === data.length - 1 && !tooClose)
            if (!show) return null
            return (
              <text key={'xl' + i} x={xCenter(i)} y={CH + 24} textAnchor="middle" fontSize="10" fill="#bbb" fontFamily="sans-serif">
                {String(d[labelKey])}
              </text>
            )
          })}
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#e0e0e0" strokeWidth="1" />
        </g>
      </svg>

      {tooltip && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: `${((PAD.left + ttX) / VW) * 100}%`,
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
          <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>{String(data[tooltip.i][labelKey])}</div>
          <div>
            {barLabel}: <strong>{Number(data[tooltip.i][barKey]) || 0}</strong>
          </div>
          <div style={{ color: '#ccc' }}>
            {lineLabel}: <strong>{Number(data[tooltip.i][lineKey]) || 0}</strong>
          </div>
        </div>
      )}
    </div>
  )
}
