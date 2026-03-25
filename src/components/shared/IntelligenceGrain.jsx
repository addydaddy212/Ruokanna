import React, { useState } from 'react';
import { theme } from '../../theme/styles';

export default function IntelligenceGrain({ value, source, explanation, color = theme.accents.purple }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span 
      className="relative inline-block cursor-help group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderBottom: `2px dotted ${color}80`,
        paddingBottom: '1px',
        color: color,
        fontWeight: 'bold',
        transition: 'border-color 0.2s, color 0.2s',
      }}
    >
      {value}

      {isHovered && (
        <div 
          className="absolute z-50 w-64 p-3 text-left rounded-xl shadow-2xl t-fade"
          style={{
            ...theme.card,
            padding: '12px',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            pointerEvents: 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <span style={{ color: theme.text.header.color, fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Insight
            </span>
          </div>
          <div style={{ color: theme.text.dim.color, fontSize: '13px', lineHeight: '1.4' }}>
            <span className="font-medium text-white/90">Reasoning: </span>
            {explanation || `Parsed from ${source}`}
          </div>
        </div>
      )}
    </span>
  );
}
