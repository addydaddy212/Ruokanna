export default function SkeletonCard({ height = 260, compact = false }) {
  const line = (width) => ({
    width,
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
  })

  return (
    <div style={{
      background: '#1A1A1A',
      border: '1px solid #2A2A2A',
      borderRadius: 18,
      overflow: 'hidden',
      minHeight: height,
      animation: 'misePulse 1.4s ease-in-out infinite',
    }}>
      <div style={{ height: compact ? 90 : 130, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ padding: compact ? 14 : 16 }}>
        <div style={{ ...line('72%'), height: 14, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ ...line(54), height: 22 }} />
          <div style={{ ...line(62), height: 22 }} />
        </div>
        <div style={{ ...line('92%'), marginBottom: 8 }} />
        <div style={{ ...line('78%'), marginBottom: 18 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...line('55%'), height: 36 }} />
          <div style={{ ...line('25%'), height: 36 }} />
        </div>
      </div>
    </div>
  )
}
