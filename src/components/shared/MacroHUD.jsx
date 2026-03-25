import React from 'react';
import { theme } from '../../theme/styles';

export default function MacroHUD({ 
  calories = 0, calTarget = 2000, 
  protein = 0, proTarget = 150, 
  carbs = 0, carbTarget = 200, 
  size = 120, strokeWidth = 8,
  pulseRing = null // 'protein', 'carbs', or 'calories' for swap animation
}) {
  const center = size / 2;
  const radii = {
    calories: (size / 2) - strokeWidth,
    protein: (size / 2) - (strokeWidth * 3),
    carbs: (size / 2) - (strokeWidth * 5),
  };

  const circumference = (r) => 2 * Math.PI * r;
  
  const getOffset = (value, target, r) => {
    const percent = Math.min(value / (target || 1), 1);
    return circumference(r) * (1 - percent);
  };

  const renderRing = (type, value, target, r, color) => {
    const isPulsing = pulseRing === type || pulseRing === 'all';
    const circ = circumference(r);
    return (
      <g key={type}>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={`${color}33`} // 20% opacity fallback
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={getOffset(value, target, r)}
          strokeLinecap="round"
          className={`donut-ring ${isPulsing ? 'animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''}`}
          style={{ 
            transition: 'stroke-dashoffset 1s ease-out, filter 0.3s',
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%'
          }}
        />
      </g>
    );
  };

  return (
    <div className="flex items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {renderRing('calories', calories, calTarget, radii.calories, theme.accents.green)}
        {renderRing('protein', protein, proTarget, radii.protein, theme.accents.purple)}
        {renderRing('carbs', carbs, carbTarget, radii.carbs, theme.accents.amber)}
      </svg>
    </div>
  );
}
