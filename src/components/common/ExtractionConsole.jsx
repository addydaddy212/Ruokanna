import { useMemo } from 'react'
import { THEME } from '../../theme/styles.js'

export default function ExtractionConsole({ status = 'Processing', logs = [] }) {
  const visibleLogs = useMemo(() => logs.filter(Boolean), [logs])

  return (
    <div style={{
      background: '#090909',
      border: `1px solid ${THEME.border}`,
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: THEME.shadow,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderBottom: `1px solid ${THEME.border}`,
        background: 'rgba(17,17,17,0.94)',
      }}>
        {['#F87171', '#FBBF24', '#00FF85'].map((color) => (
          <span key={color} style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
        ))}
        <span style={{ marginLeft: 6, color: THEME.textDim, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Ruokanna Extraction Console
        </span>
      </div>

      <div style={{ padding: 18, display: 'grid', gap: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <div style={{ color: THEME.green, fontSize: 13 }}>$ {status}</div>
        {visibleLogs.map((log, index) => (
          <div key={`${log}-${index}`} style={{ color: index === visibleLogs.length - 1 ? THEME.textSoft : THEME.textDim, fontSize: 13 }}>
            <span style={{ color: THEME.textFaint, marginRight: 8 }}>{String(index + 1).padStart(2, '0')}</span>
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}
