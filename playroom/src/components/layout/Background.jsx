import React from 'react';

// Orbes lumineux qui dérivent lentement en arrière-plan. Purement décoratif
// (aria-hidden), désactivé par prefers-reduced-motion via l'animation CSS.
const ORBS = [
  { c: 'var(--brand)', size: 380, top: '-6%', left: '-4%', dur: 34, delay: 0 },
  { c: 'var(--brand-2)', size: 320, top: '30%', left: '82%', dur: 42, delay: 4 },
  { c: 'var(--accent)', size: 300, top: '78%', left: '10%', dur: 38, delay: 8 },
];

export default function Background() {
  return (
    <div aria-hidden className="pointer-events-none">
      {ORBS.map((o, i) => (
        <span key={i} className="orb" style={{
          width: o.size, height: o.size, top: o.top, left: o.left,
          background: `rgb(${o.c.startsWith('var') ? `var(--${o.c.slice(6, -1)})` : o.c})`,
          backgroundColor: `rgb(var(--${['brand', 'brand-2', 'accent'][i]}))`,
          animation: `floatOrb ${o.dur}s ease-in-out ${o.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}
