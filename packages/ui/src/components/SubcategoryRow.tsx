import { pctToColor } from '@ai-quota-tool/core';
import type { ClaudeSubcategory } from '@ai-quota-tool/core';

interface Props {
  sub: ClaudeSubcategory;
}

export function SubcategoryRow({ sub }: Props) {
  const remainingPct = 100 - sub.usedPct;
  const color = pctToColor(remainingPct);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', width: 90, flexShrink: 0 }}>
        {sub.name}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${remainingPct}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.6s ease, background 0.6s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', width: 50, textAlign: 'right' }}>
        {sub.label}
      </span>
    </div>
  );
}
