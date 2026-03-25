import { useEffect, useState } from 'react'

const RINGS = [
  { key: 'calories', r: 100, color: '#00FF85', label: 'CALORIES', targetKey: 'calories', unit: 'kcal' },
  { key: 'protein',  r: 82,  color: '#C084FC', label: 'PROTEIN',  targetKey: 'protein',  unit: 'g' },
  { key: 'carbs',    r: 64,  color: '#F59E0B', label: 'CARBS',    targetKey: 'carbs',    unit: 'g' },
  { key: 'fat',      r: 46,  color: '#F87171', label: 'FAT',      targetKey: 'fat',      unit: 'g' },
]

function pct(value, target) {
  if (!target || target <= 0) return 0
  return Math.min(value / target, 1)
}

export default function MacroDonut({ calories = 0, protein = 0, carbs = 0, fat = 0, targets = {} }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  const values = { calories, protein, carbs, fat }
  const defaultTargets = { calories: 2200, protein: 130, carbs: 220, fat: 73 }
  const t = { ...defaultTargets, ...targets }
  const calPct = Math.round(pct(calories, t.calories) * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ flexShrink: 0 }}>
        <svg width="240" height="240" viewBox="0 0 240 240" aria-label="Daily macro donut chart">
          {RINGS.map((ring) => {
            const circumference = 2 * Math.PI * ring.r
            return (
              <circle
                key={`bg-${ring.key}`}
                cx="120" cy="120" r={ring.r}
                fill="none"
                stroke="#1E1E2A"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset="0"
              />
            )
          })}

          {RINGS.map((ring) => {
            const circumference = 2 * Math.PI * ring.r
            const percentage = pct(values[ring.key], t[ring.targetKey])
            const dashoffset = animated ? circumference * (1 - percentage) : circumference
            return (
              <circle
                key={`fg-${ring.key}`}
                cx="120" cy="120" r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashoffset}
                transform="rotate(-90 120 120)"
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            )
          })}

          <text
            x="120" y="111"
            textAnchor="middle"
            fill="#F0F0F8"
            fontSize="36"
            fontWeight="800"
            fontFamily="DM Sans, sans-serif"
          >
            {Math.round(calories)}
          </text>
          <text
            x="120" y="132"
            textAnchor="middle"
            fill="#55556A"
            fontSize="11"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
            letterSpacing="0.08em"
          >
            kcal
          </text>
          <text
            x="120" y="151"
            textAnchor="middle"
            fill="#00FF85"
            fontSize="13"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {calPct}%
          </text>
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220, flex: 1 }}>
        {RINGS.map((ring) => {
          const val = values[ring.key]
          const tgt = t[ring.targetKey]
          const p = Math.round(pct(val, tgt) * 100)
          return (
            <div key={ring.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ring.color, flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#55556A', letterSpacing: '0.08em' }}>
                  {ring.label}
                </span>
                <span style={{ fontSize: 13, color: '#F0F0F8', fontWeight: 600 }}>
                  {Math.round(val)}/{tgt}{ring.unit}
                </span>
                <span style={{ color: ring.color, fontSize: 12, fontWeight: 600 }}>{p}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
