import { THEME, getAccentSurface } from '../../theme/styles.js'

const STATUS_MAP = {
  match: THEME.green,
  success: THEME.green,
  protein: THEME.purple,
  cost: THEME.amber,
  warning: THEME.amber,
  source: THEME.blue,
  neutral: THEME.textSoft,
}

export default function StatusChip({ label, type = 'neutral', style = {} }) {
  const color = STATUS_MAP[type] || THEME.textSoft
  const surface = color === THEME.textSoft
    ? { background: '#111', border: `1px solid ${THEME.border}`, color: THEME.textSoft }
    : getAccentSurface(color)

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      boxShadow: color === THEME.textSoft ? 'none' : `0 0 18px ${color}12`,
      ...surface,
      ...style,
    }}>
      {label}
    </span>
  )
}
