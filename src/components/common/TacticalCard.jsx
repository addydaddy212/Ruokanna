import { THEME, glassCardStyle } from '../../theme/styles.js'

export default function TacticalCard({
  children,
  title,
  subtitle,
  accentColor = THEME.green,
  style = {},
  contentStyle = {},
  ...rest
}) {
  return (
    <div
      {...rest}
      style={{
      ...glassCardStyle,
      borderRadius: 22,
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at top left, ${accentColor}22, transparent 42%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', padding: 20, ...contentStyle }}>
        {(title || subtitle) && (
          <div style={{ marginBottom: 16 }}>
            {subtitle && (
              <div style={{
                color: THEME.textFaint,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}>
                {subtitle}
              </div>
            )}
            {title && (
              <div style={{ fontSize: 22, fontWeight: 800, color: THEME.text }}>
                {title}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
