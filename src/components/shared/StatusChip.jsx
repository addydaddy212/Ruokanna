import React from 'react';
import { theme } from '../../theme/styles';

export default function StatusChip({ label, status = 'fresh', className = '' }) {
  // status: 'fresh', 'expiring', 'missing', 'neutral'
  const styleMap = {
    fresh: { color: theme.accents.green, bg: '#0A2A1A', border: 'rgba(0,255,133,0.18)' },
    expiring: { color: theme.accents.amber, bg: '#2A1A0A', border: 'rgba(245,158,11,0.18)' },
    missing: { color: theme.accents.red, bg: '#2A0A0A', border: 'rgba(248,113,113,0.18)' },
    neutral: { color: theme.text.dim.color, bg: 'rgba(26,26,36,0.8)', border: '#2A2A38' }
  };

  const current = styleMap[status] || styleMap.neutral;
  const isNeutral = status === 'neutral';

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${className}`}
      style={{
        backgroundColor: current.bg,
        color: current.color,
        border: `1px solid ${current.border}`,
        boxShadow: !isNeutral ? `0 0 10px ${current.color}15` : 'none',
      }}
    >
      {!isNeutral && (
        <span 
          className="w-1.5 h-1.5 rounded-full" 
          style={{ backgroundColor: current.color, boxShadow: `0 0 6px ${current.color}` }}
        />
      )}
      {label}
    </span>
  );
}
