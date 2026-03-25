import React from 'react';
import { theme } from '../../theme/styles';

export default function ExtractionPulse({ isProcessing, rawTextStream = [], entities = [] }) {
  if (!isProcessing) return null;

  return (
    <div style={{ ...theme.card, marginTop: 16, display: 'flex', gap: 16, height: 280, padding: 20 }}>
      {/* Terminal View */}
      <div 
        className="flex-1 rounded-xl p-4 overflow-y-auto"
        style={{ background: '#000', fontFamily: 'monospace', fontSize: 13, color: '#A3A3A3' }}
      >
        <div style={{ color: theme.accents.green, marginBottom: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          $ Ruokanna Engine Starting...
        </div>
        {rawTextStream.map((line, i) => (
          <div key={i} className="t-fade mb-1">{line}</div>
        ))}
        {isProcessing && <div className="w-2 h-4 mt-2 animate-pulse" style={{ background: theme.accents.green }} />}
      </div>
      
      {/* Entities Extracted */}
      <div style={{ width: 220, borderLeft: '1px solid #2A2A2A', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Extracted Entities
        </div>
        {entities.length === 0 ? (
          <div style={{ color: '#4B5563', fontSize: 13, fontStyle: 'italic' }}>Listening for stream...</div>
        ) : (
          entities.map((entity, i) => (
            <div key={i} className="t-fade" style={{ background: 'rgba(0,255,133,0.06)', border: `1px solid rgba(0,255,133,0.15)`, color: theme.accents.green, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              {entity}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
