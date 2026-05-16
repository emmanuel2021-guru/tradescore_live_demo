import { el, fmt, icon, toast } from '../utils.js';
import { getUser, getScore, refreshTxsFromServer } from '../store.js';
import { recommendLoan, loanTiersFor } from '../ai.js';
import { api } from '../api.js';

export function LoansPanel() {
  const TRADER = getUser();
  const role = TRADER.role || 'trader';
  const isWorker = role === 'worker';
  const LOAN_TIERS = loanTiersFor(role);
  const liveScore = getScore();
  // Live score wins; fall back to mock TRADER.score for marketing-style preview
  // when the backend hasn't computed one yet.
  const userScore = liveScore?.score ?? TRADER.score ?? 700;
  const monthlyRevenue = liveScore?.aggregates?.monthlyRevenue ?? TRADER.monthlyRevenue ?? 0;

  // Pick the best tier the user qualifies for as the "pre-approved" anchor.
  const eligibleTier = [...LOAN_TIERS].reverse().find(t => userScore >= t.minScore) || LOAN_TIERS[0];
  const preApproved = eligibleTier.max;

  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  // ── Hero / eligibility ──────────────────────────────────
  const hero = el('div', { class: 'grid lg:grid-cols-[1.4fr_1fr] gap-5 fade-up' });

  const big = el('div', {
    class: 'rounded-2xl p-7 relative overflow-hidden',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 16px 40px rgba(2, 43, 35, 0.18)',
    },
  });
  big.appendChild(el('div', {
    class: 'absolute rounded-full',
    style: { width: '300px', height: '300px', top: '-120px', right: '-100px',
             background: 'radial-gradient(circle, rgba(232,255,139,0.16), transparent 70%)' },
  }));
  big.appendChild(el('div', {
    class: 'text-[11px] font-bold uppercase tracking-[0.2em] relative',
    style: { color: '#E8FF8B' },
  }, "You're pre-approved for"));
  big.appendChild(el('div', {
    class: 'font-display font-extrabold text-white relative mt-1',
    style: { fontSize: '52px', lineHeight: '1.05', letterSpacing: '-0.04em' },
  }, fmt(preApproved)));
  big.appendChild(el('div', { class: 'flex items-center gap-2 mt-1 relative flex-wrap', style: { color: 'rgba(255,255,255,0.7)' } },
    el('span', { class: 'text-[14px]' }, `Based on TradeScore ${userScore} · From ${LOAN_TIERS[0].rateMonthly}% / month`),
    el('span', { class: 'chip', style: { background: 'rgba(232,255,139,0.18)', color: '#E8FF8B', fontSize: '10.5px' } },
      icon('bank2'), 'GTBank partner rate'),
  ));

  // AI recommendation
  const r = recommendLoan('stock');
  const aiBox = el('div', { class: 'mt-5 p-4 rounded-2xl glass relative' });
  aiBox.appendChild(el('div', { class: 'flex items-center gap-2 mb-1' },
    el('span', { style: { color: '#E8FF8B', fontSize: '14px' } }, icon('stars')),
    el('span', { class: 'text-[10.5px] font-extrabold uppercase tracking-[0.15em]', style: { color: '#E8FF8B' } },
      'AI recommendation'),
  ));
  aiBox.appendChild(el('div', {
    class: 'text-white text-[15px] leading-relaxed',
    html: `Borrow <strong style="color:#E8FF8B;">${fmt(r.amount)}</strong> over <strong style="color:#E8FF8B;">${r.term}</strong> at <strong style="color:#E8FF8B;">${r.rate}%/mo</strong>. ${r.reasons[0]}`,
  }));
  big.appendChild(aiBox);
  hero.appendChild(big);

  // Right: 3 quick stats
  const right = el('div', { class: 'grid gap-4' });
  right.appendChild(StatCard({ iconName: 'percent', label: 'GT lowest rate', value: LOAN_TIERS[0].rateMonthly + '%', sub: 'per month · Quick Credit', accent: '#0B6E4F' }));
  right.appendChild(StatCard({ iconName: 'calendar3', label: 'Max tenor', value: '36', sub: 'months · MaxPlus SME', accent: '#1F8A65' }));
  right.appendChild(StatCard({ iconName: 'lightning-charge', label: 'Funding speed', value: '< 5', sub: 'minutes via *737#', accent: '#27AE60' }));
  hero.appendChild(right);

  root.appendChild(hero);

  // ── Loan tiers grid ──────────────────────────────────────
  const tiersWrap = el('div', { class: 'fade-up-1' });
  tiersWrap.appendChild(el('div', { class: 'flex items-center justify-between mb-4 flex-wrap gap-2' },
    el('div', {},
      el('h3', { class: 'font-display text-[20px] font-extrabold text-squad-deep' },
        isWorker ? 'GTBank microcredit for workers' : 'GTBank loan products'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        isWorker
          ? 'Built for informal workers — small principals, fast repayment, no collateral.'
          : 'Live rates from GTBank — tiers unlock as your TradeScore grows.'),
    ),
    el('span', { class: 'chip', style: { background: '#FFF4E0', color: '#7B5500' } },
      icon('bank2'), 'Powered by GTBank'),
  ));
  const tiersGrid = el('div', { class: 'grid md:grid-cols-2 lg:grid-cols-4 gap-4' });
  LOAN_TIERS.forEach((t, i) => tiersGrid.appendChild(TierCard(t, userScore >= t.minScore, i)));
  tiersWrap.appendChild(tiersGrid);
  root.appendChild(tiersWrap);

  // ── TradeScore journey (past + projected) ───────────────
  root.appendChild(buildJourneyCard({ userScore }));

  // ── Calculator ───────────────────────────────────────────
  root.appendChild(buildCalculator({ userScore, monthlyRevenue, preApproved, tiers: LOAN_TIERS }));

  return root;
}

// ── TradeScore journey card ──────────────────────────────────────
// Shows a 12-month TradeScore trajectory — past 6 months computed from real
// transactions, next 6 months projected from the historical slope. Tier
// unlock markers make the feedback loop visible: "keep doing what you're
// doing and the next loan tier unlocks at month N".
function buildJourneyCard({ userScore }) {
  const card = el('div', { class: 'card p-6 fade-up-1' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4 flex-wrap gap-2' },
    el('div', {},
      el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep' }, 'Your TradeScore journey'),
      el('p', { class: 'text-[12px] text-ink-3 mt-0.5' },
        'Past 6 months computed from your Squad activity. Next 6 months projected from your slope.'),
    ),
    el('span', {
      class: 'chip',
      style: { background: '#E8F4EE', color: '#0B6E4F' },
    }, icon('graph-up-arrow'), 'Live · feedback loop'),
  ));

  const host = el('div', {
    class: 'flex items-center justify-center text-ink-3 text-[12px] py-8',
  },
    el('span', { class: 'spin inline-block w-4 h-4 border-2 border-squad-green border-t-transparent rounded-full mr-2 align-middle' }),
    'Computing trajectory…',
  );
  card.appendChild(host);

  api.scoreHistory().then(data => {
    host.innerHTML = '';
    host.classList.remove('items-center', 'justify-center', 'py-8', 'text-ink-3', 'text-[12px]');
    host.className = '';
    host.appendChild(drawJourneyChart(data));
    host.appendChild(buildMilestoneStrip(data, userScore));
  }).catch(e => {
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'text-[12px] text-ink-3 text-center py-6' },
      'Trajectory unavailable: ' + (e.message || 'unknown error')));
  });

  return card;
}

function drawJourneyChart(data) {
  const { series, today_index } = data;
  const wrap = el('div', { class: 'w-full relative mt-1' });

  const W = 760, H = 240, PAD_X = 36, PAD_Y = 24;
  const scores = series.map(p => p.score).filter(Number.isFinite);
  const baseMin = Math.min(...scores, 850);
  const baseMax = Math.max(...scores, 350);
  const yMin = Math.max(350, baseMin - 30);
  const yMax = Math.min(850, Math.max(baseMax + 30, yMin + 100));
  const stepX = (W - PAD_X * 2) / Math.max(1, series.length - 1);
  const yOf = (s) => H - PAD_Y - ((s - yMin) / (yMax - yMin)) * (H - PAD_Y * 2);
  const xOf = (i) => PAD_X + i * stepX;

  // Build separate past + projected paths, with the today index acting as
  // the join point. Projected line is dashed; past is solid.
  const points = series.map((p, i) => ({
    x: xOf(i),
    y: p.score != null ? yOf(p.score) : null,
    score: p.score,
    label: p.label,
    kind: p.kind,
  }));

  const pastPoints = points.slice(0, today_index + 1).filter(p => p.y != null);
  const projPoints = [points[today_index], ...points.slice(today_index + 1)].filter(p => p.y != null);

  const pathFor = (pts) =>
    pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');

  const gradId = 'journeyFill_' + Math.random().toString(36).slice(2, 8);
  const fillPath = pastPoints.length >= 2
    ? pathFor(pastPoints) +
      ` L${pastPoints[pastPoints.length - 1].x.toFixed(1)} ${H - PAD_Y} L${pastPoints[0].x.toFixed(1)} ${H - PAD_Y} Z`
    : '';

  // Tier threshold lines (worker or trader tier minScores within range)
  const tradertiers = [
    { min: 670, name: 'GT Smart Advance' },
    { min: 720, name: 'GT MaxPlus SME' },
    { min: 770, name: 'GT SME Growth' },
  ];
  const workerTiers = [
    { min: 620, name: 'GT Skills Loan' },
    { min: 700, name: 'GT Asset Loan' },
  ];
  const role = getUser().role || 'trader';
  const tierLines = (role === 'worker' ? workerTiers : tradertiers)
    .filter(t => t.min >= yMin && t.min <= yMax);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 28}`);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';

  // Today vertical separator (light)
  const todayX = points[today_index].x;
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
    ${tierLines.map(t => `
      <line x1="${PAD_X}" y1="${yOf(t.min).toFixed(1)}" x2="${W - PAD_X}" y2="${yOf(t.min).toFixed(1)}"
        stroke="#9B6B00" stroke-width="1.2" stroke-dasharray="2 4" opacity="0.55" />
      <text x="${W - PAD_X - 4}" y="${(yOf(t.min) - 4).toFixed(1)}" text-anchor="end"
        style="font-family: Inter, sans-serif; font-size: 10.5px; font-weight: 700; fill: #9B6B00;">${t.name} · ${t.min}</text>
    `).join('')}
    <line x1="${todayX}" y1="${PAD_Y}" x2="${todayX}" y2="${H - PAD_Y}" stroke="#022B23" stroke-width="1" stroke-dasharray="3 4" opacity="0.4" />
    <text x="${todayX}" y="${PAD_Y - 6}" text-anchor="middle"
      style="font-family: Inter, sans-serif; font-size: 10.5px; font-weight: 800; fill: #022B23; letter-spacing: 0.08em; text-transform: uppercase;">Today</text>
    ${fillPath ? `<path d="${fillPath}" fill="url(#${gradId})" />` : ''}
    ${pastPoints.length >= 2 ? `<path d="${pathFor(pastPoints)}" fill="none" stroke="#0B6E4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}
    ${projPoints.length >= 2 ? `<path d="${pathFor(projPoints)}" fill="none" stroke="#0B6E4F" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />` : ''}
    ${points.map((p, i) => p.y == null ? '' : `
      <circle cx="${p.x}" cy="${p.y}" r="${i === today_index ? 6 : 3.5}"
        fill="${p.kind === 'past' ? '#0B6E4F' : '#E8FF8B'}"
        stroke="${i === today_index ? '#022B23' : '#fff'}"
        stroke-width="${i === today_index ? 2.5 : 2}" />
    `).join('')}
    ${points[today_index].y != null ? `
      <text x="${points[today_index].x}" y="${(points[today_index].y - 14).toFixed(1)}" text-anchor="middle"
        style="font-family: Inter, sans-serif; font-size: 12px; font-weight: 800; fill: #022B23;">${points[today_index].score}</text>
    ` : ''}
    ${points[points.length - 1].y != null ? `
      <text x="${points[points.length - 1].x}" y="${(points[points.length - 1].y - 12).toFixed(1)}" text-anchor="end"
        style="font-family: Inter, sans-serif; font-size: 11.5px; font-weight: 700; fill: #0B6E4F;">+${points[points.length - 1].score - (points[today_index].score || 0)} pts</text>
    ` : ''}
    ${points.map(p => `<text x="${p.x}" y="${H + 18}" text-anchor="middle"
      style="font-family: Inter, sans-serif; font-size: 11px; font-weight: 600; fill: #4A5C56;">${p.label}</text>`).join('')}
  `;
  wrap.appendChild(svg);
  return wrap;
}

function buildMilestoneStrip(data, userScore) {
  const wrap = el('div', { class: 'mt-4 grid sm:grid-cols-3 gap-3' });

  // Stat 1: slope per month
  wrap.appendChild(el('div', {
    class: 'p-3.5 rounded-xl',
    style: { background: '#F5F9F6', border: '1px solid #E2E8E4' },
  },
    el('div', { class: 'text-[10.5px] uppercase tracking-wider font-bold text-ink-3' }, 'Your slope'),
    el('div', { class: 'flex items-baseline gap-1.5 mt-0.5' },
      el('span', { class: 'font-display font-extrabold text-squad-deep', style: { fontSize: '22px', letterSpacing: '-0.02em' } },
        '+' + data.slope_per_month),
      el('span', { class: 'text-[11px] text-ink-3 font-bold' }, 'pts / month'),
    ),
    el('div', { class: 'text-[11px] text-ink-3 mt-0.5' }, 'Built from your actual Squad activity'),
  ));

  // Stat 2 + 3: next tier(s) to unlock — pulled from milestones
  if (data.milestones.length) {
    data.milestones.slice(0, 2).forEach(m => {
      wrap.appendChild(el('div', {
        class: 'p-3.5 rounded-xl relative overflow-hidden',
        style: { background: 'linear-gradient(135deg, #FFF4D6, #E8FF8B)', border: '1px solid #F0DA9A' },
      },
        el('div', { class: 'flex items-center gap-1.5 mb-0.5' },
          el('span', { style: { color: '#9B6B00', fontSize: '12px' } }, icon('unlock-fill')),
          el('div', { class: 'text-[10.5px] uppercase tracking-wider font-bold', style: { color: '#7B5500' } },
            'Unlocks in ' + m.monthsAway + ' month' + (m.monthsAway === 1 ? '' : 's')),
        ),
        el('div', { class: 'font-display font-extrabold text-squad-deep mt-0.5', style: { fontSize: '15px' } },
          m.label),
        el('div', { class: 'text-[11px] mt-0.5', style: { color: '#7B5500' } }, 'at score ' + m.atScore),
      ));
    });
  } else if (userScore >= 770) {
    wrap.appendChild(el('div', {
      class: 'p-3.5 rounded-xl sm:col-span-2',
      style: { background: 'linear-gradient(135deg, #022B23, #0B6E4F)', color: '#fff' },
    },
      el('div', { class: 'text-[10.5px] uppercase tracking-wider font-bold', style: { color: '#E8FF8B' } },
        'Top tier'),
      el('div', { class: 'font-display font-extrabold mt-0.5', style: { fontSize: '15px' } },
        'Every GTBank product is open to you'),
      el('div', { class: 'text-[11px] mt-0.5', style: { color: 'rgba(255,255,255,0.78)' } },
        'Your TradeScore puts you in the top credit tier. Keep your slope steady to lock in the lowest rates.'),
    ));
  } else {
    wrap.appendChild(el('div', {
      class: 'p-3.5 rounded-xl sm:col-span-2',
      style: { background: '#F5F9F6', border: '1px solid #E2E8E4' },
    },
      el('div', { class: 'text-[10.5px] uppercase tracking-wider font-bold text-ink-3' }, 'Next milestone'),
      el('div', { class: 'font-display font-extrabold text-squad-deep mt-0.5', style: { fontSize: '15px' } },
        'Stay on this slope'),
      el('div', { class: 'text-[11px] text-ink-3 mt-0.5' },
        'You\'re already at the top of your role\'s tier ladder. Maintain steady inflows to lock in your rate.'),
    ));
  }

  return wrap;
}

function StatCard({ iconName, label, value, sub, accent }) {
  return el('div', { class: 'card p-5 flex items-center gap-4 relative overflow-hidden' },
    el('div', {
      style: {
        position: 'absolute', top: '-30px', right: '-30px',
        width: '110px', height: '110px', borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}1F, transparent 70%)`,
        pointerEvents: 'none',
      },
    }),
    el('div', {
      class: 'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
      style: {
        background: `linear-gradient(135deg, ${accent}, ${shade(accent, 18)})`,
        color: '#fff', fontSize: '20px',
        boxShadow: `0 10px 22px -6px ${accent}66`,
      },
    }, icon(iconName)),
    el('div', { class: 'min-w-0 relative' },
      el('div', {
        class: 'text-[11px] uppercase tracking-[0.12em] font-extrabold',
        style: { color: accent },
      }, label),
      el('div', { class: 'flex items-baseline gap-1.5 mt-0.5' },
        el('span', {
          class: 'font-display font-extrabold text-squad-deep',
          style: { fontSize: '28px', letterSpacing: '-0.025em' },
        }, value),
        el('span', { class: 'text-[12.5px] font-bold', style: { color: accent } }, sub),
      ),
    ),
  );
}

function shade(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8)  & 0xff) + amount);
  const b = Math.min(255, ( num        & 0xff) + amount);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function TierCard(t, eligible, i) {
  const TIER_THEMES = [
    { from: '#FFB547', to: '#F5B947', glow: 'rgba(245,185,71,0.30)' },
    { from: '#14855F', to: '#27AE60', glow: 'rgba(39,174,96,0.30)' },
    { from: '#0B6E4F', to: '#1F8A65', glow: 'rgba(11,110,79,0.30)' },
    { from: '#7C5CFF', to: '#A78BFA', glow: 'rgba(124,92,255,0.30)' },
  ];
  const theme = TIER_THEMES[i] || TIER_THEMES[0];

  const card = el('div', {
    class: 'card p-5 relative overflow-hidden ' + (eligible ? 'card-hover' : ''),
    style: {
      opacity: eligible ? '1' : '0.65',
      animation: `fadeUp 0.5s ${0.05 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both`,
    },
  });

  card.appendChild(el('div', {
    style: {
      position: 'absolute', left: 0, right: 0, top: 0, height: '4px',
      background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`,
    },
  }));

  if (eligible) card.appendChild(el('div', {
    style: {
      position: 'absolute', top: '-50px', right: '-50px',
      width: '160px', height: '160px', borderRadius: '50%',
      background: `radial-gradient(circle, ${theme.glow}, transparent 70%)`,
      pointerEvents: 'none',
    },
  }));

  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4 relative' },
    el('div', {
      class: 'w-12 h-12 rounded-2xl flex items-center justify-center',
      style: {
        background: eligible ? `linear-gradient(135deg, ${theme.from}, ${theme.to})` : '#F5F5F0',
        color: eligible ? '#fff' : '#9AA8A2',
        fontSize: '19px',
        boxShadow: eligible ? `0 10px 24px -6px ${theme.glow}` : 'none',
      },
    }, icon(t.icon || (eligible ? 'unlock-fill' : 'lock-fill'))),
    el('span', {
      class: 'chip',
      style: eligible
        ? { background: 'linear-gradient(135deg, #E5F9F0, #C8F2D6)', color: '#0B6E4F' }
        : { background: '#F5F5F0', color: '#9AA8A2' },
    },
      eligible ? el('span', { style: { fontSize: '7px' } }, '●') : null,
      eligible ? 'Eligible' : `Need ${t.minScore}+`,
    ),
  ));
  card.appendChild(el('h4', {
    class: 'font-display text-[17px] font-extrabold text-squad-deep relative',
    style: { letterSpacing: '-0.02em' },
  }, t.name));
  card.appendChild(el('p', { class: 'text-[12px] text-ink-3 mt-0.5 mb-4 relative' }, t.desc));
  card.appendChild(el('div', { class: 'flex items-baseline gap-1.5 relative' },
    el('span', { class: 'text-[11px] text-ink-3 font-bold' }, 'Up to'),
    el('span', { class: 'font-display font-extrabold text-squad-deep', style: { fontSize: '24px', letterSpacing: '-0.025em' } },
      fmt(t.max)),
  ));
  card.appendChild(el('div', { class: 'flex items-center justify-between mt-3 pt-3 relative', style: { borderTop: '1px dashed rgba(11,110,79,0.18)' } },
    el('span', { class: 'text-[12.5px] font-extrabold', style: { color: theme.from } },
      `${t.rateMonthly}% / mo`),
    el('span', { class: 'text-[10.5px] text-ink-3 font-semibold' }, t.aprNote || ''),
  ));
  card.appendChild(el('div', { class: 'text-[11px] text-ink-3 mt-1 relative' }, t.term + (t.fees ? ' · ' + t.fees : '')));
  return card;
}

// ── Calculator ─────────────────────────────────────────────
function buildCalculator({ userScore, monthlyRevenue, preApproved, tiers, navigate }) {
  const LOAN_TIERS = tiers;
  let amount = Math.min(500000, preApproved);
  let term   = '12 months';
  let purpose = 'stock';

  const card = el('div', { class: 'card p-6 lg:p-8 fade-up-2' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-1' },
    el('h3', {
      class: 'font-display text-[20px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, 'Loan calculator'),
    el('span', { class: 'chip', style: { background: '#E8F4EE', color: '#0B6E4F' } },
      icon('stars'), 'AI auto-rate'),
  ));
  card.appendChild(el('p', { class: 'text-[13px] text-ink-3 mb-6' },
    'Pick an amount and term — we\'ll match the lowest rate your TradeScore unlocks.'));

  const grid = el('div', { class: 'grid lg:grid-cols-[1.3fr_1fr] gap-8' });

  // Left: controls
  const controls = el('div', {});
  controls.appendChild(el('label', { class: 'label' }, 'Loan amount'));
  const amountDisplay = el('div', {
    class: 'font-display font-extrabold text-squad-deep mb-3',
    style: { fontSize: '34px', letterSpacing: '-0.03em' },
  }, fmt(amount));
  controls.appendChild(amountDisplay);
  const slider = el('input', {
    type: 'range', min: '20000', max: String(preApproved),
    step: '5000', value: String(amount),
    class: 'w-full',
  });
  controls.appendChild(slider);
  controls.appendChild(el('div', { class: 'flex justify-between mt-2 text-[11px] text-ink-3 font-semibold' },
    el('span', {}, fmt(20000)),
    el('span', {}, fmt(preApproved)),
  ));

  controls.appendChild(el('div', { class: 'label mt-7' }, 'Repayment period'));
  const termRow = el('div', { class: 'grid grid-cols-4 gap-2' });
  ['6 months', '12 months', '24 months', '36 months'].forEach(t => {
    const btn = el('button', {
      class: 'h-12 rounded-xl font-bold text-[13px] tap text-center transition-all',
      'data-term': t,
    }, t);
    btn.addEventListener('click', () => { term = t; paintTerms(); paint(); });
    termRow.appendChild(btn);
  });
  controls.appendChild(termRow);
  function paintTerms() {
    termRow.querySelectorAll('[data-term]').forEach(btn => {
      const a = btn.dataset.term === term;
      btn.style.background = a ? '#0B6E4F' : '#fff';
      btn.style.color      = a ? '#fff' : '#4A5C56';
      btn.style.border     = a ? '1px solid #0B6E4F' : '1px solid #E2E8E4';
      btn.style.boxShadow  = a ? '0 4px 14px rgba(11, 110, 79, 0.25)' : 'none';
    });
  }
  paintTerms();

  controls.appendChild(el('div', { class: 'label mt-7' }, 'Purpose'));
  const purposeRow = el('div', { class: 'flex flex-wrap gap-2' });
  ['stock', 'rent', 'expansion', 'emergency', 'other'].forEach(p => {
    const btn = el('button', {
      class: 'px-4 py-2.5 rounded-full font-bold text-[12px] tap capitalize transition-all',
      'data-purpose': p,
    }, p);
    btn.addEventListener('click', () => { purpose = p; paintPurpose(); paint(); });
    purposeRow.appendChild(btn);
  });
  function paintPurpose() {
    purposeRow.querySelectorAll('[data-purpose]').forEach(btn => {
      const a = btn.dataset.purpose === purpose;
      btn.style.background = a ? '#E8FF8B' : '#fff';
      btn.style.color      = a ? '#022B23' : '#4A5C56';
      btn.style.border     = a ? '1px solid #022B23' : '1px solid #E2E8E4';
    });
  }
  paintPurpose();
  controls.appendChild(purposeRow);

  grid.appendChild(controls);

  // Right: summary
  const summary = el('div', {
    class: 'p-6 rounded-2xl',
    style: { background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)' },
  });
  summary.appendChild(el('div', { class: 'text-[10.5px] font-bold uppercase tracking-widest', style: { color: '#E8FF8B' } },
    'Your loan'));
  const totalEl = el('div', {
    class: 'font-display text-white font-extrabold mt-1 mb-4',
    style: { fontSize: '32px', letterSpacing: '-0.03em' },
  });
  summary.appendChild(totalEl);

  const sumList = el('div', { class: 'space-y-2.5' });
  summary.appendChild(sumList);

  const aiNote = el('div', {
    class: 'mt-5 p-3 rounded-xl text-[12px] leading-relaxed',
    style: { background: 'rgba(232,255,139,0.10)', color: 'rgba(255,255,255,0.85)' },
  });
  summary.appendChild(aiNote);

  const apply = el('button', {
    class: 'btn btn-lime w-full mt-5 !py-4 !text-[14px]',
  }, 'Apply now', icon('arrow-right'));
  let applying = false;
  apply.addEventListener('click', async () => {
    if (applying) return;
    applying = true;
    apply.innerHTML = '';
    apply.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full' }));
    apply.appendChild(el('span', {}, 'Applying…'));

    // Pick the lowest-rate tier the user qualifies for at this amount.
    const eligible = LOAN_TIERS.filter(t => t.minScore <= userScore && t.max >= amount)
      .sort((a, b) => a.rateMonthly - b.rateMonthly);
    const tier = eligible[0];

    try {
      const resp = await api.loans.apply({
        amount, term, purpose,
        product: tier?.name,
        rateMonthly: tier?.rateMonthly,
      });
      // Score+tx may move after disbursement — refresh in the background.
      refreshTxsFromServer();
      showLoanSuccess(amount, term, resp);
    } catch (e) {
      toast(e?.data?.error || e.message || 'Application failed',
        { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
      apply.innerHTML = '';
      apply.appendChild(el('span', {}, 'Try again'));
      apply.appendChild(icon('arrow-right'));
      applying = false;
    }
  });
  summary.appendChild(apply);

  grid.appendChild(summary);
  card.appendChild(grid);

  function pickRate() {
    const eligible = LOAN_TIERS.filter(t => t.minScore <= userScore && t.max >= amount)
      .sort((a, b) => a.rateMonthly - b.rateMonthly);
    return eligible[0]?.rateMonthly ?? 3.5;
  }

  function paint() {
    const rate = pickRate();
    const months = parseInt(term, 10);
    const interest = Math.round(amount * (rate / 100) * months);
    const mgmtFee  = Math.round(amount * 0.01);
    const insurance = Math.round(amount * 0.01);
    const total = amount + interest;
    const installment = Math.round(total / months);
    const netDisbursed = amount - mgmtFee - insurance;

    amountDisplay.textContent = fmt(amount);
    totalEl.textContent = fmt(total);
    sumList.innerHTML = '';
    sumList.appendChild(rowKv('Loan amount', fmt(amount)));
    sumList.appendChild(rowKv('GTBank rate', rate + '% / month'));
    sumList.appendChild(rowKv('Tenor', term));
    sumList.appendChild(rowKv('Total interest', fmt(interest)));
    sumList.appendChild(rowKv('Mgmt fee (1%)', fmt(mgmtFee)));
    sumList.appendChild(rowKv('Insurance (1%)', fmt(insurance)));
    sumList.appendChild(rowKv('Net to wallet', fmt(netDisbursed)));
    sumList.appendChild(rowKv('Monthly instalment', fmt(installment), true));

    const ratio = monthlyRevenue
      ? Math.round((installment / monthlyRevenue) * 100)
      : null;
    aiNote.innerHTML = ratio != null
      ? `<strong style="color:#E8FF8B;">AI:</strong> At ${fmt(installment)} / month, your repayment uses ${ratio}% of average revenue — ${ratio < 25 ? 'within the safe 25% threshold' : 'above GTBank\'s safe 25% threshold — consider a longer tenor'}.`
      : `<strong style="color:#E8FF8B;">AI:</strong> Send a few payments to unlock affordability analysis.`;
  }

  slider.addEventListener('input', e => { amount = parseInt(e.target.value, 10); paint(); });
  paint();

  return card;
}

function rowKv(k, v, highlight) {
  return el('div', { class: 'flex items-center justify-between' },
    el('span', { class: 'text-[13px]', style: { color: 'rgba(255,255,255,0.65)' } }, k),
    el('span', {
      class: (highlight ? 'text-[15.5px]' : 'text-[13.5px]') + ' font-extrabold',
      style: { color: highlight ? '#E8FF8B' : '#fff' },
    }, v),
  );
}

// ── Success modal ────────────────────────────────────────────
function showLoanSuccess(amount, term, resp) {
  const u = getUser();
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
    style: { padding: '40px', maxWidth: '480px', width: '100%' },
  });
  modal.appendChild(el('div', {
    class: 'w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center pop',
    style: {
      background: 'linear-gradient(135deg, #E8FF8B, #27AE60)',
      boxShadow: '0 8px 28px rgba(39,174,96,0.35)',
    },
  }, el('span', { class: 'text-white', style: { fontSize: '40px' } }, icon('check-lg'))));
  modal.appendChild(el('h2', {
    class: 'font-display text-[26px] font-extrabold text-squad-deep text-center',
    style: { letterSpacing: '-0.025em' },
  }, 'Loan approved!'));
  modal.appendChild(el('p', { class: 'text-[14px] text-ink-2 text-center mt-2 leading-relaxed' },
    fmt(amount) + ' is on its way to your Squad wallet · ' + term + ' term'));

  const detail = el('div', {
    class: 'mt-6 p-4 rounded-xl space-y-2',
    style: { background: '#F5F5F0' },
  });
  detail.appendChild(rowKvL('Disbursement',
    u.squadWallet ? (u.virtualAccountBank || 'GTBank') + ' · ' + u.squadWallet : 'Squad wallet'));
  detail.appendChild(rowKvL('Available', 'Within 5 minutes'));
  detail.appendChild(rowKvL('First instalment', '30 days from today'));
  if (resp?.loan?.reference) {
    detail.appendChild(rowKvL('Reference', resp.loan.reference));
  }
  modal.appendChild(detail);

  modal.appendChild(el('button', {
    class: 'btn btn-primary w-full mt-6 !py-3.5',
    onClick: close,
  }, 'Done'));

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function rowKvL(k, v) {
  return el('div', { class: 'flex items-center justify-between text-[13px]' },
    el('span', { class: 'text-ink-2' }, k),
    el('span', { class: 'font-extrabold text-ink-1' }, v),
  );
}
