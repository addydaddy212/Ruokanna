import { useState } from 'react'
import { THEME } from '../../theme/styles.js'

export default function IntelligenceGrain({ value, label, source, explanation }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((current) => !current)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'help',
      }}
    >
      <span style={{
        borderBottom: `1px dotted ${THEME.green}`,
        color: THEME.text,
        fontWeight: 700,
      }}>
        {value}
      </span>

      {open && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 'calc(100% + 10px)',
          width: 240,
          zIndex: 30,
          padding: 12,
          borderRadius: 14,
          background: 'rgba(8,8,8,0.96)',
          border: `1px solid ${THEME.border}`,
          boxShadow: THEME.shadow,
        }}>
          <div style={{ color: THEME.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {label}
          </div>
          <div style={{ color: THEME.textSoft, fontSize: 13, lineHeight: 1.55 }}>
            {explanation || 'This value is estimated from the recipe source and engine normalization pipeline.'}
          </div>
          {source && (
            <div style={{ color: THEME.green, fontSize: 12, marginTop: 8 }}>
              Source: {source}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
