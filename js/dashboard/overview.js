import { el, fmt, animate, icon } from '../utils.js';
import { LOAN_TIERS } from '../data.js';
import { getUser, getTxs, getScore, getLastSync, getInsights, getWalletBalance, refreshTxsFromServer, onTxsUpdated, onScoreUpdated, onInsightsUpdated } from '../store.js';
import { api } from '../api.js';
import { categorize } from '../ai.js';
import { TxRow } from '../components/txRow.js';

export function Overview({ navigate }) {
  const TRADER = getUser();
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  // ── Greeting ──────────────────────────────────────────────
  const hello = new Date().getHours() < 12 ? 'Good morning'
              : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const syncBadge = el('div', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } },
    el('span', { style: { fontSize: '7px' } }, '●'),
    el('span', { 'data-sync-label': '1' }, syncLabel()),
  );
  // Keep the badge fresh: re-render on tx refresh and once a minute on a tick.
  onTxsUpdated(() => { syncBadge.querySelector('[data-sync-label]').textContent = syncLabel(); });
  const syncTimer = setInterval(() => {
    if (!syncBadge.isConnected) { clearInterval(syncTimer); return; }
    syncBadge.querySelector('[data-sync-label]').textContent = syncLabel();
  }, 30_000);

  // Skip the "there" awkwardness when we have no real name on file.
  const greetingText = TRADER.firstName ? `${hello}, ${TRADER.firstName}` : hello;
  root.appendChild(el('div', { class: 'flex flex-wrap items-end justify-between gap-3 fade-up' },
    el('div', {},
      el('p', { class: 'text-ink-2 text-[14px] flex items-center gap-1.5' },
        greetingText, icon('hand-thumbs-up')),
      el('h2', {
        class: 'font-display text-[24px] md:text-[30px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.025em' },
      }, 'Here’s how your business is doing today.'),
    ),
    syncBadge,
  ));

  // ── KPI strip (re-renders on score updates) ───────────────
  const kpis = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up-1' });
  function renderKpis() {
    const s = getScore();
    const agg = s?.aggregates || {};
    const hasScore = s?.score != null;
    const deltaSub = (s && s.delta != null && s.delta !== 0)
      ? `${s.delta > 0 ? '+' : ''}${s.delta} pts since last sync`
      : hasScore ? 'Just calculated' : 'Send your first payment to build';
    const revenueSub = agg.growthPct != null
      ? `${agg.growthPct > 0 ? '+' : ''}${agg.growthPct}% vs last month`
      : agg.monthlyRevenue ? 'Based on Squad inflows' : 'No inflows yet';

    kpis.innerHTML = '';
    kpis.appendChild(KpiCard({
      iconName: 'speedometer2', iconBg: '#E8F4EE', iconColor: '#0B6E4F', label: 'TradeScore',
      value: s?.score ?? '—', sub: deltaSub, accent: '#0B6E4F',
      onClick: () => navigate('#/app/score'),
    }));
    kpis.appendChild(KpiCard({
      iconName: 'wallet2', iconBg: '#E5F9F0', iconColor: '#27AE60', label: 'Monthly revenue',
      value: agg.monthlyRevenue ? fmt(agg.monthlyRevenue) : '—',
      sub: revenueSub, accent: '#27AE60',
    }));
    kpis.appendChild(KpiCard({
      iconName: 'arrow-left-right', iconBg: '#E8F4EE', iconColor: '#1F8A65', label: 'Transactions',
      value: agg.transactions ?? 0, sub: 'all time', accent: '#1F8A65',
    }));
    kpis.appendChild(KpiCard({
      iconName: 'people', iconBg: '#EFEDFE', iconColor: '#6C5CE7', label: 'Unique customers',
      value: agg.uniqueCustomers ?? 0,
      sub: 'distinct senders', accent: '#6C5CE7',
    }));
  }
  renderKpis();
  onScoreUpdated(() => renderKpis());

  // ── Wallet card (real balance + send-money) ───────────────
  const walletHost = el('div');
  root.appendChild(walletHost);
  function renderWalletCard() {
    walletHost.innerHTML = '';
    walletHost.appendChild(buildWalletCard());
  }
  renderWalletCard();
  onTxsUpdated(() => renderWalletCard());

  root.appendChild(kpis);

  // ── Simulate-payment card (demo moment) ───────────────────
  const sim = buildSimulateCard();
  if (sim) root.appendChild(sim);

  // ── Two-column main ───────────────────────────────────────
  const grid = el('div', { class: 'grid lg:grid-cols-3 gap-6' });

  // Left column (2/3)
  const left = el('div', { class: 'lg:col-span-2 space-y-6' });

  // AI Insight banner
  left.appendChild(buildAiInsightBanner(navigate));

  // Revenue chart — always render. The card itself decides whether to draw
  // the line (≥ 2 months of real data) or show a "waiting for more months"
  // empty state, instead of disappearing entirely.
  left.appendChild(buildRevenueCard());

  // Recent transactions with categories
  left.appendChild(buildRecentTxs(navigate));

  grid.appendChild(left);

  // Right column (1/3). Cards that make user-specific claims only render
  // once there's enough live data to back them. Otherwise the column stays
  // empty so we don't show fabricated alerts or forecasts to a new user.
  const right = el('div', { class: 'space-y-6' });
  function renderRight() {
    right.innerHTML = '';
    const liveScore = getScore();
    const hasData = (liveScore?.aggregates?.inflows || 0) >= 2;
    if (hasData) {
      right.appendChild(buildLoanOfferCard(navigate));
      right.appendChild(buildAlertsCard());
      right.appendChild(buildForecastCard());
    } else {
      right.appendChild(buildEmptyStateCard(navigate));
    }
  }
  renderRight();
  // Rebuild when score changes (new tier eligibility) or when Claude finishes
  // generating fresh narratives for the loan-why and alert bodies.
  onScoreUpdated(() => renderRight());
  onInsightsUpdated(() => renderRight());
  grid.appendChild(right);

  root.appendChild(grid);

  return root;
}

// ── KPI ────────────────────────────────────────────────────────
function KpiCard({ iconName, iconBg = '#E8F4EE', iconColor = '#0B6E4F', label, value, sub, accent, onClick }) {
  const card = el('div', {
    class: 'card p-5 ' + (onClick ? 'card-hover cursor-pointer' : ''),
    onClick,
  });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-3' },
    el('div', {
      class: 'w-10 h-10 rounded-xl flex items-center justify-center',
      style: { background: iconBg, color: iconColor, fontSize: '17px' },
    }, icon(iconName)),
    onClick ? el('span', { class: 'text-ink-3', style: { fontSize: '13px' } }, icon('arrow-right')) : null,
  ));
  card.appendChild(el('div', { class: 'text-[10.5px] uppercase tracking-[0.1em] text-ink-3 font-bold' }, label));
  const v = el('div', {
    class: 'font-display text-[24px] md:text-[26px] font-extrabold text-ink-1 mt-1',
    style: { letterSpacing: '-0.025em' },
  }, '0');
  card.appendChild(v);
  card.appendChild(el('div', { class: 'text-[11.5px] mt-1 font-medium', style: { color: accent } }, sub));

  // Animate counter if value is a number
  if (typeof value === 'number') {
    animate({ to: value, duration: 1000, onUpdate: n => v.textContent = Math.round(n).toLocaleString() });
  } else {
    v.textContent = String(value);
  }
  return card;
}

// ── AI Insight banner ──────────────────────────────────────────
// Now reads live factors when present. Re-renders on score updates.
function buildAiInsightBanner(navigate) {
  const card = el('div', {
    class: 'rounded-2xl p-6 md:p-7 relative overflow-hidden',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 12px 32px rgba(2, 43, 35, 0.15)',
    },
  });
  card.appendChild(el('div', {
    class: 'absolute rounded-full',
    style: { width: '260px', height: '260px', top: '-90px', right: '-80px',
             background: 'radial-gradient(circle, rgba(232,255,139,0.18), transparent 70%)' },
  }));
  const inner = el('div', { class: 'relative z-10' });
  card.appendChild(inner);

  function render() {
    inner.innerHTML = '';
    const ins = buildLiveInsight();
    const claude = getInsights()?.payload?.insight;
    // If Claude has generated a narrative for the current score state, use it.
    // Otherwise fall back to the templated insight we already built.
    if (claude && claude.headline && Array.isArray(claude.body)) {
      ins.headline = claude.headline;
      ins.body = claude.body;
    }

    inner.appendChild(el('div', { class: 'flex items-center gap-2 mb-4' },
      el('div', {
        class: 'w-8 h-8 rounded-full flex items-center justify-center',
        style: { background: 'rgba(232,255,139,0.16)', color: '#E8FF8B', fontSize: '14px' },
      }, icon('stars')),
      el('div', { class: 'text-[11px] font-bold uppercase tracking-[0.18em]', style: { color: '#E8FF8B' } },
        'AI INSIGHT · GENERATED LIVE'),
    ));

    inner.appendChild(el('h3', {
      class: 'font-display text-white text-[22px] md:text-[26px] font-extrabold leading-tight',
      style: { letterSpacing: '-0.02em' },
    }, ins.headline));

    const body = el('div', { class: 'mt-3 space-y-2' });
    ins.body.forEach(t => body.appendChild(el('p', {
      class: 'text-[13.5px] leading-relaxed ai-text',
      style: { color: 'rgba(255,255,255,0.78)' },
      html: t.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#E8FF8B;">$1</strong>'),
    })));
    inner.appendChild(body);

    inner.appendChild(el('div', { class: 'flex flex-wrap items-center gap-3 mt-5' },
      el('button', {
        class: 'btn btn-lime !py-2.5 !px-4 !text-[13px]',
        onClick: () => navigate('#/app/score'),
      }, 'See full breakdown', icon('arrow-right')),
      el('button', {
        class: 'btn !py-2.5 !px-4 !text-[13px] text-white border border-white/30 hover:bg-white/10',
        onClick: () => navigate('#/app/assistant'),
      }, icon('chat-square-quote'), 'Ask follow-up'),
      el('div', {
        class: 'ml-auto text-[11px]',
        style: { color: 'rgba(232,255,139,0.65)' },
      }, `Confidence: ${Math.round(ins.confidence * 100)}%`),
    ));
  }
  render();
  onScoreUpdated(() => render());
  onInsightsUpdated(() => render());
  return card;
}

// Generates the headline + body lines from live score data when available,
// falling back to the mock generator otherwise.
function buildLiveInsight() {
  const s = getScore();
  const trader = getUser();
  const firstName = trader.firstName || '';

  // No score yet OR no score data at all — show an empty-state insight.
  // We intentionally do NOT fall back to generateScoreInsight() because that
  // references the now-null TRADER mock fields and renders "TradeScore of null".
  if (!s || s.score == null || !s.factors?.length) {
    return {
      headline: firstName
        ? `Welcome, ${firstName}. Your score builds itself.`
        : 'Welcome. Your score builds itself.',
      body: [
        `You don't have a TradeScore yet — that's normal for a brand-new account. Every payment your customers send to your Squad virtual account becomes a data point.`,
        `After **3 payments** you'll see a starter score. After **30 days of activity**, all 5 factors light up and you unlock loan offers.`,
        `Use the **Demo: simulate an inbound payment** card above to send a test payment and watch your first TradeScore appear in real time.`,
      ],
      delta: null,
      confidence: 1,
    };
  }

  const factors = [...s.factors];
  const top  = factors.slice().sort((a, b) => b.value - a.value)[0];
  const weak = factors.slice().sort((a, b) => a.value - b.value)[0];
  const agg = s.aggregates || {};

  const body = [];
  const txN = agg.transactions || 0;
  const uN  = agg.uniqueCustomers || 0;
  body.push(`${trader.firstName}, your TradeScore of ${s.score} reflects ${txN} ${txN === 1 ? 'transaction' : 'transactions'} across ${uN} unique ${uN === 1 ? 'payer' : 'payers'} on your Squad virtual account.`);
  if (top)  body.push(`Your strongest factor is **${top.label}** (${top.value}/100) — ${top.desc.toLowerCase()}.`);
  if (weak && weak.label !== top?.label) {
    const gain = Math.min(95, weak.value + 8) - weak.value;
    body.push(`The biggest lift remaining is **${weak.label}** (${weak.value}/100). Improving it by ${gain} points would meaningfully shift your score.`);
  }

  return {
    headline: s.score >= 720 ? `You're tracking in the top tier — ${s.score}/850.`
            : s.score >= 600 ? `Solid foundation at ${s.score}/850 — room to climb.`
            : `Early days at ${s.score}/850 — let's build it up.`,
    body,
    delta: s.delta,
    confidence: 0.85,
  };
}

// ── Revenue chart ──────────────────────────────────────────────
// Buckets live inflow transactions by calendar month, then fits a linear
// regression to project the next 2 months. Re-renders on every tx update.
function buildRevenueCard() {
  const card = el('div', { class: 'card p-6' });
  const header = el('div', { class: 'flex items-center justify-between mb-1' },
    el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep', style: { letterSpacing: '-0.02em' } }, 'Revenue trend'),
    el('div', { class: 'flex items-center gap-2', 'data-rev-chips': '1' }),
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'text-[12.5px] text-ink-3 mb-5' }, 'Aggregated from your Squad transaction history'));
  const chartHost = el('div');
  card.appendChild(chartHost);

  const render = () => {
    const { series, labels, realLen, growthPct } = buildRevenueSeries();

    // Chips
    const chipsHost = header.querySelector('[data-rev-chips]');
    chipsHost.innerHTML = '';
    if (growthPct != null) {
      const positive = growthPct >= 0;
      chipsHost.appendChild(el('span', {
        class: 'chip',
        style: { background: positive ? '#E5F9F0' : '#FCE8E8', color: positive ? '#27AE60' : '#D43E3E' },
      }, icon(positive ? 'arrow-up-short' : 'arrow-down-short'), `${positive ? '+' : ''}${growthPct}%`));
    }
    chipsHost.appendChild(el('span', {
      class: 'chip',
      style: { background: '#F5F5F0', color: '#4A5C56' },
    }, `${realLen} ${realLen === 1 ? 'month' : 'months'}`));

    chartHost.innerHTML = '';
    // Need at least 2 months of real data to draw a line (and project a forecast).
    if (realLen < 2) {
      chartHost.appendChild(el('div', {
        class: 'p-6 text-center rounded-xl border border-dashed border-line text-[13px] text-ink-2',
      },
        el('div', { class: 'mb-1 font-semibold text-ink-1' },
          realLen === 1 ? 'Your first month is in progress' : 'No revenue history yet'),
        el('div', {},
          realLen === 1
            ? 'A trend line appears once you have payments spanning at least two calendar months.'
            : 'Send your first payment to start building your revenue history.'),
      ));
      return;
    }
    chartHost.appendChild(buildRevenueChart(series, labels, realLen));
  };
  render();
  onTxsUpdated(() => render());
  return card;
}

// Returns { series, labels, realLen, growthPct } from live transactions.
// `series` is an array of monthly inflow totals (naira) followed by 2 forecast
// values. `labels` are the matching short month names; forecast labels get a *
// suffix. `realLen` is how many entries are real (the rest are forecast).
function buildRevenueSeries() {
  const txs = getTxs();
  const inflows = txs.filter(t => t.type === 'in' && t.occurred_at);

  // Bucket by year-month
  const byMonth = new Map();
  for (const t of inflows) {
    const d = new Date(t.occurred_at);
    if (isNaN(d)) continue;
    const key = d.getFullYear() * 12 + d.getMonth();
    byMonth.set(key, (byMonth.get(key) || 0) + t.amount);
  }

  if (byMonth.size === 0) return { series: [], labels: [], realLen: 0, growthPct: null };

  const sortedKeys = [...byMonth.keys()].sort((a, b) => a - b);
  // Fill any gap months with 0 between first and last so the chart x-axis is continuous.
  const filled = [];
  for (let k = sortedKeys[0]; k <= sortedKeys[sortedKeys.length - 1]; k++) {
    filled.push({ key: k, value: byMonth.get(k) || 0 });
  }
  const series = filled.map(b => b.value);
  const labels = filled.map(b => monthShort(b.key));

  // 2-month linear forecast (only when we have at least 2 months of data)
  const realLen = series.length;
  if (realLen >= 2) {
    const xs = series.map((_, i) => i);
    const xm = xs.reduce((s, v) => s + v, 0) / xs.length;
    const ym = series.reduce((s, v) => s + v, 0) / series.length;
    const num = xs.reduce((s, x, i) => s + (x - xm) * (series[i] - ym), 0);
    const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0) || 1;
    const slope = num / den;
    const intercept = ym - slope * xm;
    for (let i = 1; i <= 2; i++) {
      const projected = Math.max(0, Math.round(intercept + slope * (realLen + i - 1)));
      series.push(projected);
      labels.push(monthShort(filled[filled.length - 1].key + i) + '*');
    }
  }

  // MoM growth: last real vs previous real
  const growthPct = realLen >= 2
    ? Math.round(((series[realLen - 1] - series[realLen - 2]) / Math.max(1, series[realLen - 2])) * 1000) / 10
    : null;

  return { series, labels, realLen, growthPct };
}

function monthShort(yearMonthKey) {
  const month = ((yearMonthKey % 12) + 12) % 12;
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month];
}

function buildRevenueChart(series, labels, realLen) {
  const W = 720, H = 240, PAD_X = 20, PAD_Y = 30;
  const max = Math.max(...series) * 1.08;
  const stepX = (W - PAD_X * 2) / (series.length - 1);

  const points = series.map((v, i) => {
    const x = PAD_X + i * stepX;
    const y = H - PAD_Y - (v / max) * (H - PAD_Y * 2);
    return [x, y];
  });
  const realPts = points.slice(0, realLen);
  const fcPts   = points.slice(realLen - 1); // include last real point
  const realLine = realPts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const fillPath = realLine + ` L${realPts[realPts.length - 1][0].toFixed(1)} ${H - PAD_Y} L${realPts[0][0].toFixed(1)} ${H - PAD_Y} Z`;
  const fcLine   = fcPts.map((p, i)  => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  const wrap = el('div', { class: 'w-full' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 28}`);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';
  svg.innerHTML = `
    <defs>
      <linearGradient id="revFill2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0B6E4F" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#0B6E4F" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${[1,2,3].map(i => {
      const y = PAD_Y + ((H - PAD_Y * 2) / 4) * i;
      return `<line x1="${PAD_X}" y1="${y}" x2="${W - PAD_X}" y2="${y}" stroke="#E2E8E4" stroke-dasharray="4 6" />`;
    }).join('')}
    <path d="${fillPath}" fill="url(#revFill2)" />
    <path d="${realLine}" fill="none" stroke="#0B6E4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="2000" stroke-dashoffset="2000">
      <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="1.4s" fill="freeze" />
    </path>
    <path d="${fcLine}" fill="none" stroke="#27AE60" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="6 6" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="1.4s" dur="0.4s" fill="freeze" />
    </path>
    ${points.map((p, i) => `
      <circle cx="${p[0]}" cy="${p[1]}" r="${i === realLen - 1 ? 6 : 4}"
        fill="${i >= realLen ? '#E8FF8B' : (i === realLen - 1 ? '#E8FF8B' : '#0B6E4F')}"
        stroke="#fff" stroke-width="2" />
    `).join('')}
    ${labels.map((m, i) => {
      const x = PAD_X + i * stepX;
      const isFc = i >= realLen;
      return `<text x="${x}" y="${H + 18}" text-anchor="middle"
        style="font-family: Inter, sans-serif; font-size: 11px; font-weight: 600; fill: ${isFc ? '#9AA8A2' : '#4A5C56'};">${m}</text>`;
    }).join('')}
  `;
  wrap.appendChild(svg);

  const legend = el('div', { class: 'flex items-center gap-5 mt-4 text-[11.5px]' },
    el('span', { class: 'flex items-center gap-2' },
      el('span', { class: 'w-3 h-3 rounded-full', style: { background: '#0B6E4F' } }),
      el('span', { class: 'text-ink-2 font-semibold' }, 'Actual'),
    ),
    el('span', { class: 'flex items-center gap-2' },
      el('span', { class: 'w-3 h-3 rounded-full', style: { background: '#E8FF8B', border: '2px solid #27AE60' } }),
      el('span', { class: 'text-ink-2 font-semibold' }, 'AI forecast'),
    ),
  );
  wrap.appendChild(legend);
  return wrap;
}

// ── Recent transactions ────────────────────────────────────────
function buildRecentTxs(navigate) {
  const card = el('div', { class: 'card p-6' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4' },
    el('div', {},
      el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep', style: { letterSpacing: '-0.02em' } }, 'Recent transactions'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' }, 'Live from your Squad virtual account · AI auto-tagged'),
    ),
    el('button', {
      class: 'btn btn-ghost !py-2 !px-4 !text-[12.5px]',
      onClick: () => navigate('#/app/transactions'),
    }, 'View all', icon('arrow-right')),
  ));
  const list = el('div', { class: 'divide-y divide-line' });
  const renderList = (txs) => {
    list.innerHTML = '';
    const slice = (txs || []).slice(0, 6);
    if (!slice.length) {
      list.appendChild(el('div', { class: 'py-8 text-center text-[13px] text-ink-3' },
        'No transactions yet. Use the "Simulate inbound payment" button above to send a test payment to your virtual account.'));
      return;
    }
    slice.forEach(tx => list.appendChild(TxRow(tx, { showCategory: true, categorize })));
  };
  renderList(getTxs());
  // Re-render whenever the store broadcasts a refresh
  onTxsUpdated((txs) => renderList(txs));
  card.appendChild(list);
  return card;
}

// ── Simulate payment (demo moment) ─────────────────────────────
function buildSimulateCard() {
  const trader = getUser();
  if (!trader.squadWallet) return null; // hidden if not signed in / no VA

  const card = el('div', {
    class: 'card p-5 flex items-center gap-4 fade-up',
    style: { background: 'linear-gradient(135deg, #FFF8DA 0%, #FFEFE5 100%)', border: '1px solid #F0DA9A' },
  });
  card.appendChild(el('div', {
    class: 'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
    style: { background: '#022B23', color: '#E8FF8B', fontSize: '20px' },
  }, icon('lightning-charge-fill')));
  card.appendChild(el('div', { class: 'flex-1 min-w-0' },
    el('div', { class: 'text-[13.5px] font-extrabold text-squad-deep' }, 'Demo: simulate an inbound payment'),
    el('div', { class: 'text-[12px] text-ink-2 mt-0.5' },
      `Triggers a sandbox payment to ${trader.virtualAccountBank || 'GTBank'} · ${trader.squadWallet} so you can watch the score tick up live.`),
  ));
  const amountInput = el('input', {
    class: 'input !w-[110px] !py-2.5 !text-[13px]',
    type: 'number', min: '100', max: '500000', value: '5000', placeholder: '₦',
  });
  card.appendChild(amountInput);
  const btn = el('button', { class: 'btn btn-primary !py-2.5 !px-4 !text-[13px]' }, 'Send ₦', icon('send'));
  card.appendChild(btn);

  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const original = btn.innerHTML;
    btn.innerHTML = '';
    btn.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
    try {
      const naira = Math.max(100, Math.min(500000, Number(amountInput.value) || 5000));
      await api.simulatePayment(naira);
      // Give Squad a beat to settle, then refresh
      setTimeout(() => refreshTxsFromServer(), 800);
      btn.innerHTML = original;
      btn.style.background = '#27AE60';
      setTimeout(() => { btn.style.background = ''; }, 1500);
    } catch (e) {
      console.error('[simulate]', e);
      btn.innerHTML = '';
      btn.appendChild(el('span', {}, 'Failed'));
      btn.style.background = '#D43E3E';
      setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 2000);
    } finally {
      busy = false;
    }
  });
  return card;
}

// Builds the "Live · synced N min ago" label from the real timestamp written
// to localStorage each time refreshTxsFromServer succeeds.
function syncLabel() {
  const iso = getLastSync();
  if (!iso) return 'Connecting to Squad…';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10)   return 'Live · just synced with Squad';
  if (seconds < 60)   return `Live · synced ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)   return `Live · synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `Live · synced ${hours}h ago`;
}

// ── Wallet card (live balance + Send money) ────────────────────
// Computes available balance locally from getTxs() so it stays in sync with
// optimistic updates and SSE pushes. The backend's /api/wallet endpoint is
// authoritative on a reload, but for in-session UI this is faster.
function buildWalletCard() {
  const { available, inflow, outflow } = getWalletBalance();

  const card = el('div', {
    class: 'rounded-2xl p-6 lg:p-7 flex flex-col lg:flex-row lg:items-end gap-5 fade-up-1',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 12px 32px rgba(2, 43, 35, 0.18)',
    },
  });

  const left = el('div', { class: 'flex-1 min-w-0' },
    el('div', { class: 'text-[10.5px] font-bold uppercase tracking-[0.2em]', style: { color: '#E8FF8B' } },
      'Wallet balance'),
    el('div', {
      class: 'font-display font-extrabold text-white mt-1',
      style: { fontSize: '40px', letterSpacing: '-0.03em', lineHeight: '1.05' },
    }, available > 0 ? fmt(available) : fmt(0)),
    el('div', { class: 'text-[12.5px] mt-1.5', style: { color: 'rgba(255,255,255,0.7)' } },
      `${fmt(inflow)} in · ${fmt(outflow)} out · all time`),
  );
  card.appendChild(left);

  const right = el('div', { class: 'flex flex-wrap gap-2.5' });
  const sendBtn = el('button', {
    class: 'btn btn-lime !py-3 !px-5 !text-[13.5px]',
    onClick: () => showSendMoneyFlow(),
  }, icon('send'), 'Send money');
  if (available <= 0) {
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.45';
    sendBtn.style.cursor = 'not-allowed';
    sendBtn.title = 'Receive a payment to enable Send money';
  }
  right.appendChild(sendBtn);
  right.appendChild(el('button', {
    class: 'btn !py-3 !px-5 !text-[13.5px] text-white border border-white/30 hover:bg-white/10',
    onClick: () => showWithdrawalHistory(),
  }, icon('clock-history'), 'History'));
  card.appendChild(right);

  if (available <= 0) {
    card.appendChild(el('div', {
      class: 'text-[11px] mt-1',
      style: { color: 'rgba(232,255,139,0.75)' },
    }, 'Receive a payment to enable Send money'));
  }
  return card;
}

// Three-stage modal — bank pick → confirm → success — identical pattern to
// loan disbursement. Reuses the Squad account-lookup, then hits our wallet-
// debiting /api/withdrawals endpoint.
function showSendMoneyFlow() {
  const overlay = el('div', {
    class: 'fixed inset-0 z-50 flex items-center justify-center fade-in p-6',
    style: { background: 'rgba(2, 43, 35, 0.55)', backdropFilter: 'blur(6px)' },
  });
  const close = () => {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const modal = el('div', {
    class: 'card slide-up relative',
    style: { padding: '32px', maxWidth: '480px', width: '100%' },
  });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const { available } = getWalletBalance();

  const state = {
    available,
    amount: Math.min(available, 5000),
    bank_code: '000013', bank_name: 'GTBank',
    account_number: '', account_name: '',
    nip_ref: '', payout_ref: '', demo: false,
  };

  let banksPromise = api.loans.banks().then(r => r.banks).catch(() => []);
  renderCollect();

  async function renderCollect() {
    modal.innerHTML = '';
    modal.appendChild(stageHeader('Send money',
      `Available balance: ${fmt(state.available)}. Funds go from your Squad-backed wallet to any Nigerian bank account.`));

    const banks = await banksPromise;
    if (banks.length && !banks.find(b => b.code === state.bank_code)) {
      state.bank_code = banks[0].code;
      state.bank_name = banks[0].name;
    }

    modal.appendChild(el('label', { class: 'label mt-1' }, 'Amount (₦)'));
    const amtInput = el('input', {
      class: 'input', type: 'number', min: '100', max: String(state.available),
      step: '100', value: String(state.amount),
    });
    amtInput.addEventListener('input', () => {
      const n = parseInt(amtInput.value, 10);
      state.amount = isNaN(n) ? 0 : n;
    });
    modal.appendChild(amtInput);

    modal.appendChild(el('label', { class: 'label mt-4' }, 'Bank'));
    const bankSelect = el('select', { class: 'input' });
    banks.forEach(b => {
      const opt = el('option', { value: b.code }, b.name);
      if (b.code === state.bank_code) opt.selected = true;
      bankSelect.appendChild(opt);
    });
    bankSelect.addEventListener('change', () => {
      state.bank_code = bankSelect.value;
      state.bank_name = banks.find(b => b.code === state.bank_code)?.name || '';
    });
    modal.appendChild(bankSelect);

    modal.appendChild(el('label', { class: 'label mt-4' }, 'Account number'));
    const acctInput = el('input', {
      class: 'input', placeholder: '0123456789', inputmode: 'numeric', maxlength: '10',
    });
    acctInput.value = state.account_number;
    modal.appendChild(acctInput);

    const err = el('div', {
      class: 'mt-3 text-[12.5px] rounded-xl p-3 hidden',
      style: { background: '#FCE8E8', color: '#9A1F1F' },
    });
    modal.appendChild(err);

    const next = el('button', {
      class: 'btn btn-primary w-full mt-5 !py-3.5',
    }, 'Look up account', icon('arrow-right'));
    modal.appendChild(next);

    modal.appendChild(el('button', {
      class: 'btn btn-ghost w-full mt-2 !py-3 !text-[13px]', onClick: close,
    }, 'Cancel'));

    next.addEventListener('click', async () => {
      err.classList.add('hidden');
      const acct = acctInput.value.trim();
      if (!state.amount || state.amount < 100) {
        err.textContent = 'Amount must be at least ₦100.';
        err.classList.remove('hidden'); return;
      }
      if (state.amount > state.available) {
        err.textContent = `Amount exceeds your wallet balance of ${fmt(state.available)}.`;
        err.classList.remove('hidden'); return;
      }
      if (!/^\d{10}$/.test(acct)) {
        err.textContent = 'Account number must be 10 digits.';
        err.classList.remove('hidden'); return;
      }
      state.account_number = acct;
      next.disabled = true;
      next.innerHTML = '';
      next.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
      next.appendChild(el('span', {}, 'Looking up…'));
      try {
        const lookup = await api.loans.lookupAccount({
          bank_code: state.bank_code, account_number: state.account_number,
        });
        const name = lookup?.data?.account_name || lookup?.account_name;
        if (!name) throw new Error('Squad returned no account name');
        state.account_name = String(name);
        renderConfirm();
      } catch (e) {
        next.disabled = false;
        next.innerHTML = '';
        next.appendChild(el('span', {}, 'Look up account'));
        next.appendChild(icon('arrow-right'));
        err.textContent = e?.data?.error || e.message || 'Lookup failed';
        err.classList.remove('hidden');
      }
    });
  }

  function renderConfirm() {
    modal.innerHTML = '';
    modal.appendChild(stageHeader('Confirm transfer', 'Verify the recipient before we move funds.'));

    const card = el('div', { class: 'mt-2 p-5 rounded-2xl', style: { background: '#022B23' } });
    card.appendChild(el('div', { class: 'text-[10.5px] font-bold uppercase tracking-[0.18em]',
      style: { color: '#E8FF8B' } }, 'Sending to'));
    card.appendChild(el('div', { class: 'font-display text-white text-[22px] font-extrabold mt-1' },
      state.account_name));
    card.appendChild(el('div', {
      class: 'text-[12.5px] mt-1', style: { color: 'rgba(255,255,255,0.7)' },
    }, `${state.bank_name} · ${state.account_number}`));
    modal.appendChild(card);

    const sum = el('div', {
      class: 'mt-4 p-4 rounded-xl space-y-2', style: { background: '#F5F5F0' },
    });
    sum.appendChild(rowKvL('Amount', fmt(state.amount)));
    sum.appendChild(rowKvL('Source', 'Your TradeScore wallet'));
    sum.appendChild(rowKvL('Remaining balance', fmt(state.available - state.amount)));
    modal.appendChild(sum);

    const err = el('div', {
      class: 'mt-3 text-[12.5px] rounded-xl p-3 hidden',
      style: { background: '#FCE8E8', color: '#9A1F1F' },
    });
    modal.appendChild(err);

    const confirm = el('button', {
      class: 'btn btn-primary w-full mt-5 !py-3.5',
    }, icon('lightning-charge-fill'), 'Send now');
    modal.appendChild(confirm);

    modal.appendChild(el('button', {
      class: 'btn btn-ghost w-full mt-2 !py-3 !text-[13px]', onClick: renderCollect,
    }, icon('arrow-left'), 'Back'));

    confirm.addEventListener('click', async () => {
      err.classList.add('hidden');
      confirm.disabled = true;
      confirm.innerHTML = '';
      confirm.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
      confirm.appendChild(el('span', {}, 'Sending ' + fmt(state.amount) + '…'));
      try {
        const resp = await api.withdrawals.apply({
          amount_kobo: state.amount * 100,
          bank_code: state.bank_code,
          account_number: state.account_number,
          account_name: state.account_name,
        });
        state.nip_ref    = resp.withdrawal?.nip_ref || '';
        state.payout_ref = resp.withdrawal?.payout_ref || '';
        state.demo       = !!resp.demo_fallback;
        refreshTxsFromServer();
        renderSuccess();
      } catch (e) {
        confirm.disabled = false;
        confirm.innerHTML = '';
        confirm.appendChild(icon('lightning-charge-fill'));
        confirm.appendChild(el('span', {}, 'Try again'));
        err.textContent = e?.data?.error || e.message || 'Transfer failed';
        err.classList.remove('hidden');
      }
    });
  }

  function renderSuccess() {
    modal.innerHTML = '';
    modal.appendChild(el('div', {
      class: 'w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center pop',
      style: { background: 'linear-gradient(135deg, #E8FF8B, #27AE60)', boxShadow: '0 8px 28px rgba(39,174,96,0.35)' },
    }, el('span', { class: 'text-white', style: { fontSize: '40px' } }, icon('check-lg'))));
    modal.appendChild(el('h2', {
      class: 'font-display text-[26px] font-extrabold text-squad-deep text-center',
      style: { letterSpacing: '-0.025em' },
    }, 'Sent!'));
    if (state.demo) {
      modal.appendChild(el('div', { class: 'flex justify-center mt-2' },
        el('span', {
          class: 'chip',
          style: { background: '#FFF8DA', color: '#7B5500', border: '1px solid #F0DA9A' },
        }, icon('shield-check'), 'Sandbox demo · merchant wallet not funded'),
      ));
    }
    modal.appendChild(el('p', {
      class: 'text-[14px] text-ink-2 text-center mt-2 leading-relaxed',
    }, `${fmt(state.amount)} on its way to ${state.account_name}.`));

    const detail = el('div', { class: 'mt-6 p-4 rounded-xl space-y-2', style: { background: '#F5F5F0' } });
    detail.appendChild(rowKvL('Recipient', `${state.bank_name} · ${state.account_number}`));
    if (state.nip_ref)    detail.appendChild(rowKvL('NIP reference', state.nip_ref));
    if (state.payout_ref) detail.appendChild(rowKvL('Transaction ref', state.payout_ref));
    modal.appendChild(detail);

    modal.appendChild(el('button', {
      class: 'btn btn-primary w-full mt-6 !py-3.5', onClick: close,
    }, 'Done'));
  }
}

// Modal: list past withdrawals with NIP references.
function showWithdrawalHistory() {
  const overlay = el('div', {
    class: 'fixed inset-0 z-50 flex items-center justify-center fade-in p-6',
    style: { background: 'rgba(2, 43, 35, 0.55)', backdropFilter: 'blur(6px)' },
  });
  const close = () => {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const modal = el('div', {
    class: 'card slide-up relative',
    style: { padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '80vh', overflow: 'auto' },
  });
  modal.appendChild(stageHeader('Withdrawal history', 'Every transfer from your TradeScore wallet to your bank.'));
  const list = el('div', { class: 'space-y-2' },
    el('div', { class: 'p-4 text-center text-[13px] text-ink-3' }, 'Loading…'),
  );
  modal.appendChild(list);
  modal.appendChild(el('button', {
    class: 'btn btn-ghost w-full mt-4 !py-3', onClick: close,
  }, 'Close'));
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  api.withdrawals.list().then(resp => {
    const items = resp?.withdrawals || [];
    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(el('div', {
        class: 'p-6 text-center rounded-xl border border-dashed border-line text-[13px] text-ink-2',
      }, 'No withdrawals yet.'));
      return;
    }
    items.forEach(w => {
      const tone = w.status === 'disbursed'      ? { bg: '#E5F9F0', fg: '#27AE60', label: 'Sent' }
                : w.status === 'demo_disbursed'  ? { bg: '#FFF8DA', fg: '#7B5500', label: 'Sandbox demo' }
                : w.status === 'failed'          ? { bg: '#FCE8E8', fg: '#D43E3E', label: 'Failed' }
                : { bg: '#FFF8DA', fg: '#B58400', label: 'Pending' };
      list.appendChild(el('div', { class: 'flex flex-wrap items-center gap-3 p-3 rounded-xl border border-line' },
        el('div', {
          class: 'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '16px' },
        }, icon('send')),
        el('div', { class: 'flex-1 min-w-0' },
          el('div', { class: 'flex items-center gap-2 flex-wrap' },
            el('span', { class: 'text-[13.5px] font-bold text-ink-1' }, fmt(Math.round((w.amount_kobo || 0) / 100))),
            el('span', { class: 'chip', style: { background: tone.bg, color: tone.fg } }, tone.label),
          ),
          el('div', { class: 'text-[11px] text-ink-3 mt-0.5 break-all' },
            `${w.account_name} · ${w.bank_code} · ${w.account_number}` +
            (w.nip_ref ? ` · NIP ${w.nip_ref}` : '') +
            (w.disbursed_at ? ` · ${formatShortDate2(w.disbursed_at)}` : '')),
        ),
      ));
    });
  }).catch(() => {
    list.innerHTML = '';
    list.appendChild(el('div', {
      class: 'p-4 rounded-xl text-[13px]',
      style: { background: '#FCE8E8', color: '#9A1F1F' },
    }, 'Could not load withdrawal history.'));
  });
}

function stageHeader(title, sub) {
  return el('div', { class: 'mb-5' },
    el('h2', {
      class: 'font-display text-[22px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, title),
    el('p', { class: 'text-[13px] text-ink-2 mt-1' }, sub),
  );
}

function rowKvL(k, v) {
  return el('div', { class: 'flex items-center justify-between text-[13px] gap-3' },
    el('span', { class: 'text-ink-2 flex-shrink-0' }, k),
    el('span', { class: 'font-extrabold text-ink-1 text-right break-all' }, v),
  );
}

function formatShortDate2(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

// ── Empty state (new-user right column) ────────────────────────
function buildEmptyStateCard(navigate) {
  const card = el('div', {
    class: 'card p-6 fade-up text-center',
  });
  card.appendChild(el('div', {
    class: 'w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center',
    style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '20px' },
  }, icon('stars')));
  card.appendChild(el('h3', {
    class: 'font-display text-[16px] font-extrabold text-squad-deep',
    style: { letterSpacing: '-0.02em' },
  }, 'Your dashboard is warming up'));
  card.appendChild(el('p', {
    class: 'text-[12.5px] text-ink-2 mt-1.5 leading-relaxed',
  }, 'Smart alerts, loan offers, and revenue forecasts unlock automatically as Squad payments land in your virtual account. Send a test payment to get started.'));
  card.appendChild(el('button', {
    class: 'btn btn-primary w-full mt-4 !py-2.5 !text-[13px]',
    onClick: () => navigate('#/app/transactions'),
  }, 'View transactions', icon('arrow-right')));
  return card;
}

// ── Loan offer ────────────────────────────────────────────────
// Computes a recommendation from the user's *live* monthly revenue (capped
// at the 18% safe-repayment ratio) and the cheapest tier their live score
// unlocks. Falls back to the static `recommendLoan` only if live data isn't
// available yet — which shouldn't happen since this card is gated behind
// `aggregates.inflows >= 2`.
function buildLoanOfferCard(navigate) {
  const liveScore = getScore();
  const agg = liveScore?.aggregates || {};
  const monthlyRevenue = agg.monthlyRevenue || 0;

  // Safe monthly repayment ≤ 18% of revenue (industry rule of thumb).
  // We assume a 60-day term, so loan principal ≈ 2× monthly repayment.
  const safeMonthly = Math.round(monthlyRevenue * 0.18);
  const recommendedRaw = Math.max(20_000, Math.round((safeMonthly * 2) / 5_000) * 5_000);

  // Find the cheapest tier we can use given the score AND that fits the amount.
  let tier = null;
  for (const t of LOAN_TIERS) {
    if (liveScore?.score != null && liveScore.score >= t.minScore && t.max >= recommendedRaw) {
      if (!tier || t.rateMonthly < tier.rateMonthly) tier = t;
    }
  }
  // If no eligible tier, fall back to whichever tier the score qualifies for.
  if (!tier && liveScore?.score != null) {
    tier = [...LOAN_TIERS].reverse().find(t => liveScore.score >= t.minScore) || null;
  }

  const amount = tier ? Math.min(recommendedRaw, tier.max) : recommendedRaw;
  const rate   = tier?.rateMonthly ?? 2.2;
  const term   = tier?.term ?? '60 days';

  const card = el('div', {
    class: 'rounded-2xl p-5 relative overflow-hidden',
    style: {
      background: 'linear-gradient(135deg, #E8FF8B 0%, #C5F362 100%)',
      boxShadow: '0 12px 28px rgba(232, 255, 139, 0.45)',
    },
  });
  card.appendChild(el('div', { class: 'flex items-center gap-2 mb-3' },
    el('span', { class: 'text-squad-deep', style: { fontSize: '14px' } }, icon('stars')),
    el('span', { class: 'text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-squad-deep' },
      'AI-recommended loan'),
  ));
  card.appendChild(el('div', {
    class: 'font-display text-[32px] font-extrabold text-squad-deep',
    style: { letterSpacing: '-0.025em' },
  }, fmt(amount)));
  card.appendChild(el('div', { class: 'text-[12.5px] text-squad-deep/80 -mt-0.5' },
    `${rate}% / month · ${term} term`));

  // Prefer Claude's "loan_why" copy when available; fall back to templated.
  const claudeWhy = getInsights()?.payload?.loan_why;
  const templatedWhy = monthlyRevenue > 0
    ? `Your monthly revenue averages ${fmt(monthlyRevenue)}. At this amount, repayment uses about ${Math.round((safeMonthly / monthlyRevenue) * 100)}% of revenue — within the safe 18% threshold.`
    : 'A starter offer based on your current TradeScore.';

  const why = el('div', { class: 'mt-4 p-3 rounded-xl bg-white/40 border border-white/60' });
  why.appendChild(el('div', { class: 'text-[10.5px] uppercase tracking-wider font-extrabold text-squad-deep mb-1' },
    'Why this amount?'));
  why.appendChild(el('p', { class: 'text-[12px] text-squad-deep/85 leading-relaxed' },
    claudeWhy || templatedWhy));
  card.appendChild(why);

  card.appendChild(el('button', {
    class: 'btn btn-dark w-full !py-3 mt-4 !text-[13px]',
    onClick: () => navigate('#/app/loans'),
  }, 'Continue', icon('arrow-right')));

  return card;
}

// ── Alerts ────────────────────────────────────────────────────
// Detects real patterns from the live transaction stream + score factors:
//   - opportunity: weak factor with a clear path to improve
//   - risk: outflow concentration over 50%
//   - opportunity: inflow spike (last 7d > 1.4x trailing 30d average)
//   - info: short streak fresh-account encouragement
function buildAlertsCard() {
  const card = el('div', { class: 'card p-6' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4' },
    el('h3', { class: 'font-display text-[16px] font-extrabold text-squad-deep', style: { letterSpacing: '-0.02em' } }, 'Smart alerts'),
    el('span', { class: 'chip', style: { background: '#E8F4EE', color: '#0B6E4F' } }, icon('stars'), 'AI'),
  ));
  const list = el('div', { class: 'space-y-3' });
  const alertIcon = {
    opportunity: 'lightning-charge-fill',
    risk: 'exclamation-triangle-fill',
    info: 'info-circle-fill',
  };
  buildLiveAlerts().forEach((a, i) => {
    const tone = a.kind === 'opportunity' ? { bg: '#E5F9F0', accent: '#27AE60' }
              : a.kind === 'risk'         ? { bg: '#FCE8E8', accent: '#D43E3E' }
              : { bg: '#FFF8DA', accent: '#B58400' };
    list.appendChild(el('div', {
      class: 'flex gap-3 p-3 rounded-xl',
      style: { background: tone.bg, animation: `fadeUp 0.5s ${0.1 + i * 0.07}s cubic-bezier(0.22,1,0.36,1) both` },
    },
      el('div', {
        class: 'flex-shrink-0 mt-0.5',
        style: { color: tone.accent, fontSize: '17px', lineHeight: '1' },
      }, icon(alertIcon[a.kind] || 'info-circle-fill')),
      el('div', {},
        el('div', { class: 'text-[12.5px] font-extrabold mb-0.5', style: { color: tone.accent } }, a.title),
        el('div', { class: 'text-[11.5px] text-ink-2 leading-relaxed' }, a.body),
      ),
    ));
  });
  card.appendChild(list);
  return card;
}

// Generates up to 3 prioritized alerts from live data. Returns at minimum
// one "score boost" alert (always actionable) plus any data-driven ones.
// When Claude has generated copy for the weak-factor alert (cached server-side),
// we use that body text. Outflow / inflow alerts stay deterministic.
function buildLiveAlerts() {
  const alerts = [];
  const score = getScore();
  const txs = getTxs();
  const insights = getInsights();
  const claudeAlertBodies = insights?.payload?.alert_bodies || [];
  const claudeSkeletons   = insights?.alert_skeletons || [];

  // (1) Weak-factor opportunity — always show if we have a score
  if (score?.factors?.length) {
    const weak = [...score.factors].sort((a, b) => a.value - b.value)[0];
    if (weak && weak.value < 80) {
      // Find Claude's body that matches this alert (kind + title pair); fall
      // back to templated copy if Claude hasn't been called yet.
      const skeletonIdx = claudeSkeletons.findIndex(
        s => s.kind === 'opportunity' && s.title.includes(weak.label)
      );
      const claudeBody = skeletonIdx >= 0 ? claudeAlertBodies[skeletonIdx] : null;
      alerts.push({
        kind: 'opportunity',
        title: `Boost your ${weak.label}`,
        body: claudeBody || `${weak.label} is currently ${weak.value}/100 — your single biggest lever. ${factorAdvice(weak.label)}`,
      });
    }
  }

  // (2) Outflow concentration risk — only if ≥2 outflows in last 30d
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = txs.filter(t => t.occurred_at && new Date(t.occurred_at).getTime() >= cutoff);
  const outflows = recent.filter(t => t.type === 'out');
  if (outflows.length >= 2) {
    const totalOut = outflows.reduce((s, t) => s + t.amount, 0);
    const byCat = {};
    outflows.forEach(t => {
      const c = categorize(t).category;
      byCat[c] = (byCat[c] || 0) + t.amount;
    });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const share = Math.round((topCat[1] / totalOut) * 100);
    if (share >= 50) {
      alerts.push({
        kind: 'risk',
        title: 'Outflow concentration',
        body: `${share}% of your outflows last 30 days went to ${topCat[0]}. Diversifying expense types strengthens your Payment Consistency factor.`,
      });
    }
  }

  // (3) Inflow spike — last 7 days > 1.4× the 30-day daily average
  const inflows = txs.filter(t => t.type === 'in' && t.occurred_at);
  if (inflows.length >= 5) {
    const now = Date.now();
    const last7 = inflows.filter(t => new Date(t.occurred_at).getTime() >= now - 7 * 86400000);
    const last30 = inflows.filter(t => new Date(t.occurred_at).getTime() >= now - 30 * 86400000);
    const avg7Daily  = last7.length  ? last7.reduce((s, t) => s + t.amount, 0)  / 7  : 0;
    const avg30Daily = last30.length ? last30.reduce((s, t) => s + t.amount, 0) / 30 : 0;
    if (avg30Daily > 0 && avg7Daily / avg30Daily >= 1.4) {
      const pct = Math.round(((avg7Daily / avg30Daily) - 1) * 100);
      alerts.push({
        kind: 'opportunity',
        title: 'Inflow spike detected',
        body: `Your daily inflows are running ${pct}% above the 30-day average. Good window to re-stock before the rhythm slows.`,
      });
    }
  }

  // (4) Empty-state info — at least one transaction needed to engage
  if (alerts.length === 0) {
    alerts.push({
      kind: 'info',
      title: 'Keep payments flowing',
      body: 'Once a few more payments land, real opportunity and risk alerts will appear here — based on patterns in your own cashflow.',
    });
  }

  return alerts.slice(0, 3);
}

function factorAdvice(label) {
  switch (label) {
    case 'Customer Diversity': return 'Encourage more unique customers to pay via your Squad QR — each new payer lifts the score.';
    case 'Account Longevity':  return 'This one only grows with time — your score will rise automatically each month you stay active.';
    case 'Payment Consistency': return 'Steadier weekly inflows lift this factor — promote your Squad QR so payments are predictable.';
    case 'Business Growth':    return 'Aim for a small uptick in monthly inflow vs. last month to push this factor higher.';
    case 'Transaction Volume': return 'Higher monthly inflow totals lift this directly. Larger transactions count for more.';
    default: return 'Sustained activity improves this factor.';
  }
}

// ── Forecast ──────────────────────────────────────────────────
// Re-projects the live monthly series 3 months out using the same linear
// regression as the revenue chart. Cards show projected ₦ + % vs. last month.
function buildForecastCard() {
  const { series, labels, realLen } = buildRevenueSeries();
  const lastReal = realLen ? series[realLen - 1] : 0;
  // Need at least 2 months of real data to extrapolate; otherwise show empty state.
  if (realLen < 2) {
    return el('div', { class: 'card p-6' },
      el('h3', { class: 'font-display text-[16px] font-extrabold text-squad-deep mb-1' }, 'Revenue forecast'),
      el('p', { class: 'text-[11.5px] text-ink-3 mb-3' }, 'AI projection · waiting for 2 months of data'),
      el('p', { class: 'text-[12px] text-ink-2' },
        'Forecasts unlock once you have payments spanning at least two calendar months.'),
    );
  }
  // Project 3 future months from the same regression used by the chart.
  const fc = projectForward(series.slice(0, realLen), 3);
  const months = [];
  let lastKey = null;
  for (let i = labels.length - 1; i >= 0; i--) {
    if (!labels[i].endsWith('*')) { lastKey = i; break; }
  }
  // Build month names for the next 3 months by name lookup
  const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const lastIdx = monthOrder.indexOf(labels[lastKey]);
  for (let i = 1; i <= 3; i++) months.push(monthOrder[(lastIdx + i) % 12]);
  const card = el('div', { class: 'card p-6' });
  card.appendChild(el('h3', {
    class: 'font-display text-[16px] font-extrabold text-squad-deep mb-1',
    style: { letterSpacing: '-0.02em' },
  }, 'Revenue forecast'));
  card.appendChild(el('p', { class: 'text-[11.5px] text-ink-3 mb-4' },
    'AI projection · linear regression on Squad data'));
  const list = el('div', { class: 'space-y-3' });
  fc.forEach((v, i) => list.appendChild(el('div', {
    class: 'flex items-center justify-between p-3 rounded-xl',
    style: { background: i === 0 ? '#E8F4EE' : '#FAFAF6', border: '1px solid ' + (i === 0 ? '#0B6E4F' : '#E2E8E4') },
  },
    el('div', {},
      el('div', { class: 'text-[12px] uppercase tracking-wider font-bold text-ink-3' },
        months[i] + (i === 0 ? ' · Next month' : '')),
      el('div', { class: 'font-display text-[20px] font-extrabold text-squad-deep mt-0.5' }, fmt(v)),
    ),
    el('div', {
      class: 'chip',
      style: { background: '#fff', color: '#0B6E4F', border: '1px solid #E2E8E4' },
    }, icon(v >= lastReal ? 'arrow-up-short' : 'arrow-down-short'),
       Math.round(((v / Math.max(1, lastReal)) - 1) * 100) + '%'),
  )));
  card.appendChild(list);
  return card;
}

// Linear-regression forecast over an array of historical monthly totals.
// Returns `n` projected months in order.
function projectForward(history, n) {
  if (history.length < 2) return new Array(n).fill(history[0] || 0);
  const xs = history.map((_, i) => i);
  const xm = xs.reduce((s, v) => s + v, 0) / xs.length;
  const ym = history.reduce((s, v) => s + v, 0) / history.length;
  const num = xs.reduce((s, x, i) => s + (x - xm) * (history[i] - ym), 0);
  const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0) || 1;
  const slope = num / den;
  const intercept = ym - slope * xm;
  return Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.round(intercept + slope * (history.length + i)))
  );
}
