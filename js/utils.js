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

// Lightweight bottom-center toast — auto-dismisses. Used by inventory/profile
// panels for short action confirmations ("Sale recorded", "Settings saved").
// Distinct from the top-right SSE banner host in js/toast.js — different
// surface, different lifecycle. Both can coexist on the page.
export function toast(message, { iconName = 'check-circle-fill', color = '#27AE60', duration = 2200 } = {}) {
  let host = document.getElementById('ts-toast-host');
  if (!host) {
    host = el('div', {
      id: 'ts-toast-host',
      style: {
        position: 'fixed', bottom: '24px', left: '0', right: '0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        zIndex: '9999', pointerEvents: 'none',
      },
    });
    document.body.appendChild(host);
  }
  const node = el('div', {
    style: {
      background: '#022B23', color: '#fff', padding: '12px 18px', borderRadius: '14px',
      boxShadow: '0 12px 32px rgba(2,43,35,0.30)', display: 'flex', alignItems: 'center', gap: '10px',
      fontSize: '13.5px', fontWeight: '600', maxWidth: '92vw',
      transform: 'translateY(20px)', opacity: '0', transition: 'all .25s cubic-bezier(.22,1,.36,1)',
    },
  },
    el('span', { style: { color, fontSize: '16px', display: 'inline-flex' } }, icon(iconName)),
    el('span', {}, message),
  );
  host.appendChild(node);
  requestAnimationFrame(() => {
    node.style.transform = 'translateY(0)';
    node.style.opacity = '1';
  });
  setTimeout(() => {
    node.style.transform = 'translateY(20px)';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 260);
  }, duration);
}

// Modal helper — returns the overlay; pass an inner builder.
export function openModal(builder, { width = 480 } = {}) {
  const overlay = el('div', {
    class: 'fixed inset-0 z-50 flex items-center justify-center fade-in p-6',
    style: { background: 'rgba(2, 43, 35, 0.55)', backdropFilter: 'blur(6px)' },
  });
  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const modal = el('div', {
    class: 'card slide-up relative',
    style: { padding: '28px', maxWidth: width + 'px', width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  });
  const closeBtn = el('button', {
    class: 'absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-ink-2 hover:bg-squad-paper',
    style: { fontSize: '15px' },
    onClick: close,
    'aria-label': 'Close',
  }, icon('x-lg'));
  modal.appendChild(closeBtn);
  const built = builder({ modal, close });
  if (built instanceof Node && built !== modal) modal.appendChild(built);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return { overlay, close };
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
