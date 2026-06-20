import { pctToColor } from '@ai-quota-tool/core';

interface Props {
  pct: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ProgressRing({ pct, size = 64, strokeWidth = 6, label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const color = pctToColor(pct);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.22,
          fontWeight: 600,
          color: '#fff',
        }}
      >
        {label ?? `${pct}%`}
      </span>
    </div>
  );
}
