import React from 'react';

/**
 * Soft, rounded section divider. Use between any two background-coloured
 * sections to give the page a polished, magazine-style flow.
 *
 *   <SoftDivider from="#FFFCF5" to="#F8F3E8" />
 *
 * The component renders a 36px tall SVG wave that morphs `from` into `to`.
 */
export default function SoftDivider({ from = '#FFFCF5', to = '#FFFFFF', flip = false, height = 42 }) {
  return (
    <div
      aria-hidden
      className="w-full overflow-hidden leading-[0] -mt-px"
      style={{ background: from, transform: flip ? 'rotate(180deg)' : 'none' }}
      data-testid="soft-divider"
    >
      <svg
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: `${height}px` }}
      >
        <path
          d="M0,40 C240,90 480,0 720,40 C960,80 1200,10 1440,50 L1440,100 L0,100 Z"
          fill={to}
        />
      </svg>
    </div>
  );
}

/** Soft floating arc — for hero→section transitions with a strong contrast. */
export function ArcDivider({ from = '#0F2A2A', to = '#FFFCF5', height = 56 }) {
  return (
    <div
      aria-hidden
      className="w-full overflow-hidden leading-[0]"
      style={{ background: from }}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: `${height}px` }}
      >
        <path d="M0,0 Q720,140 1440,0 L1440,120 L0,120 Z" fill={to} />
      </svg>
    </div>
  );
}
