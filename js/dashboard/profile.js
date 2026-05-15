import { el, fmt, icon } from '../utils.js';
import { getUser, getScore, onScoreUpdated, onTxsUpdated } from '../store.js';

export function ProfilePanel({ navigate }) {
  const TRADER = getUser();

  // Friendly "since" date — falls back to a sensible placeholder if the
  // backend hasn't populated it.
  const since = TRADER.since || 'today';

  const SETTINGS = [
    { icon: 'shop',              label: 'Business details', sub: 'Edit shop name, category, location' },
    { icon: 'link-45deg',        label: 'Squad wallet',
      sub: TRADER.squadWallet
        ? `${TRADER.virtualAccountBank || 'GTBank'} · ${TRADER.squadWallet}`
        : 'Provisioning — refresh in a moment',
      tag: TRADER.squadWallet ? 'Linked' : 'Pending' },
    { icon: 'box-seam',          label: 'Inventory',        sub: 'Manage items and prices', target: '#/app/inventory' },
    { icon: 'file-earmark-text', label: 'Loan history',     sub: 'View past loans & repayment schedule' },
    { icon: 'bell',              label: 'Notifications',    sub: 'Email, SMS and in-app alerts' },
    { icon: 'shield-lock',       label: 'Security & PIN',   sub: 'Two-factor authentication, login PIN' },
    { icon: 'robot',             label: 'AI preferences',   sub: 'Tune insight frequency and tone' },
    { icon: 'question-circle',   label: 'Help & support',   sub: 'Chat with our team, read FAQs' },
  ];

  const root = el('div', { class: 'max-w-[960px] mx-auto space-y-6' });

  // ── Header card ──────────────────────────────────────────
  const header = el('div', {
    class: 'rounded-2xl p-7 lg:p-8 grid lg:grid-cols-[auto_1fr_auto] gap-6 items-center fade-up',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 16px 40px rgba(2, 43, 35, 0.18)',
    },
  });
  header.appendChild(el('div', {
    class: 'w-[88px] h-[88px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[26px]',
    style: { background: 'rgba(232,255,139,0.18)', border: '1px solid rgba(232,255,139,0.28)' },
  }, TRADER.avatar || initialsOf(TRADER.name)));

  const info = el('div', {});
  info.appendChild(el('h1', { class: 'font-display text-white font-extrabold text-[26px] lg:text-[30px]' },
    TRADER.name || 'Your profile'));
  info.appendChild(el('p', {
    class: 'text-[13.5px] mt-1 flex items-center gap-1.5 flex-wrap', style: { color: 'rgba(255,255,255,0.75)' },
  },
    TRADER.business ? TRADER.business + ' · ' : '',
    TRADER.location ? icon('geo-alt') : null,
    TRADER.location || '',
  ));

  const chips = el('div', { class: 'flex flex-wrap gap-2 mt-3' });
  function renderChips() {
    chips.innerHTML = '';
    const s = getScore();
    if (s?.score != null) {
      chips.appendChild(el('span', { class: 'chip', style: { background: '#E8FF8B', color: '#022B23' } },
        'TradeScore ' + s.score));
    } else {
      chips.appendChild(el('span', {
        class: 'chip',
        style: { background: 'rgba(255,255,255,0.10)', color: 'rgba(232,255,139,0.85)', border: '1px solid rgba(232,255,139,0.30)' },
      }, 'No score yet'));
    }
    chips.appendChild(el('span', {
      class: 'chip',
      style: { background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(232,255,139,0.30)' },
    }, 'Member since ' + since));
  }
  renderChips();
  onScoreUpdated(() => renderChips());
  info.appendChild(chips);
  header.appendChild(info);

  header.appendChild(el('button', {
    class: 'btn btn-lime !py-3 !px-5 !text-[13px] self-start lg:self-center',
  }, 'Edit profile'));
  root.appendChild(header);

  // ── Stat strip ──────────────────────────────────────────
  // Re-renders whenever a fresh score or transaction lands, so simulating a
  // payment on the Overview tab visibly ticks these cells up in real time.
  const dash = '—';
  const stripWrap = el('div', { class: 'fade-up-1' });
  const stripHeader = el('div', { class: 'flex items-center justify-between mb-2 px-1' },
    el('div', { class: 'text-[10.5px] uppercase tracking-wider text-ink-3 font-bold' }, 'At a glance'),
    el('div', { class: 'flex items-center gap-1.5 text-[11px] font-medium', style: { color: '#0B6E4F' } },
      el('span', {
        class: 'inline-block rounded-full',
        style: {
          width: '7px', height: '7px', background: '#27AE60',
          animation: 'pulse 1.6s infinite',
        },
      }),
      'Live',
    ),
  );
  const strip = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4' });
  stripWrap.appendChild(stripHeader);
  stripWrap.appendChild(strip);
  function renderStrip() {
    const s = getScore();
    const agg = s?.aggregates || {};
    strip.innerHTML = '';
    [
      { label: 'TradeScore',      value: s?.score ?? dash },
      { label: 'Monthly revenue', value: agg.monthlyRevenue ? fmt(agg.monthlyRevenue) : dash },
      { label: 'Transactions',    value: agg.transactions ?? 0 },
      { label: 'Unique payers',   value: agg.uniqueCustomers ?? 0 },
    ].forEach(cell => strip.appendChild(el('div', { class: 'card p-5' },
      el('div', { class: 'text-[10.5px] uppercase tracking-wider text-ink-3 font-bold' }, cell.label),
      el('div', {
        class: 'font-display font-extrabold text-squad-deep mt-1',
        style: { fontSize: '24px', letterSpacing: '-0.5px' },
      }, String(cell.value)),
    )));
  }
  renderStrip();
  onScoreUpdated(() => renderStrip());
  onTxsUpdated(() => renderStrip());
  root.appendChild(stripWrap);

  // ── Settings list ───────────────────────────────────────
  const list = el('div', { class: 'card overflow-hidden fade-up-2' });
  SETTINGS.forEach((s, i) => {
    const row = el('button', {
      class: 'w-full flex items-center gap-4 p-5 text-left hover:bg-squad-paper transition-colors',
      style: i < SETTINGS.length - 1 ? { borderBottom: '1px solid #E2E8E4' } : {},
      onClick: s.target ? () => navigate(s.target) : undefined,
    },
      el('div', {
        class: 'w-11 h-11 rounded-xl flex items-center justify-center',
        style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '18px' },
      }, icon(s.icon)),
      el('div', { class: 'flex-1 min-w-0' },
        el('div', { class: 'flex items-center gap-2' },
          el('span', { class: 'text-[14.5px] font-bold text-ink-1' }, s.label),
          s.tag ? el('span', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } }, s.tag) : null,
        ),
        el('div', { class: 'text-[12px] text-ink-3 mt-0.5' }, s.sub),
      ),
      el('span', { class: 'text-ink-3', style: { fontSize: '14px' } }, icon('chevron-right')),
    );
    list.appendChild(row);
  });
  root.appendChild(list);

  // ── Logout ──────────────────────────────────────────────
  root.appendChild(el('button', {
    class: 'w-full btn !py-3.5 !text-[13.5px] fade-up-3',
    style: { background: '#FCE8E8', color: '#D43E3E' },
    onClick: () => {
      // Wipe local session so a fresh signup doesn't see stale state.
      localStorage.removeItem('tradescore_cid');
      localStorage.removeItem('tradescore_user');
      localStorage.removeItem('tradescore_txs');
      localStorage.removeItem('tradescore_score');
      navigate('#/');
    },
  }, icon('box-arrow-right'), 'Log out'));

  return root;
}

function initialsOf(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '').join('') || '?';
}
