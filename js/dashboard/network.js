// Network Intelligence panel — the answer to Challenge 02's "Learns and
// improves over time" requirement. Shows ecosystem-wide telemetry plus the
// underwriting model's version history, training corpus, and accuracy
// trend. Visible to both traders and workers; the numbers reflect the
// state of the system right now and tick up as judges drive activity
// during the demo.

import { el, fmt, icon } from '../utils.js';
import { api } from '../api.js';

export function NetworkPanel() {
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  // Hero header
  root.appendChild(el('div', { class: 'flex flex-wrap items-end justify-between gap-3 fade-up' },
    el('div', {},
      el('p', { class: 'text-ink-2 text-[14px]' }, 'Smart Systems · live telemetry'),
      el('h2', {
        class: 'font-display text-[22px] md:text-[26px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.025em' },
      }, 'Network Intelligence'),
    ),
    el('div', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } },
      el('span', { style: { fontSize: '7px' } }, '●'),
      'Streaming from /api/network'),
  ));

  // Loading placeholder
  const host = el('div', { class: 'space-y-6' },
    el('div', { class: 'card p-12 text-center text-ink-3 text-[13px]' },
      el('span', { class: 'spin inline-block w-5 h-5 border-2 border-squad-green border-t-transparent rounded-full mr-3 align-middle' }),
      'Loading network telemetry…'),
  );
  root.appendChild(host);

  api.network().then(data => {
    host.innerHTML = '';
    host.appendChild(buildKpis(data));
    host.appendChild(buildModelCard(data.model, data.transactions.count, data.users.total));
    host.appendChild(buildAccuracyChart(data.model.accuracy_trend));
    host.appendChild(buildDistribution(data.score_distribution, data.avg_score));
    host.appendChild(buildVersionHistory(data.model.improvements));
  }).catch(e => {
    host.innerHTML = '';
    host.appendChild(el('div', {
      class: 'card p-6 text-center text-[13px]',
      style: { color: '#9A1F1F', background: '#FCE8E8' },
    }, 'Network telemetry unavailable: ' + (e.message || 'unknown error')));
  });

  return root;
}

// ── KPI strip — ecosystem totals ──────────────────────────────────
function buildKpis(d) {
  const grid = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up-1' });
  grid.appendChild(Kpi({
    iconName: 'people-fill', label: 'Onboarded',
    value: d.users.total.toLocaleString('en-NG'),
    sub: d.users.traders + ' traders · ' + d.users.workers + ' workers',
    from: '#022B23', to: '#0B6E4F',
  }));
  grid.appendChild(Kpi({
    iconName: 'cash-stack', label: 'Volume processed',
    value: fmt(d.transactions.total_volume_naira),
    sub: d.transactions.count.toLocaleString('en-NG') + ' transactions',
    from: '#0B6E4F', to: '#14855F',
  }));
  grid.appendChild(Kpi({
    iconName: 'people', label: 'Gigs paid',
    value: d.gigs.count.toLocaleString('en-NG'),
    sub: fmt(d.gigs.total_volume_naira) + ' to workers',
    from: '#14855F', to: '#1F8A65',
  }));
  grid.appendChild(Kpi({
    iconName: 'speedometer2', label: 'Average TradeScore',
    value: d.avg_score ?? '—',
    sub: 'across the network',
    from: '#1F8A65', to: '#27AE60',
  }));
  return grid;
}

function Kpi({ iconName, label, value, sub, from, to }) {
  const card = el('div', {
    class: 'rounded-2xl p-5 relative overflow-hidden',
    style: {
      background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      boxShadow: `0 10px 24px -10px ${from}99`,
    },
  });
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
      style: { background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '15px',
               boxShadow: '0 0 0 1px rgba(255,255,255,0.18) inset' },
    }, icon(iconName)),
    el('div', {
      class: 'text-[11.5px] font-bold uppercase tracking-[0.08em]',
      style: { color: 'rgba(255,255,255,0.82)' },
    }, label),
  ));
  card.appendChild(el('div', {
    class: 'font-display text-[26px] font-extrabold text-white relative',
    style: { letterSpacing: '-0.025em' },
  }, String(value)));
  card.appendChild(el('div', {
    class: 'text-[11.5px] mt-0.5 relative font-semibold',
    style: { color: 'rgba(255,255,255,0.75)' },
  }, sub));
  return card;
}

// ── Model card — current version + next retrain ───────────────────
function buildModelCard(model, txCount, userCount) {
  const card = el('div', {
    class: 'card p-6 fade-up-1 relative overflow-hidden',
    style: { background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)' },
  });
  card.appendChild(el('div', {
    style: {
      position: 'absolute', top: '-60px', right: '-60px',
      width: '220px', height: '220px', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(232,255,139,0.14), transparent 70%)',
      pointerEvents: 'none',
    },
  }));

  card.appendChild(el('div', { class: 'flex flex-wrap items-start justify-between gap-4 relative' },
    el('div', {},
      el('div', {
        class: 'text-[11px] font-bold uppercase tracking-[0.2em]',
        style: { color: '#E8FF8B' },
      }, 'TradeScore underwriting model'),
      el('div', { class: 'flex items-baseline gap-3 mt-1.5 flex-wrap' },
        el('span', {
          class: 'font-display font-extrabold text-white',
          style: { fontSize: '36px', letterSpacing: '-0.025em' },
        }, 'v' + model.version),
        el('span', {
          class: 'chip',
          style: { background: 'rgba(232,255,139,0.18)', color: '#E8FF8B', fontSize: '10.5px' },
        }, icon('cpu'), 'live'),
      ),
      el('p', {
        class: 'text-[13px] leading-relaxed mt-2 max-w-[560px]',
        style: { color: 'rgba(255,255,255,0.78)' },
      }, 'Trained on ' + txCount.toLocaleString('en-NG') + ' real Squad transactions across ' +
         userCount + ' onboarded users. Every transaction tightens the signal — the next retrain is in ' +
         model.next_retrain_days + ' days.'),
    ),
    el('div', {
      class: 'p-3.5 rounded-xl text-center',
      style: { background: 'rgba(255,255,255,0.08)', minWidth: '140px' },
    },
      el('div', {
        class: 'text-[10.5px] font-bold uppercase tracking-widest',
        style: { color: '#E8FF8B' },
      }, 'Next retrain'),
      el('div', {
        class: 'font-display text-white font-extrabold mt-1',
        style: { fontSize: '32px', letterSpacing: '-0.02em' },
      }, model.next_retrain_days),
      el('div', { class: 'text-[11px]', style: { color: 'rgba(255,255,255,0.7)' } },
        model.next_retrain_days === 1 ? 'day' : 'days'),
    ),
  ));
  return card;
}

// ── Accuracy chart ────────────────────────────────────────────────
function buildAccuracyChart(trend) {
  const card = el('div', { class: 'card p-6 fade-up-1' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-3 flex-wrap gap-2' },
    el('div', {},
      el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep' }, 'Default-prediction accuracy'),
      el('p', { class: 'text-[12px] text-ink-3 mt-0.5' },
        'Out-of-sample AUC, evaluated weekly against held-out repayments.'),
    ),
    el('div', { class: 'flex items-baseline gap-2' },
      el('span', { class: 'font-display font-extrabold text-squad-deep', style: { fontSize: '28px', letterSpacing: '-0.02em' } },
        trend[trend.length - 1].accuracy + '%'),
      el('span', {
        class: 'chip',
        style: { background: '#E5F9F0', color: '#27AE60', fontSize: '11px' },
      }, '+' + (trend[trend.length - 1].accuracy - trend[0].accuracy).toFixed(1) + 'pp · 6 weeks'),
    ),
  ));

  const W = 720, H = 200, PAD_X = 30, PAD_Y = 20;
  const values = trend.map(t => t.accuracy);
  const max = Math.max(...values) + 1;
  const min = Math.min(...values) - 1;
  const stepX = (W - PAD_X * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => ({
    x: PAD_X + i * stepX,
    y: H - PAD_Y - ((v - min) / (max - min)) * (H - PAD_Y * 2),
    label: trend[i].week,
    value: v,
  }));
  const line = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const fillPath = line + ` L${points[points.length - 1].x.toFixed(1)} ${H - PAD_Y} L${points[0].x.toFixed(1)} ${H - PAD_Y} Z`;
  const gradId = 'accFill_' + Math.random().toString(36).slice(2, 8);

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
    <path d="${line}" fill="none" stroke="#0B6E4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#0B6E4F" stroke="#fff" stroke-width="2"/>`).join('')}
    ${points.map(p => `<text x="${p.x}" y="${H + 18}" text-anchor="middle"
      style="font-family: Inter, sans-serif; font-size: 11px; font-weight: 600; fill: #4A5C56;">${p.label}</text>`).join('')}
  `;
  card.appendChild(svg);
  return card;
}

// ── Score distribution histogram ──────────────────────────────────
function buildDistribution(bands, avgScore) {
  const card = el('div', { class: 'card p-6 fade-up-1' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4 flex-wrap gap-2' },
    el('div', {},
      el('h3', { class: 'font-display text-[18px] font-extrabold text-squad-deep' }, 'TradeScore distribution'),
      el('p', { class: 'text-[12px] text-ink-3 mt-0.5' },
        'Where the network sits today. Average ' + (avgScore ?? '—') + ' / 850.'),
    ),
  ));
  const maxN = Math.max(1, ...bands.map(b => b.n));
  const row = el('div', { class: 'space-y-2.5' });
  bands.forEach(b => {
    const pct = (b.n / maxN) * 100;
    row.appendChild(el('div', { class: 'flex items-center gap-3' },
      el('div', { class: 'w-[68px] text-[11.5px] font-bold text-ink-2 tabular-nums' }, b.label),
      el('div', {
        class: 'flex-1 h-7 rounded-md relative overflow-hidden',
        style: { background: '#F5F9F6', border: '1px solid #E2E8E4' },
      },
        el('div', {
          style: {
            width: pct + '%', height: '100%',
            background: 'linear-gradient(90deg, #0B6E4F, #27AE60)',
            transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
          },
        }),
      ),
      el('div', { class: 'w-[40px] text-right text-[12px] font-extrabold text-squad-deep tabular-nums' }, String(b.n)),
    ));
  });
  card.appendChild(row);
  return card;
}

// ── Model version history ─────────────────────────────────────────
function buildVersionHistory(improvements) {
  const card = el('div', { class: 'card p-6 fade-up-1' });
  card.appendChild(el('h3', {
    class: 'font-display text-[18px] font-extrabold text-squad-deep mb-3',
  }, 'Model version history'));

  const list = el('div', { class: 'space-y-3' });
  improvements.forEach((imp, i) => {
    const latest = i === improvements.length - 1;
    list.appendChild(el('div', {
      class: 'flex gap-3',
    },
      el('div', {
        class: 'flex flex-col items-center flex-shrink-0',
        style: { width: '32px' },
      },
        el('div', {
          class: 'w-3 h-3 rounded-full',
          style: { background: latest ? '#0B6E4F' : '#9AA8A2', boxShadow: latest ? '0 0 0 4px rgba(11,110,79,0.16)' : 'none' },
        }),
        i < improvements.length - 1 ? el('div', {
          class: 'flex-1 w-px',
          style: { background: '#E2E8E4', minHeight: '32px' },
        }) : null,
      ),
      el('div', { class: 'flex-1 pb-3' },
        el('div', { class: 'flex items-baseline gap-2 flex-wrap' },
          el('span', {
            class: 'font-display font-extrabold text-squad-deep',
            style: { fontSize: '14px' },
          }, imp.version.startsWith('v') ? imp.version : 'v' + imp.version),
          latest ? el('span', {
            class: 'chip',
            style: { background: '#E8FF8B', color: '#022B23', fontSize: '9.5px', padding: '2px 6px' },
          }, 'CURRENT') : null,
        ),
        el('p', { class: 'text-[12.5px] text-ink-2 mt-0.5 leading-relaxed' }, imp.note),
      ),
    ));
  });
  card.appendChild(list);
  return card;
}
