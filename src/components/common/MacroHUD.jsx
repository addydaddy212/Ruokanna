import { THEME } from '../../theme/styles.js'

function Ring({ radius, stroke, value, maxValue, color }) {
  const normalizedMax = Math.max(maxValue || 1, 1)
  const progress = Math.min(Math.max(value / normalizedMax, 0), 1)
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <>
      <circle
        cx="90"
        cy="90"
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth="10"
      />
      <circle
        cx="90"
        cy="90"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 90 90)"
        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
      />
    </>
  )
}

export default function MacroHUD({
  calories = 0,
  protein = 0,
  carbs = 0,
  fat = 0,
  targets = { calories: 1, protein: 1, carbs: 1, fat: 1 },
  compact = false,
}) {
  const size = compact ? 160 : 180
  const center = compact ? 80 : 90

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#glow)">
          <Ring radius={70} stroke="#1F2937" value={protein} maxValue={targets.protein} color={THEME.purple} />
          <Ring radius={54} stroke="#1F2937" value={carbs} maxValue={targets.carbs} color={THEME.blue} />
          <Ring radius={38} stroke="#1F2937" value={fat} maxValue={targets.fat} color={THEME.amber} />
        </g>

        <text x={center} y="82" textAnchor="middle" fill={THEME.textFaint} fontSize="11" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Calories
        </text>
        <text x={center} y="108" textAnchor="middle" fill={THEME.text} fontSize="24" fontWeight="800">
          {Math.round(calories)}
        </text>
        <text x={center} y="126" textAnchor="middle" fill={THEME.textFaint} fontSize="11">
          / {targets.calories}
        </text>
      </svg>

      <div style={{ display: 'grid', gap: 10, minWidth: compact ? 120 : 150 }}>
        {[
          ['Protein', protein, targets.protein, THEME.purple],
          ['Carbs', carbs, targets.carbs, THEME.blue],
          ['Fat', fat, targets.fat, THEME.amber],
        ].map(([label, value, target, color]) => (
          <div key={label} style={{ display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span style={{ color: THEME.textDim }}>{label}</span>
              <span style={{ color: THEME.text, fontWeight: 700 }}>
                {Math.round(value)}g <span style={{ color: THEME.textFaint, fontWeight: 500 }}>/ {target}g</span>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: '#111', border: `1px solid ${THEME.border}`, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min((value / Math.max(target, 1)) * 100, 100)}%`,
                height: '100%',
                background: color,
                borderRadius: 999,
                transition: 'width 0.35s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
