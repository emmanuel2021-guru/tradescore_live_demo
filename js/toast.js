// Toast notifications. Used by the SSE listener to surface real-time inflow
// / outflow events. Auto-dismiss after 5s, click to dismiss early. Multiple
// toasts stack in the top-right corner.

import { el, fmt, icon } from './utils.js';

const HOST_ID = 'tradescore-toast-host';

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = `
      position: fixed;
      top: 80px;
      right: 24px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: calc(100vw - 48px);
    `;
    document.body.appendChild(host);
  }
  return host;
}

const TONES = {
  inflow:  { accent: '#27AE60', tint: 'rgba(39,174,96,0.18)',  icon: 'arrow-down-circle-fill' },
  outflow: { accent: '#D4711F', tint: 'rgba(212,113,31,0.18)', icon: 'arrow-up-circle-fill' },
  score:   { accent: '#E8FF8B', tint: 'rgba(232,255,139,0.22)', icon: 'speedometer2' },
  success: { accent: '#27AE60', tint: 'rgba(39,174,96,0.18)',  icon: 'check-circle-fill' },
  info:    { accent: '#E8FF8B', tint: 'rgba(232,255,139,0.22)', icon: 'info-circle-fill' },
  error:   { accent: '#FF7B7B', tint: 'rgba(255,123,123,0.18)', icon: 'exclamation-triangle-fill' },
};

export function toast({ kind = 'info', title, body, duration = 5000 } = {}) {
  const tone = TONES[kind] || TONES.info;
  const host = ensureHost();

  const t = el('div', {
    style: `
      background: #022B23;
      color: #fff;
      padding: 14px 16px;
      border-radius: 14px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.30);
      pointer-events: auto;
      cursor: pointer;
      min-width: 280px;
      max-width: 360px;
      transform: translateX(20px);
      opacity: 0;
      transition: transform 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.28s;
      border: 1px solid rgba(232,255,139,0.18);
    `,
  });

  t.appendChild(el('div', {
    style: `
      width: 36px; height: 36px; border-radius: 10px;
      background: ${tone.tint}; color: ${tone.accent};
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 17px;
    `,
  }, icon(tone.icon)));

  const text = el('div', { style: 'flex: 1; min-width: 0;' });
  text.appendChild(el('div', {
    style: 'font-weight: 700; font-size: 13.5px; line-height: 1.25;',
  }, title || ''));
  if (body) {
    text.appendChild(el('div', {
      style: 'font-size: 12px; opacity: 0.78; margin-top: 3px; line-height: 1.4;',
    }, body));
  }
  t.appendChild(text);

  host.prepend(t);
  // Trigger entrance animation next frame so the initial state applies.
  requestAnimationFrame(() => {
    t.style.transform = 'translateX(0)';
    t.style.opacity = '1';
  });

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    t.style.transform = 'translateX(20px)';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }
  t.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

// Format helper so SSE handlers can call toast() without thinking about ₦.
export function toastForInflow({ amount, sender }) {
  toast({
    kind: 'inflow',
    title: `+${fmt(amount)} from ${sender}`,
    body: 'Just landed in your Squad virtual account',
  });
}

export function toastForOutflow({ amount, recipient, demo, reason }) {
  const reasonLabel = reason === 'loan_disbursement' ? 'Loan disbursement'
                    : reason === 'withdrawal'        ? 'Withdrawal'
                    : 'Outflow';
  toast({
    kind: 'outflow',
    title: `−${fmt(amount)} to ${recipient}${demo ? ' (demo)' : ''}`,
    body: `${reasonLabel} sent via Squad Payout API`,
  });
}

export function toastForScore({ score, delta }) {
  const up = delta > 0;
  toast({
    kind: 'score',
    title: `TradeScore ${up ? '+' : ''}${delta} → ${score}`,
    body: up ? 'Your score just moved up' : 'Your score adjusted',
    duration: 4000,
  });
}
