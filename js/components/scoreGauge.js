import { svgEl, toRad, arcPath, scoreColor, animate } from '../utils.js';
import { C } from '../theme.js';
import { TRADER } from '../data.js';

// Animated radial score gauge (300–850 range).
export function ScoreGauge({ score, size = 240 }) {
  const cx = size / 2;
  const cy = size * 0.57;
  const r  = size * 0.415;
  const sw = size * 0.065;
  const totalH = Math.round(size * 0.72);

  const svg = svgEl('svg', {
    width: size, height: totalH,
    viewBox: `0 0 ${size} ${totalH}`,
    style: { display: 'block' },
  });

  const defs = svgEl('defs');
  defs.innerHTML = `
    <linearGradient id="gFill" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${C.mint}"/>
      <stop offset="100%" stop-color="${C.leaf}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  svg.appendChild(defs);

  // Track
  svg.appendChild(svgEl('path', {
    d: arcPath(cx, cy, r, 150, 30),
    fill: 'none', stroke: C.border, 'stroke-width': sw, 'stroke-linecap': 'round',
  }));

  // Fill (animated)
  const fill = svgEl('path', {
    d: arcPath(cx, cy, r, 150, 151),
    fill: 'none', stroke: 'url(#gFill)', 'stroke-width': sw,
    'stroke-linecap': 'round', filter: 'url(#glow)',
    style: { opacity: '0' },
  });
  svg.appendChild(fill);

  const dot = svgEl('circle', {
    r: sw * 0.72, fill: C.green, filter: 'url(#glow)',
    cx: cx + r * Math.cos(toRad(150)),
    cy: cy + r * Math.sin(toRad(150)),
    style: { opacity: '0' },
  });
  svg.appendChild(dot);

  // Text labels
  const { label, color } = scoreColor(score);
  const tScore = svgEl('text', {
    x: cx, y: cy - 6, 'text-anchor': 'middle',
    style: {
      'font-family': '"Plus Jakarta Sans", sans-serif',
      'font-size': `${size * 0.22}px`,
      'font-weight': '800', fill: C.t1,
      'letter-spacing': '-1px',
    },
  }, '300');
  svg.appendChild(tScore);

  svg.appendChild(svgEl('text', {
    x: cx, y: cy + size * 0.1, 'text-anchor': 'middle',
    style: {
      'font-family': 'Inter, sans-serif',
      'font-size': `${size * 0.065}px`,
      'font-weight': '700', fill: color,
    },
  }, label));

  svg.appendChild(svgEl('text', {
    x: cx, y: cy + size * 0.185, 'text-anchor': 'middle',
    style: {
      'font-family': 'Inter, sans-serif',
      'font-size': `${size * 0.053}px`, fill: C.t3,
    },
  }, `out of ${TRADER.maxScore}`));

  // Range labels
  svg.appendChild(svgEl('text', {
    x: cx - r * 0.9, y: cy + r * 0.54 + 4, 'text-anchor': 'middle',
    style: { 'font-family': 'Inter, sans-serif', 'font-size': '10px', fill: C.t3 },
  }, '300'));
  svg.appendChild(svgEl('text', {
    x: cx + r * 0.9, y: cy + r * 0.54 + 4, 'text-anchor': 'middle',
    style: { 'font-family': 'Inter, sans-serif', 'font-size': '10px', fill: C.t3 },
  }, '850'));

  // Animation
  const targetPct = Math.max(0, Math.min(1, (score - 300) / 550));
  fill.style.opacity = '1';
  dot.style.opacity = '1';

  // prog animates 0→1; targetPct scales the arc length only.
  animate({
    to: 1, duration: 1400,
    onUpdate: prog => {
      const fillEnd = 150 + prog * targetPct * 240;
      fill.setAttribute('d', arcPath(cx, cy, r, 150, Math.max(151, fillEnd)));
      dot.setAttribute('cx', cx + r * Math.cos(toRad(fillEnd)));
      dot.setAttribute('cy', cy + r * Math.sin(toRad(fillEnd)));
      tScore.textContent = Math.round(300 + prog * (score - 300));
    },
  });

  return svg;
}
