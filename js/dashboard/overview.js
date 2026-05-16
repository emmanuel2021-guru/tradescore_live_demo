import { el, fmt, animate, icon, openModal, toast } from '../utils.js';
import { getUser, getScore, getAllTransactions, getInsights, getWalletBalance, onScoreUpdated, onTxsUpdated, onInsightsUpdated, refreshTxsFromServer } from '../store.js';
import { recommendLoan, categorize, matchWorkers } from '../ai.js';
import { TxRow } from '../components/txRow.js';
import { api } from '../api.js';

export function Overview({ navigate }) {
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  const TRADER = getUser();
  const isWorker = TRADER.role === 'worker';
  const hello = new Date().getHours() < 12 ? 'Good morning'
              : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const greetingText = TRADER.firstName ? `${hello}, ${TRADER.firstName}` : hello;
  root.appendChild(el('div', { class: 'flex flex-wrap items-end justify-between gap-3 fade-up' },
    el('div', {},
      el('p', { class: 'text-ink-2 text-[14px]' }, greetingText),
      el('h2', {
        class: 'font-display text-[22px] md:text-[26px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.025em' },
      }, isWorker ? 'Your earnings today' : 'Your business today'),
    ),
    el('div', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } },
      el('span', { style: { fontSize: '7px' } }, '●'),
      'Live · synced now'),
  ));

  // ── Wallet card (real balance + Receive / Send money) ───
  const walletHost = el('div', { class: 'fade-up-1' });
  function renderWallet() {
    walletHost.innerHTML = '';
    walletHost.appendChild(buildWalletCard());
  }
  renderWallet();
  onTxsUpdated(() => renderWallet());
  root.appendChild(walletHost);

  // ── KPI strip (single green family, graded) ──────────────
  const kpis = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up-1' });
  function renderKpis() {
    const s = getScore();
    const agg = s?.aggregates || {};
    kpis.innerHTML = '';
    const scoreSub = (s && s.delta != null && s.delta !== 0)
      ? `${s.delta > 0 ? '+' : ''}${s.delta} pts since last sync`
      : (s?.score != null ? 'Just calculated' : 'Awaiting first payment');
    const revSub = agg.growthPct != null
      ? `${agg.growthPct > 0 ? '+' : ''}${agg.growthPct}% vs last month`
      : agg.monthlyRevenue ? 'Based on Squad inflows' : 'No inflows yet';

    kpis.appendChild(KpiCard({
      iconName: 'speedometer2', label: 'TradeScore',
      value: s?.score ?? '—', sub: scoreSub,
      from: '#022B23', to: '#0B6E4F',
      onClick: () => navigate('#/app/score'),
    }));
    kpis.appendChild(KpiCard({
      iconName: 'wallet2', label: isWorker ? 'Monthly earnings' : 'Monthly revenue',
      value: agg.monthlyRevenue ? fmt(agg.monthlyRevenue) : '—', sub: revSub,
      from: '#0B6E4F', to: '#14855F',
    }));
    kpis.appendChild(KpiCard({
      iconName: 'arrow-left-right', label: isWorker ? 'Gigs completed' : 'Transactions',
      value: isWorker ? (agg.inflows ?? 0) : (agg.transactions ?? 0),
      sub: 'all time',
      from: '#14855F', to: '#1F8A65',
    }));
    kpis.appendChild(KpiCard({
      iconName: 'people', label: isWorker ? 'Clients hired you' : 'Customers',
      value: agg.uniqueCustomers ?? 0,
      sub: isWorker ? 'distinct traders' : 'distinct senders',
      from: '#1F8A65', to: '#27AE60',
    }));
  }
  renderKpis();
  onScoreUpdated(() => renderKpis());
  root.appendChild(kpis);

  // ── Two-column main ──────────────────────────────────────
  const grid = el('div', { class: 'grid lg:grid-cols-3 gap-6' });

  const left = el('div', { class: 'lg:col-span-2 space-y-6' });
  const revenueHost = el('div');
  const txsHost = el('div');
  left.appendChild(revenueHost);
  left.appendChild(txsHost);
  function renderRevenue() {
    revenueHost.innerHTML = '';
    revenueHost.appendChild(buildRevenueCard());
  }
  function renderTxs() {
    txsHost.innerHTML = '';
    txsHost.appendChild(buildRecentTxs(navigate));
  }
  renderRevenue();
  renderTxs();
  onScoreUpdated(() => renderRevenue());
  onTxsUpdated(() => renderTxs());
  grid.appendChild(left);

  const right = el('div', { class: 'space-y-6' });
  const loanHost = el('div');
  right.appendChild(loanHost);
  function renderLoan() {
    loanHost.innerHTML = '';
    loanHost.appendChild(buildLoanOfferCard(navigate));
  }
  renderLoan();
  onInsightsUpdated(() => renderLoan());
  onScoreUpdated(() => renderLoan());
  // Workers don't hire — they ARE the workers. Show a "grow your score" tip card instead.
  right.appendChild(isWorker ? buildWorkerTipsCard() : buildHireHelpCard());
  grid.appendChild(right);

  root.appendChild(grid);

  return root;
}

// ── KPI ────────────────────────────────────────────────────────
function KpiCard({ iconName, label, value, sub, from, to, onClick }) {
  const card = el('div', {
    class: 'rounded-2xl p-5 relative overflow-hidden ' + (onClick ? 'cursor-pointer' : ''),
    style: {
      background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      boxShadow: `0 10px 24px -10px ${from}99`,
      transition: 'transform 0.2s, box-shadow 0.2s',
    },
    onClick,
  });
  if (onClick) {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = `0 16px 30px -10px ${from}cc`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = `0 10px 24px -10px ${from}99`;
    });
  }
  card.appendChild(el('div', {
    style: {
      position: 'absolute', top: '-50px', right: '-50px',
      width: '150px', height: '150px', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
      pointerEvents: 'none',
    },
  }));
  card.appendChild(el('div', { class: 'flex items-center gap-2.5 mb-3 relative' },
    el('div', {
      class: 'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
      style: {
        background: 'rgba(255,255,255,0.18)',
        color: '#fff', fontSize: '15px',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.18) inset',
      },
    }, icon(iconName)),
    el('div', {
      class: 'text-[11.5px] font-bold uppercase tracking-[0.08em]',
      style: { color: 'rgba(255,255,255,0.82)' },
    }, label),
  ));
  const v = el('div', {
    class: 'font-display text-[26px] font-extrabold text-white relative',
    style: { letterSpacing: '-0.025em' },
  }, '0');
  card.appendChild(v);
  card.appendChild(el('div', {
    class: 'text-[11.5px] mt-0.5 relative font-semibold',
    style: { color: 'rgba(255,255,255,0.75)' },
  }, sub));

  if (typeof value === 'number') {
    animate({ to: value, duration: 1000, onUpdate: n => v.textContent = Math.round(n).toLocaleString() });
  } else {
    v.textContent = String(value);
  }
  return card;
}

// ── Revenue chart ────────────────────────────────────────────
// Returns null when there's no real revenue history yet. Callers render an
// empty state in that case — we never fall back to MOCK_REV / MOCK_MONS
// inside the dashboard (that data is marketing-only).
function getRevSeries() {
  const s = getScore();
  const hist = s?.aggregates?.revenueHistory;
  if (Array.isArray(hist) && hist.length >= 2) {
    return {
      values: hist.map(h => h.value),
      labels: hist.map(h => h.label),
    };
  }
  return null;
}

function buildRevenueCard() {
  const card = el('div', { class: 'card p-6' });
  const s = getScore();
  const growth = s?.aggregates?.growthPct;
  const series = getRevSeries();
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4' },
    el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep', style: { letterSpacing: '-0.02em' } }, (getUser().role === 'worker' ? 'Earnings trend' : 'Revenue trend')),
    el('div', { class: 'flex items-center gap-2' },
      growth != null ? el('span', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } },
        icon(growth >= 0 ? 'arrow-up-short' : 'arrow-down-short'), Math.abs(growth) + '%') : null,
      series ? el('button', {
        class: 'btn btn-ghost !py-1.5 !px-3 !text-[12px]',
        onClick: () => openRevenueModal(),
      }, icon('arrows-fullscreen'), 'Expand') : null,
    ),
  ));
  card.appendChild(series ? buildRevenueChart({ height: 220 }) : buildRevenueEmpty());
  return card;
}

function buildRevenueEmpty() {
  return el('div', {
    class: 'flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl',
    style: { background: '#F5F9F6', border: '1px dashed #C8D6CF', minHeight: '220px' },
  },
    el('div', {
      class: 'w-12 h-12 rounded-full flex items-center justify-center mb-3',
      style: { background: '#E5F9F0', color: '#0B6E4F', fontSize: '20px' },
    }, icon('graph-up-arrow')),
    el('div', {
      class: 'font-display text-[15px] font-extrabold text-squad-deep',
    }, 'No revenue yet'),
    el('p', {
      class: 'text-[12px] text-ink-3 mt-1 leading-relaxed max-w-[280px]',
    }, 'Share your virtual account with a customer — your first payment will start the trend line.'),
  );
}

function openRevenueModal() {
  openModal(({ modal, close }) => {
    const { values, labels } = getRevSeries();
    modal.appendChild(el('div', { class: 'flex items-center justify-between mb-1' },
      el('h3', { class: 'font-display text-[20px] font-extrabold text-squad-deep' }, (getUser().role === 'worker' ? 'Earnings trend' : 'Revenue trend')),
    ));
    modal.appendChild(el('p', { class: 'text-[12.5px] text-ink-3 mb-4' },
      'Hover or tap a point to see the month total'));
    modal.appendChild(buildRevenueChart({ height: 380 }));

    const total = values.reduce((s, v) => s + v, 0);
    const avg = total / values.length;
    const best = Math.max(...values);
    const bestMon = labels[values.indexOf(best)];
    const stats = el('div', { class: 'grid grid-cols-3 gap-3 mt-5' });
    [
      ['Total', fmt(total)],
      ['Monthly average', fmt(Math.round(avg))],
      ['Best month', `${fmt(best)} · ${bestMon}`],
    ].forEach(([k, v]) => stats.appendChild(el('div', {
      class: 'p-3 rounded-xl',
      style: { background: '#F5F9F6', border: '1px solid #E2E8E4' },
    },
      el('div', { class: 'text-[10.5px] uppercase tracking-wider font-bold text-ink-3' }, k),
      el('div', { class: 'font-display text-[15px] font-extrabold text-squad-deep mt-0.5' }, v),
    )));
    modal.appendChild(stats);

    modal.appendChild(el('div', { class: 'flex justify-end mt-5' },
      el('button', { class: 'btn btn-primary !py-2.5 !px-5 !text-[13px]', onClick: close }, 'Close'),
    ));
  }, { width: 820 });
}

function buildRevenueChart({ height = 220 } = {}) {
  const { values: series, labels } = getRevSeries();
  const W = 720, H = height, PAD_X = 30, PAD_Y = 30;
  const max = Math.max(...series, 1) * 1.08;
  const stepX = (W - PAD_X * 2) / Math.max(1, series.length - 1);

  const points = series.map((v, i) => {
    const x = PAD_X + i * stepX;
    const y = H - PAD_Y - (v / max) * (H - PAD_Y * 2);
    return { x, y, v, label: labels[i] };
  });
  const line = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const fillPath = line + ` L${points[points.length - 1].x.toFixed(1)} ${H - PAD_Y} L${points[0].x.toFixed(1)} ${H - PAD_Y} Z`;
  const gradId = 'revFill_' + Math.random().toString(36).slice(2, 8);

  const wrap = el('div', { class: 'w-full relative' });
  const tip = el('div', {
    style: {
      position: 'absolute', pointerEvents: 'none', opacity: '0',
      background: '#0A1F1A', color: '#fff', padding: '8px 12px',
      borderRadius: '10px', fontSize: '12px', fontWeight: '700',
      transform: 'translate(-50%, -120%)', whiteSpace: 'nowrap',
      transition: 'opacity 0.15s', boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
      zIndex: '10',
    },
  });
  wrap.appendChild(tip);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 28}`);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';
  svg.innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0B6E4F" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#0B6E4F" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${[1,2,3].map(i => {
      const y = PAD_Y + ((H - PAD_Y * 2) / 4) * i;
      return `<line x1="${PAD_X}" y1="${y}" x2="${W - PAD_X}" y2="${y}" stroke="#E2E8E4" stroke-dasharray="4 6" />`;
    }).join('')}
    <path d="${fillPath}" fill="url(#${gradId})" />
    <path d="${line}" fill="none" stroke="#0B6E4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="2000" stroke-dashoffset="2000">
      <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="1.2s" fill="freeze" />
    </path>
    ${labels.map((m, i) => {
      const x = PAD_X + i * stepX;
      return `<text x="${x}" y="${H + 18}" text-anchor="middle"
        style="font-family: Inter, sans-serif; font-size: 11px; font-weight: 600; fill: #4A5C56;">${m}</text>`;
    }).join('')}
  `;
  const NS = 'http://www.w3.org/2000/svg';
  const guide = document.createElementNS(NS, 'line');
  guide.setAttribute('stroke', '#0B6E4F');
  guide.setAttribute('stroke-width', '1');
  guide.setAttribute('stroke-dasharray', '3 4');
  guide.setAttribute('opacity', '0');
  svg.appendChild(guide);

  points.forEach(p => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', '4');
    c.setAttribute('fill', '#0B6E4F');
    c.setAttribute('stroke', '#fff');
    c.setAttribute('stroke-width', '2');
    svg.appendChild(c);

    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('cx', p.x);
    hit.setAttribute('cy', p.y);
    hit.setAttribute('r', '18');
    hit.setAttribute('fill', 'transparent');
    hit.style.cursor = 'pointer';
    const show = () => {
      c.setAttribute('r', '6');
      c.setAttribute('fill', '#E8FF8B');
      c.setAttribute('stroke', '#0B6E4F');
      guide.setAttribute('x1', p.x);
      guide.setAttribute('x2', p.x);
      guide.setAttribute('y1', PAD_Y);
      guide.setAttribute('y2', H - PAD_Y);
      guide.setAttribute('opacity', '0.6');
      const rect = svg.getBoundingClientRect();
      const scaleX = rect.width / W;
      tip.style.left = (p.x * scaleX) + 'px';
      tip.style.top = (p.y * (rect.height / (H + 28))) + 'px';
      tip.innerHTML = `<div style="font-size:10.5px;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;">${p.label}</div><div style="font-size:14px;margin-top:2px;">${fmt(p.v)}</div>`;
      tip.style.opacity = '1';
    };
    const hide = () => {
      c.setAttribute('r', '4');
      c.setAttribute('fill', '#0B6E4F');
      c.setAttribute('stroke', '#fff');
      guide.setAttribute('opacity', '0');
      tip.style.opacity = '0';
    };
    hit.addEventListener('mouseenter', show);
    hit.addEventListener('mouseleave', hide);
    hit.addEventListener('touchstart', e => { e.preventDefault(); show(); });
    hit.addEventListener('touchend', hide);
    svg.appendChild(hit);
  });

  wrap.appendChild(svg);
  return wrap;
}

// ── Recent transactions ──────────────────────────────────────
function buildRecentTxs(navigate) {
  const card = el('div', { class: 'card p-6' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4' },
    el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep', style: { letterSpacing: '-0.02em' } }, (getUser().role === 'worker' ? 'Recent gigs' : 'Recent transactions')),
    el('button', {
      class: 'btn btn-ghost !py-2 !px-4 !text-[12.5px]',
      onClick: () => navigate('#/app/transactions'),
    }, 'View all', icon('arrow-right')),
  ));
  const list = el('div', { class: 'divide-y divide-line' });
  const txs = getAllTransactions().slice(0, 6);
  if (!txs.length) {
    list.appendChild(el('div', { class: 'p-6 text-center text-ink-3 text-[13px]' },
      'No transactions yet — once a payment lands in your virtual account it shows up here.'));
  } else {
    txs.forEach(tx => list.appendChild(TxRow(tx, { showCategory: false, categorize })));
  }
  card.appendChild(list);
  return card;
}

// ── Loan offer (uses Claude-narrated loan_why if available) ──
function buildLoanOfferCard(navigate) {
  const insights = getInsights();
  const offer = insights?.loan_offer;
  const r = offer || recommendLoan('stock');
  const card = el('div', { class: 'card p-5' });
  card.appendChild(el('div', { class: 'flex items-center gap-2 mb-3' },
    el('div', {
      class: 'w-8 h-8 rounded-lg flex items-center justify-center',
      style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '14px' },
    }, icon('cash-coin')),
    el('span', { class: 'text-[12px] font-bold text-ink-2' }, 'You qualify for a loan'),
  ));
  card.appendChild(el('div', {
    class: 'font-display text-[28px] font-extrabold text-squad-deep',
    style: { letterSpacing: '-0.025em' },
  }, fmt(r.amount)));
  card.appendChild(el('div', { class: 'text-[12px] text-ink-3 mt-0.5' },
    `${r.rate}% / month · ${r.term}`));

  const why = insights?.payload?.loan_why;
  if (why) {
    card.appendChild(el('p', {
      class: 'text-[12px] mt-3 leading-relaxed',
      style: { color: '#4A5C56' },
    }, why));
  }

  card.appendChild(el('button', {
    class: 'btn btn-primary w-full !py-3 mt-4 !text-[13px]',
    onClick: () => navigate('#/app/loans'),
  }, 'See loan options', icon('arrow-right')));

  return card;
}

// ── Hire help card (job-seeker side of the ecosystem) ──────
// Connects the trader to nearby AI-matched workers. Payment routes through
// Squad, lands in the worker's virtual account, and starts building their
// own TradeScore — the same engine that scores the trader. One loop, three
// actors: trader, worker, financial layer.
// Worker side of the loop — instead of "hire help" we show concrete actions
// the worker can take to grow their TradeScore. Each tip points at the same
// rule-based score engine, so judges can see the levers are real.
function buildWorkerTipsCard() {
  const s = getScore();
  const score = s?.score;
  const factors = s?.factors || [];
  const weak = [...factors].sort((a, b) => a.value - b.value)[0];

  const card = el('div', { class: 'card p-5' });
  card.appendChild(el('div', { class: 'flex items-center gap-2 mb-3' },
    el('div', {
      class: 'w-8 h-8 rounded-lg flex items-center justify-center',
      style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '14px' },
    }, icon('rocket-takeoff')),
    el('span', { class: 'text-[12px] font-bold text-ink-2' }, 'Grow your TradeScore'),
    el('span', {
      class: 'ml-auto chip',
      style: { background: '#E8FF8B', color: '#022B23', padding: '2px 7px', fontSize: '9.5px' },
    }, 'AI'),
  ));

  card.appendChild(el('div', {
    class: 'font-display text-[18px] font-extrabold text-squad-deep leading-tight',
    style: { letterSpacing: '-0.02em' },
  }, score != null ? `You're at ${score}/850` : 'Build your first 3 gigs'));

  const subText = score == null
    ? 'Every gig you complete through Squad becomes credit history. Three gigs is enough to unlock your first loan tier.'
    : (weak
        ? `Your biggest lift right now is ${weak.label} (${weak.value}/100). ${weak.desc}.`
        : 'Keep completing gigs to climb the tiers.');
  card.appendChild(el('p', { class: 'text-[12px] text-ink-3 mt-1.5 leading-relaxed' }, subText));

  const tips = [
    'Accept gigs from new traders to lift Customer Diversity',
    'Aim for at least one gig per week — consistency matters more than size',
    'Higher-value gigs (₦5k+) compound your Transaction Volume factor',
  ];
  const list = el('div', { class: 'mt-3 space-y-1.5' });
  tips.forEach(t => list.appendChild(el('div', {
    class: 'flex items-start gap-2 text-[12px] leading-relaxed',
    style: { color: '#4A5C56' },
  },
    el('span', { style: { color: '#0B6E4F', fontSize: '12px', flexShrink: '0', marginTop: '2px' } },
      icon('check-circle-fill')),
    el('span', {}, t),
  )));
  card.appendChild(list);
  return card;
}

function buildHireHelpCard() {
  const card = el('div', { class: 'card p-5' });
  card.appendChild(el('div', { class: 'flex items-center gap-2 mb-3' },
    el('div', {
      class: 'w-8 h-8 rounded-lg flex items-center justify-center',
      style: { background: '#FFF4D6', color: '#9B6B00', fontSize: '14px' },
    }, icon('people-fill')),
    el('span', { class: 'text-[12px] font-bold text-ink-2' }, 'Need a hand today?'),
    el('span', {
      class: 'ml-auto chip',
      style: { background: '#E8FF8B', color: '#022B23', padding: '2px 7px', fontSize: '9.5px' },
    }, 'AI'),
  ));
  card.appendChild(el('div', {
    class: 'font-display text-[18px] font-extrabold text-squad-deep leading-tight',
    style: { letterSpacing: '-0.02em' },
  }, 'Hire a vetted worker'));
  card.appendChild(el('p', {
    class: 'text-[12px] text-ink-3 mt-1.5 leading-relaxed',
  }, 'Errands, stock runs, shop help — matched by AI from a pool of nearby Squad-onboarded workers. Pay through your wallet.'));

  card.appendChild(el('div', { class: 'flex flex-wrap gap-1.5 mt-3' },
    ...['Delivery', 'Stock run', 'Shop help', 'Errand'].map(tag =>
      el('span', {
        class: 'chip',
        style: { background: '#F5F9F6', color: '#0B6E4F', fontSize: '10.5px', padding: '3px 8px' },
      }, tag)),
  ));

  card.appendChild(el('button', {
    class: 'btn btn-primary w-full !py-3 mt-4 !text-[13px]',
    onClick: () => openHireHelpModal(),
  }, icon('search'), 'Find help now'));
  return card;
}

// 3-step modal: describe → pick → pay. Kept lean for demo flow.
function openHireHelpModal() {
  openModal(({ modal, close }) => {
    let gigText = '';
    let amount = 3000;
    let selectedId = null;
    let matchResult = null;

    const header = el('div', { class: 'mb-4 pr-10' },
      el('h3', {
        class: 'font-display text-[20px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.02em' },
      }, 'Hire help'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        'Describe the gig. AI ranks nearby workers by skill, distance, and language.'),
    );
    modal.appendChild(header);

    const body = el('div');
    modal.appendChild(body);

    function renderStep1() {
      body.innerHTML = '';

      body.appendChild(el('div', { class: 'label' }, 'What do you need help with?'));
      const ta = el('textarea', {
        class: 'input',
        rows: '3',
        placeholder: 'e.g. Run stock from Balogun market to my shop in Yaba',
      });
      ta.addEventListener('input', e => { gigText = e.target.value; });
      body.appendChild(ta);

      // Quick presets so judges can demo without typing.
      const presets = [
        'Run stock from Balogun market to my shop',
        'Need extra hand at the shop, busy day',
        'Deliver 3 cartons to a customer in Surulere',
        'Help me count inventory this evening',
      ];
      body.appendChild(el('div', { class: 'flex flex-wrap gap-1.5 mt-2' },
        ...presets.map(p => el('button', {
          class: 'chip',
          style: { background: '#F5F9F6', color: '#0B6E4F', fontSize: '11px', cursor: 'pointer' },
          onClick: () => { ta.value = p; gigText = p; },
        }, p)),
      ));

      body.appendChild(el('div', { class: 'label mt-4' }, 'Pay (₦)'));
      const amt = el('input', {
        class: 'input', type: 'number', min: '500', step: '500', value: String(amount),
      });
      amt.addEventListener('input', e => { amount = parseInt(e.target.value, 10) || 0; });
      body.appendChild(amt);

      const cta = el('button', {
        class: 'btn btn-primary w-full !py-3 mt-5 !text-[13px]',
      }, icon('stars'), 'Find matches');
      cta.addEventListener('click', () => {
        if (!gigText.trim()) {
          toast('Describe the gig first',
            { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
          return;
        }
        if (!amount || amount < 500) {
          toast('Set a fair amount (at least ₦500)',
            { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
          return;
        }
        renderMatching();
      });
      body.appendChild(cta);
    }

    async function renderMatching() {
      body.innerHTML = '';
      const spinner = el('div', { class: 'flex flex-col items-center justify-center gap-3 py-10 text-center' },
        el('span', { class: 'spin inline-block w-6 h-6 border-2 border-squad-green border-t-transparent rounded-full' }),
        el('span', { class: 'text-[13px] font-semibold text-ink-2' }, 'Claude is matching workers…'),
        el('span', { class: 'text-[11.5px] text-ink-3' }, 'Reasoning over skills, distance, score, track record'),
      );
      body.appendChild(spinner);

      // Primary path: Claude scores real onboarded workers via /api/gigs/match.
      // Fallback: rule-based local matcher on the mock WORKERS pool. Both feed
      // the same UI so the demo never blocks.
      let candidates = [];
      let aiUsed = false;
      let requestedSkills = [];
      try {
        const resp = await api.gigs.match({ gig: gigText, amount });
        if (resp.matches && resp.matches.length) {
          candidates = resp.matches.map(m => ({
            ...m,
            skills: m.matchedSkills,
            isReal: true,
            rating: Number((4.5 + ((m.tradeScore || 600) - 600) / 250).toFixed(1)),
          }));
          requestedSkills = collectSkills(candidates);
          aiUsed = resp.source === 'claude';
        }
      } catch (e) {
        console.warn('[hire-help] /api/gigs/match failed:', e.message);
      }

      // If Claude returned nothing (no real workers yet OR error), fall back
      // to the local rule-based matcher on the mock pool.
      if (!candidates.length) {
        const mockResult = matchWorkers(gigText);
        candidates = mockResult.candidates;
        requestedSkills = mockResult.requestedSkills;
      }

      matchResult = { requestedSkills, candidates, aiUsed };
      renderStep2();
    }

    function collectSkills(candidates) {
      const set = new Set();
      candidates.forEach(c => (c.matchedSkills || []).forEach(s => set.add(s)));
      return [...set];
    }

    // Lightweight skill extraction so a real worker's free-text bio
    // ("Delivery, market runs") becomes the same skill keys as the mock pool.
    function deriveSkills(bio) {
      const t = bio.toLowerCase();
      const hits = new Set();
      const map = {
        delivery: 'delivery', deliver: 'delivery',
        load: 'load-bearer', lift: 'load-bearer',
        market: 'market-run',
        stock: 'stock-running', restock: 'stock-running',
        errand: 'errand',
        shop: 'shop-help', help: 'shop-help',
        cashier: 'cashier', till: 'cashier',
        bookkeep: 'bookkeeping', accounting: 'bookkeeping',
        driver: 'driver', drive: 'driver',
        social: 'social-media',
        count: 'inventory-count',
      };
      for (const [kw, skill] of Object.entries(map)) {
        if (t.includes(kw)) hits.add(skill);
      }
      if (hits.size === 0) { hits.add('errand'); hits.add('shop-help'); }
      return [...hits];
    }

    function renderStep2() {
      body.innerHTML = '';
      const { requestedSkills, candidates, aiUsed } = matchResult;

      body.appendChild(el('div', {
        class: 'p-3 rounded-xl mb-4 flex items-center gap-2 flex-wrap',
        style: { background: '#F5F9F6', border: '1px solid #E2E8E4' },
      },
        el('span', { class: 'text-[11px] font-bold uppercase tracking-wider text-ink-3' },
          aiUsed ? 'Claude detected' : 'Detected skills'),
        ...(requestedSkills.length
          ? requestedSkills.map(s => el('span', {
              class: 'chip',
              style: { background: '#0B6E4F', color: '#fff', fontSize: '10.5px', padding: '3px 8px' },
            }, s.replace(/-/g, ' ')))
          : [el('span', { class: 'text-[11.5px] text-ink-3 italic' }, 'general match')]),
        aiUsed ? el('span', {
          class: 'chip ml-auto',
          style: { background: '#022B23', color: '#E8FF8B', fontSize: '9.5px', padding: '2px 7px', fontWeight: '800', letterSpacing: '0.05em' },
        }, icon('stars'), 'CLAUDE HAIKU 4.5') : null,
      ));

      const list = el('div', { class: 'space-y-2.5' });
      candidates.forEach(w => list.appendChild(buildCandidateRow(w)));
      body.appendChild(list);

      const payBtn = el('button', {
        class: 'btn btn-primary w-full !py-3.5 mt-5 !text-[13px]',
      }, icon('send-fill'), 'Pay ₦' + amount.toLocaleString('en-NG') + ' via Squad');
      payBtn.disabled = true;
      payBtn.style.opacity = '0.5';
      let paying = false;
      payBtn.addEventListener('click', async () => {
        if (paying) return;
        const worker = candidates.find(c => c.id === selectedId);
        if (!worker) return;

        // Real workers go through the backend so their TradeScore actually
        // grows on the spot. Mock workers stay UI-only (legacy demo path).
        if (worker.isReal) {
          paying = true;
          payBtn.disabled = true;
          payBtn.innerHTML = '';
          payBtn.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
          payBtn.appendChild(el('span', {}, 'Paying via Squad…'));
          try {
            const resp = await api.gigs.payWorker({
              worker_id:   worker.id,
              amount,
              description: gigText,
            });
            refreshTxsFromServer(); // pulls the new outflow into the dashboard
            renderConfirmation({ ...worker, _newWorkerScore: resp.worker_score });
          } catch (e) {
            toast(e?.data?.error || e.message || 'Payment failed',
              { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
            paying = false;
            payBtn.disabled = false;
            payBtn.innerHTML = '';
            payBtn.appendChild(icon('send-fill'));
            payBtn.appendChild(el('span', {}, 'Try again'));
          }
        } else {
          renderConfirmation(worker);
        }
      });
      body.appendChild(payBtn);

      function buildCandidateRow(w) {
        const row = el('div', {
          class: 'p-3.5 rounded-xl cursor-pointer transition-all',
          style: {
            background: '#fff',
            border: '1.5px solid ' + (selectedId === w.id ? '#0B6E4F' : '#E2E8E4'),
            boxShadow: selectedId === w.id ? '0 0 0 3px rgba(11,110,79,0.12)' : 'none',
          },
        });
        row.addEventListener('click', () => {
          selectedId = w.id;
          renderStep2();
        });

        const top = el('div', { class: 'flex items-start justify-between gap-3' });
        top.appendChild(el('div', { class: 'flex-1' },
          el('div', { class: 'flex items-center gap-2 flex-wrap' },
            el('span', { class: 'font-display font-extrabold text-[14.5px] text-squad-deep' }, w.name),
            el('span', {
              class: 'chip',
              style: { background: '#E5F9F0', color: '#0B6E4F', fontSize: '10px', padding: '2px 6px' },
            }, w.area + ' · ' + w.distanceKm + 'km'),
            w.isReal ? el('span', {
              class: 'chip',
              style: { background: '#022B23', color: '#E8FF8B', fontSize: '9.5px', padding: '2px 6px', fontWeight: '800' },
              title: 'Has a real Squad virtual account · payment routes through Squad',
            }, '● LIVE') : null,
          ),
          el('div', { class: 'text-[11.5px] text-ink-3 mt-0.5' }, w.bio),
          el('div', { class: 'text-[11.5px] mt-1.5 leading-relaxed', style: { color: '#4A5C56' } },
            renderWhy(w.why)),
        ));
        top.appendChild(el('div', { class: 'flex-shrink-0 text-right' },
          el('div', {
            class: 'font-display font-extrabold text-[20px]',
            style: { color: w.matchScore >= 75 ? '#0B6E4F' : '#9B6B00', letterSpacing: '-0.02em' },
          }, w.matchScore + '%'),
          el('div', { class: 'text-[9.5px] uppercase tracking-wider font-bold text-ink-3' }, 'match'),
        ));
        row.appendChild(top);

        // Worker's own TradeScore — the loop visualisation that sells this to judges.
        row.appendChild(el('div', {
          class: 'flex items-center gap-2 mt-2.5 pt-2.5 text-[11px]',
          style: { borderTop: '1px dashed #E2E8E4', color: '#4A5C56' },
        },
          el('span', { style: { color: '#0B6E4F' } }, icon('speedometer2')),
          el('span', {},
            'Worker TradeScore ',
            el('strong', { style: { color: '#022B23' } }, String(w.tradeScore)),
            ' · built from ', el('strong', { style: { color: '#022B23' } }, w.gigsCompleted + ' gigs'),
            ' paid via Squad',
          ),
        ));

        return row;
      }

      // After (re)render, enable Pay button when a worker is picked.
      if (selectedId) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
      }
    }

    function renderConfirmation(worker) {
      body.innerHTML = '';
      header.style.display = 'none';

      body.appendChild(el('div', { class: 'flex items-center justify-center mb-3' },
        el('div', {
          class: 'w-14 h-14 rounded-full flex items-center justify-center',
          style: { background: '#E5F9F0', color: '#0B6E4F', fontSize: '28px' },
        }, icon('check-circle-fill')),
      ));
      body.appendChild(el('h3', {
        class: 'font-display text-[20px] font-extrabold text-squad-deep text-center',
        style: { letterSpacing: '-0.02em' },
      }, 'Gig confirmed'));
      body.appendChild(el('p', { class: 'text-[12.5px] text-ink-3 text-center mt-1' },
        worker.name + ' has been notified · payment held in escrow until they accept'));

      const summary = el('div', {
        class: 'mt-4 p-4 rounded-xl space-y-2.5',
        style: { background: '#F5F9F6', border: '1px solid #E2E8E4' },
      });
      const row = (k, v) => el('div', { class: 'flex justify-between text-[12.5px]' },
        el('span', { class: 'text-ink-3' }, k),
        el('span', { class: 'font-bold text-squad-deep' }, v),
      );
      summary.appendChild(row('Worker', worker.name));
      summary.appendChild(row('Amount', fmt(amount)));
      summary.appendChild(row('Route', worker.isReal
        ? 'Squad wallet → ' + worker.name + '\'s Squad VA'
        : 'Squad wallet → worker virtual account'));
      if (worker.isReal && worker._newWorkerScore != null) {
        summary.appendChild(row('Worker TradeScore', worker._newWorkerScore + ' / 850 (live)'));
      } else {
        summary.appendChild(row('On completion', 'Worker TradeScore +' + Math.round(amount / 1000) + ' pts'));
      }
      body.appendChild(summary);

      body.appendChild(el('p', {
        class: 'text-[11.5px] text-ink-3 mt-3 leading-relaxed text-center italic',
      }, 'Every gig paid through Squad adds to the worker\'s payment history — the same TradeScore engine that qualified you for credit now slowly qualifies them too.'));

      body.appendChild(el('button', {
        class: 'btn btn-primary w-full !py-3 mt-5 !text-[13px]',
        onClick: close,
      }, 'Done'));

      toast('Gig posted · ' + fmt(amount) + ' to ' + worker.name,
        { iconName: 'check-circle-fill' });
    }

    // tiny inline markdown: **bold** segments → <strong>
    function renderWhy(s) {
      const parts = s.split(/(\*\*[^*]+\*\*)/g);
      return parts.map(p => p.startsWith('**')
        ? el('strong', { style: { color: '#022B23' } }, p.slice(2, -2))
        : p);
    }

    renderStep1();
  });
}

// ── Wallet card with Receive / Send money buttons ──────────
function buildWalletCard() {
  const user = getUser();
  const { available, inflow, outflow } = getWalletBalance();

  const card = el('div', {
    class: 'rounded-2xl p-6 relative overflow-hidden',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 16px 40px rgba(2, 43, 35, 0.18)',
    },
  });
  card.appendChild(el('div', {
    class: 'absolute rounded-full pointer-events-none',
    style: {
      width: '300px', height: '300px', top: '-120px', right: '-80px',
      background: 'radial-gradient(circle, rgba(232,255,139,0.16), transparent 70%)',
    },
  }));

  const grid = el('div', { class: 'relative grid lg:grid-cols-[1.3fr_auto] gap-6 items-center' });

  // Left: balance & wallet info
  const info = el('div', {});
  info.appendChild(el('div', {
    class: 'text-[10.5px] font-bold uppercase tracking-[0.2em]',
    style: { color: '#E8FF8B' },
  }, 'Squad wallet balance'));
  info.appendChild(el('div', {
    class: 'font-display font-extrabold text-white mt-1',
    style: { fontSize: '40px', lineHeight: '1.05', letterSpacing: '-0.04em' },
  }, fmt(available)));
  info.appendChild(el('div', { class: 'flex flex-wrap gap-3 mt-2 text-[12px]', style: { color: 'rgba(255,255,255,0.72)' } },
    el('span', { class: 'flex items-center gap-1.5' },
      el('span', { style: { color: '#5DDB95', fontSize: '12px' } }, icon('arrow-down-circle-fill')),
      'Inflow ', el('strong', { style: { color: '#fff' } }, fmt(inflow))),
    el('span', { class: 'flex items-center gap-1.5' },
      el('span', { style: { color: '#FFB58A', fontSize: '12px' } }, icon('arrow-up-circle-fill')),
      'Outflow ', el('strong', { style: { color: '#fff' } }, fmt(outflow))),
  ));
  if (user.squadWallet) {
    info.appendChild(el('div', {
      class: 'mt-3 text-[11.5px] flex items-center gap-2',
      style: { color: 'rgba(255,255,255,0.6)' },
    },
      icon('bank2'),
      el('span', {}, (user.virtualAccountBank || 'GTBank') + ' · '),
      el('span', { class: 'font-mono font-bold', style: { color: '#fff', letterSpacing: '0.04em' } }, user.squadWallet),
    ));
  }
  grid.appendChild(info);

  // Right: action buttons
  const actions = el('div', { class: 'flex gap-2.5 flex-wrap lg:flex-nowrap' });
  actions.appendChild(el('button', {
    class: 'btn btn-lime !py-3 !px-5 !text-[13px]',
    onClick: () => openReceiveMoneyModal(),
  }, icon('arrow-down-left-circle-fill'), 'Receive money'));
  actions.appendChild(el('button', {
    class: 'btn !py-3 !px-5 !text-[13px] text-white border border-white/30 hover:bg-white/10',
    onClick: () => openSendMoneyModal(),
  }, icon('arrow-up-right-circle-fill'), 'Send money'));
  grid.appendChild(actions);

  card.appendChild(grid);
  return card;
}

// ── Receive money modal ────────────────────────────────────
// Shows the user's Squad virtual account number — that's how customers send
// money in. Copy / share / "simulate inflow" for demos.
function openReceiveMoneyModal() {
  openModal(({ modal }) => {
    const user = getUser();
    modal.appendChild(el('div', { class: 'mb-4 pr-10' },
      el('h3', {
        class: 'font-display text-[20px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.02em' },
      }, 'Receive money'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        'Share this account number with your customer. Any payment lands instantly and shows up on your dashboard.'),
    ));

    if (!user.squadWallet) {
      modal.appendChild(el('div', {
        class: 'p-4 rounded-xl text-[13px]',
        style: { background: '#FFF4E0', color: '#7B5500', border: '1px solid #F0DA9A' },
      }, 'Your virtual account is still being provisioned — refresh in a moment.'));
      return;
    }

    // Account card
    const acctCard = el('div', {
      class: 'rounded-2xl p-5 mb-4',
      style: { background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)' },
    });
    acctCard.appendChild(el('div', {
      class: 'text-[10.5px] uppercase tracking-widest font-bold',
      style: { color: '#E8FF8B' },
    }, 'Your virtual account'));
    acctCard.appendChild(el('div', {
      class: 'font-display text-white font-extrabold mt-1 select-all',
      style: { fontSize: '32px', letterSpacing: '0.04em' },
    }, user.squadWallet));
    acctCard.appendChild(el('div', {
      class: 'text-[12px] mt-1 flex items-center gap-2 flex-wrap',
      style: { color: 'rgba(255,255,255,0.7)' },
    },
      el('span', {}, (user.virtualAccountBank || 'GTBank') + ' · ' + (user.name || 'You')),
    ));
    modal.appendChild(acctCard);

    // Copy + share row
    const shareMsg = encodeURIComponent(
      `Hi! Please pay into my account:\n${user.squadWallet} (${user.virtualAccountBank || 'GTBank'})\nName: ${user.name || ''}\nThank you!`
    );
    const actions = el('div', { class: 'grid grid-cols-2 gap-2' });
    actions.appendChild(el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        navigator.clipboard?.writeText(user.squadWallet);
        toast('Account number copied', { iconName: 'clipboard-check' });
      },
    }, icon('clipboard'), 'Copy number'));
    actions.appendChild(el('a', {
      class: 'btn',
      href: 'https://wa.me/?text=' + shareMsg,
      target: '_blank',
      rel: 'noopener',
      style: { background: '#25D366', color: '#fff' },
    }, icon('whatsapp'), 'Share on WhatsApp'));
    modal.appendChild(actions);

    // Dev: simulate an inflow for the demo
    modal.appendChild(el('div', {
      class: 'mt-5 p-4 rounded-xl',
      style: { background: '#F5F9F6', border: '1px dashed #E2E8E4' },
    },
      el('div', { class: 'flex items-center gap-2 mb-2' },
        el('span', { style: { color: '#0B6E4F', fontSize: '14px' } }, icon('lightning-charge-fill')),
        el('span', { class: 'text-[12px] font-extrabold uppercase tracking-wider text-squad-green' },
          'Demo · Simulate inflow'),
      ),
      el('p', { class: 'text-[12px] text-ink-3 mb-3' },
        'Skip the wait — pretend a customer just sent you money to test the dashboard.'),
      buildSimulateRow(),
    ));
  });
}

function buildSimulateRow() {
  const row = el('div', { class: 'flex items-center gap-2' });
  const input = el('input', {
    class: 'input !py-2.5 flex-1',
    type: 'number', min: '500', step: '500', value: '5000',
    placeholder: 'Amount (₦)',
  });
  const btn = el('button', {
    class: 'btn btn-lime !py-2.5 !px-4 !text-[12.5px]',
  }, icon('arrow-down-circle-fill'), 'Simulate');
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    const amount = parseInt(input.value, 10) || 5000;
    busy = true;
    btn.innerHTML = '';
    btn.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full' }));
    btn.appendChild(el('span', {}, 'Simulating…'));
    try {
      await api.simulatePayment(amount);
      toast('Inflow simulated · ' + fmt(amount), { iconName: 'arrow-down-circle-fill' });
      refreshTxsFromServer();
    } catch (e) {
      toast(e?.data?.error || e.message || 'Could not simulate',
        { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
    } finally {
      busy = false;
      btn.innerHTML = '';
      btn.appendChild(icon('arrow-down-circle-fill'));
      btn.appendChild(el('span', {}, 'Simulate'));
    }
  });
  row.appendChild(input);
  row.appendChild(btn);
  return row;
}

// ── Send money modal ──────────────────────────────────────
// Bank picker → account number → verify (lookup-account) → amount → submit
// to /api/withdrawals. The backend records the outflow tx, pushes an SSE
// event, and recomputes the score.
function openSendMoneyModal() {
  openModal(({ modal, close }) => {
    let banks = [];
    let bank = null;          // { name, code }
    let accountNumber = '';
    let accountName = '';     // filled after successful lookup
    let amount = 0;
    let verifying = false;
    let submitting = false;

    modal.appendChild(el('div', { class: 'mb-4 pr-10' },
      el('h3', {
        class: 'font-display text-[20px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.02em' },
      }, 'Send money'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        'Withdraw from your Squad wallet to any Nigerian bank account.'),
    ));

    // Available balance hint
    const { available } = getWalletBalance();
    modal.appendChild(el('div', {
      class: 'p-3 rounded-xl mb-4 flex items-center justify-between',
      style: { background: '#E8F4EE' },
    },
      el('span', { class: 'text-[12px] font-bold text-squad-green' }, 'Available balance'),
      el('span', { class: 'font-display font-extrabold text-squad-deep text-[16px]' }, fmt(available)),
    ));

    // Bank picker
    modal.appendChild(el('div', { class: 'label' }, 'Bank'));
    const bankSelect = el('select', {
      class: 'input', disabled: true,
    });
    bankSelect.appendChild(el('option', { value: '' }, 'Loading banks…'));
    bankSelect.addEventListener('change', e => {
      const code = e.target.value;
      bank = banks.find(b => b.code === code) || null;
      // Re-verify when bank changes (account name may differ).
      accountName = '';
      acctNameEl.textContent = '';
      paint();
    });
    modal.appendChild(bankSelect);

    // Account number
    modal.appendChild(el('div', { class: 'label mt-4' }, 'Account number'));
    const acctInput = el('input', {
      class: 'input', type: 'text', inputmode: 'numeric', maxlength: '10',
      placeholder: '10-digit account number',
    });
    acctInput.addEventListener('input', e => {
      acctInput.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      accountNumber = acctInput.value;
      accountName = '';
      acctNameEl.textContent = '';
      paint();
    });
    modal.appendChild(acctInput);

    // Resolved account name + verify button row
    const verifyRow = el('div', { class: 'mt-2 flex items-center justify-between gap-2' });
    const acctNameEl = el('div', {
      class: 'text-[12.5px] font-bold flex-1',
      style: { color: '#0B6E4F' },
    });
    const verifyBtn = el('button', {
      class: 'btn btn-ghost !py-2 !px-3 !text-[12px]',
      type: 'button',
    }, icon('check-circle'), 'Verify');
    verifyBtn.addEventListener('click', async () => {
      if (verifying) return;
      if (!bank || accountNumber.length !== 10) {
        toast('Pick a bank and enter a 10-digit account number',
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        return;
      }
      verifying = true;
      verifyBtn.innerHTML = '';
      verifyBtn.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full' }));
      verifyBtn.appendChild(el('span', {}, 'Verifying…'));
      try {
        const resp = await api.loans.lookupAccount({
          bank_code: bank.code,
          account_number: accountNumber,
        });
        accountName = resp.account_name || resp.data?.account_name || '';
        if (!accountName) throw new Error('No name returned');
        acctNameEl.textContent = '✓ ' + accountName;
      } catch (e) {
        accountName = '';
        acctNameEl.textContent = '';
        toast(e?.data?.error || e.message || 'Could not verify',
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
      } finally {
        verifying = false;
        verifyBtn.innerHTML = '';
        verifyBtn.appendChild(icon('check-circle'));
        verifyBtn.appendChild(el('span', {}, accountName ? 'Re-verify' : 'Verify'));
        paint();
      }
    });
    verifyRow.appendChild(acctNameEl);
    verifyRow.appendChild(verifyBtn);
    modal.appendChild(verifyRow);

    // Amount
    modal.appendChild(el('div', { class: 'label mt-4' }, 'Amount (₦)'));
    const amtInput = el('input', {
      class: 'input', type: 'number', min: '100', step: '100',
      placeholder: 'How much to send',
    });
    amtInput.addEventListener('input', () => {
      amount = parseInt(amtInput.value, 10) || 0;
      paint();
    });
    modal.appendChild(amtInput);

    // Submit
    const submitBtn = el('button', {
      class: 'btn btn-primary w-full mt-5 !py-3.5',
      type: 'button',
    }, icon('send-fill'), 'Send money');
    submitBtn.addEventListener('click', async () => {
      if (submitting) return;
      if (!bank || !accountNumber || !accountName) {
        toast('Verify the account first',
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        return;
      }
      if (!amount || amount < 100) {
        toast('Enter an amount of at least ₦100',
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        return;
      }
      if (amount > available) {
        toast('Insufficient balance (₦' + available.toLocaleString('en-NG') + ' available)',
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        return;
      }

      submitting = true;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
      submitBtn.appendChild(el('span', {}, 'Sending…'));
      try {
        await api.withdrawals.apply({
          amount_kobo: amount * 100,
          bank_code: bank.code,
          account_number: accountNumber,
          account_name: accountName,
        });
        toast('Sent ' + fmt(amount) + ' to ' + accountName, { iconName: 'check-circle-fill' });
        refreshTxsFromServer();
        close();
      } catch (e) {
        toast(e?.data?.error || e.message || 'Transfer failed',
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        submitting = false;
        submitBtn.innerHTML = '';
        submitBtn.appendChild(icon('send-fill'));
        submitBtn.appendChild(el('span', {}, 'Try again'));
      }
    });
    modal.appendChild(submitBtn);

    function paint() {
      const ready = bank && accountName && amount >= 100 && amount <= available;
      submitBtn.disabled = !ready || submitting;
      submitBtn.style.opacity = ready && !submitting ? '1' : '0.6';
    }
    paint();

    // Fetch the bank list from the backend
    api.loans.banks()
      .then(resp => {
        banks = resp.banks || resp || [];
        bankSelect.innerHTML = '';
        bankSelect.disabled = false;
        bankSelect.appendChild(el('option', { value: '' }, 'Select a bank'));
        banks.forEach(b => {
          bankSelect.appendChild(el('option', { value: b.code }, b.name));
        });
      })
      .catch(e => {
        bankSelect.innerHTML = '';
        bankSelect.appendChild(el('option', { value: '' }, 'Could not load banks'));
        toast('Could not load banks: ' + (e.message || ''),
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
      });
  });
}
