import React from 'react';
import { theme } from '../../theme/styles';

export default function TacticalCard({ children, title, accentColor, style, className = '' }) {
  const cardStyle = {
    ...theme.card,
    ...style,
    // If an accent is provided, maybe add a subtle top border or glow
    ...(accentColor ? { borderTop: `2px solid ${accentColor}` } : {}),
  };

  return (
    <div style={cardStyle} className={`flex flex-col gap-4 ${className}`}>
      {title && (
        <h3 style={theme.text.header} className="text-xl">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
