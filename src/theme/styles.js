export const theme = {
  bg: '#0A0A0A',
  card: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    backdropFilter: 'blur(12px)',
    border: '1px solid #2A2A2A',
    borderRadius: '16px',
    padding: '24px',
  },
  accents: {
    green: '#00FF85',
    purple: '#c084fc', // Protein
    amber: '#FFB347',
    red: '#ef4444',
  },
  text: {
    header: { fontWeight: '700', letterSpacing: '-0.02em', color: '#FFFFFF' },
    dim: { color: 'rgba(255,255,255,0.5)', fontSize: '14px' },
  },
};

export const THEME = {
  bg: '#0A0A0A',
  card: 'rgba(26, 26, 26, 0.8)',
  green: '#00FF85',
  purple: '#c084fc',
  amber: '#FFB347',
  red: '#ef4444',
  text: '#FFFFFF',
  textSec: '#A3A3A3',
  textFaint: '#6B7280',
  textMuted: '#6B7280',
  border: '#2A2A2A',
  s2: '#1A1A1A',
};

export const glassCardStyle = {
  backgroundColor: 'rgba(26, 26, 26, 0.8)',
  backdropFilter: 'blur(12px)',
  border: '1px solid #2A2A2A',
};

export const inputStyle = {
  backgroundColor: '#111',
  border: '1px solid #2A2A2A',
  color: '#FFFFFF',
  padding: '12px 16px',
  borderRadius: '12px',
  fontSize: '14px',
  outline: 'none',
};

export function getAccentSurface(type) {
  if (type === 'protein') return { bg: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.25)', color: THEME.purple }
  if (type === 'cost' || type === 'amber') return { bg: 'rgba(255,179,71,0.12)', border: '1px solid rgba(255,179,71,0.25)', color: THEME.amber }
  if (type === 'source' || type === 'neutral') return { bg: 'rgba(26,26,26,0.6)', border: `1px solid ${THEME.border}`, color: THEME.textSec }
  if (type === 'red' || type === 'miss') return { bg: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: THEME.red }
  return { bg: 'rgba(0,255,133,0.12)', border: '1px solid rgba(0,255,133,0.25)', color: THEME.green }
}
