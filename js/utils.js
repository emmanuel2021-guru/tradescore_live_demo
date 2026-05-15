// ── Formatting ───────────────────────────────────────────────────
export const fmt = n => '₦' + Number(n).toLocaleString('en-NG');
export const fmtShort = n => {
  if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return '₦' + (n / 1_000).toFixed(0) + 'K';
  return '₦' + n;
};

// ── SVG arc helpers ──────────────────────────────────────────────
export const toRad = d => d * Math.PI / 180;
export function arcPath(cx, cy, r, a1, a2) {
  const x1 = cx + r * Math.cos(toRad(a1));
  const y1 = cy + r * Math.sin(toRad(a1));
  const x2 = cx + r * Math.cos(toRad(a2));
  const y2 = cy + r * Math.sin(toRad(a2));
  const len = ((a2 - a1) + 360) % 360;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${len > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// ── Score helpers ────────────────────────────────────────────────
import { C } from './theme.js';
export function scoreColor(s) {
  if (s >= 750) return { label: 'Excellent', color: C.leaf  };
  if (s >= 650) return { label: 'Very Good', color: C.green };
  if (s >= 550) return { label: 'Good',      color: C.mint  };
  return                { label: 'Fair',      color: C.warn  };
}

// ── Bootstrap Icon helper ────────────────────────────────────────
// Usage: icon('shop'), icon('shop', { size: 20, color: '#fff', class: 'mr-2' })
export function icon(name, opts = {}) {
  const { size, color, class: extra = '', style: extraStyle = {} } = opts;
  const style = { ...extraStyle };
  if (size)  style.fontSize = (typeof size === 'number' ? size + 'px' : size);
  if (color) style.color = color;
  return el('i', { class: ('bi bi-' + name + ' ' + extra).trim(), style });
}

// Square coloured tile with an icon inside — used widely for feature/category badges.
export function iconTile(name, { size = 44, fontSize = 18, bg = '#E8F4EE', color = '#0B6E4F', radius = 12, className = '' } = {}) {
  return el('div', {
    class: 'icon-tile ' + className,
    style: {
      width:  size + 'px',
      height: size + 'px',
      borderRadius: radius + 'px',
      background: bg,
      color,
    },
  }, icon(name, { size: fontSize }));
}

// ── DOM helpers ──────────────────────────────────────────────────
// Small `el` helper — quick way to build DOM trees without innerHTML.
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// SVG-aware element creator
export function svgEl(tag, props, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object')
      for (const [sk, sv] of Object.entries(v)) node.style.setProperty(sk, sv);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Eased animation tick (for counters & progress).
export function animate({ from = 0, to, duration = 900, ease = t => 1 - Math.pow(1 - t, 3), onUpdate, onDone }) {
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / duration, 1);
    onUpdate(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  };
  requestAnimationFrame(tick);
}
