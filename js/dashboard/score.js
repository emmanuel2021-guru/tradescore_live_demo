import { el, animate, icon } from '../utils.js';
import { FACTORS as MOCK_FACTORS } from '../data.js';
import { getUser, getScore, getInsights, onScoreUpdated, onInsightsUpdated } from '../store.js';
import { ScoreGauge } from '../components/scoreGauge.js';
import { generateScoreInsight } from '../ai.js';

export function ScorePanel({ navigate }) {
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  // Hosts are repainted on every score/insights update so the panel reacts to
  // a fresh inflow on the Overview tab without forcing a navigation.
  const heroHost    = el('div', { class: 'fade-up' });
  const factorsHost = el('div', { class: 'fade-up-1' });
  const tipsHost    = el('div', { class: 'fade-up-2' });
  root.appendChild(heroHost);
  root.appendChild(factorsHost);
  root.appendChild(tipsHost);

  function render() {
    heroHost.innerHTML    = '';
    factorsHost.innerHTML = '';
    tipsHost.innerHTML    = '';
    heroHost.appendChild(buildHero(navigate));
    factorsHost.appendChild(buildFactors());
    tipsHost.appendChild(buildTips());
  }
  render();
  onScoreUpdated(() => render());
  onInsightsUpdated(() => render());

  return root;
}

// ── Top hero card ────────────────────────────────────────────
function buildHero(navigate) {
  const TRADER = getUser();
  const liveScore = getScore();
  const insights = getInsights();
  const claudeInsight = insights?.payload?.insight;

  const hasScore = liveScore?.score != null;
  const score = liveScore?.score ?? 350;
  const ins = resolveInsight(liveScore, TRADER, claudeInsight);

  const top = el('div', {
    class: 'rounded-2xl p-6 lg:p-8 grid lg:grid-cols-[280px_1fr] gap-8 items-center',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 16px 40px rgba(2, 43, 35, 0.20)',
    },
  });

  const gaugeWrap = el('div', { class: 'flex justify-center gauge-text-light' });
  if (hasScore) {
    gaugeWrap.appendChild(ScoreGauge({ score, size: 240 }));
  } else {
    gaugeWrap.appendChild(el('div', {
      class: 'flex flex-col items-center justify-center text-center',
      style: { width: '240px', height: '173px' },
    },
      el('div', {
        class: 'font-display text-white font-extrabold',
        style: { fontSize: '64px', lineHeight: '1', letterSpacing: '-2px' },
      }, '—'),
      el('div', {
        class: 'mt-2 text-[12px] font-bold uppercase tracking-[0.15em]',
        style: { color: 'rgba(232,255,139,0.85)' },
      }, 'No score yet'),
      el('div', {
        class: 'mt-1 text-[11px]',
        style: { color: 'rgba(255,255,255,0.55)' },
      }, '350–850 once payments arrive'),
    ));
  }
  // Force gauge text colors on dark bg
  setTimeout(() => {
    gaugeWrap.querySelectorAll('text').forEach((t, i) => {
      if (i === 0) t.style.fill = '#fff';
      else if (i >= 2) t.style.fill = 'rgba(255,255,255,0.55)';
    });
  }, 0);
  top.appendChild(gaugeWrap);

  const right = el('div', {});
  right.appendChild(el('div', { class: 'flex items-center gap-2 mb-2 flex-wrap' },
    el('span', { class: 'chip', style: { background: 'rgba(232,255,139,0.18)', color: '#E8FF8B' } },
      icon('stars'), claudeInsight ? 'AI INSIGHT · LIVE' : 'INSIGHT'),
    ins.delta != null && ins.delta !== 0
      ? el('span', {
          class: 'chip',
          style: {
            background: ins.delta > 0 ? 'rgba(39,174,96,0.20)' : 'rgba(212,62,62,0.20)',
            color: ins.delta > 0 ? '#5DDB95' : '#FF8888',
          },
        }, icon(ins.delta > 0 ? 'arrow-up-short' : 'arrow-down-short'),
           `${ins.delta > 0 ? '+' : ''}${ins.delta} since last sync`)
      : null,
    ins.confidence
      ? el('span', { class: 'text-[11px]', style: { color: 'rgba(232,255,139,0.65)' } },
          `Confidence ${Math.round(ins.confidence * 100)}%`)
      : null,
  ));
  right.appendChild(el('h2', {
    class: 'font-display text-white text-[24px] lg:text-[30px] font-extrabold leading-tight',
    style: { letterSpacing: '-0.025em' },
  }, ins.headline));
  const body = el('div', { class: 'mt-4 space-y-2.5 max-w-[640px]' });
  ins.body.forEach(t => body.appendChild(el('p', {
    class: 'text-[14px] leading-relaxed ai-text',
    style: { color: 'rgba(255,255,255,0.78)' },
    html: t.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#E8FF8B;">$1</strong>'),
  })));
  right.appendChild(body);
  right.appendChild(el('div', { class: 'flex flex-wrap gap-3 mt-5' },
    el('button', {
      class: 'btn btn-lime !py-2.5 !px-4 !text-[13px]',
      onClick: () => navigate('#/app/assistant'),
    }, icon('chat-square-quote'), 'Ask AI a follow-up'),
    el('button', {
      class: 'btn !py-2.5 !px-4 !text-[13px] text-white border border-white/30 hover:bg-white/10',
      onClick: () => navigate('#/app/loans'),
    }, 'See loan options', icon('arrow-right')),
  ));
  top.appendChild(right);
  return top;
}

// Prefers Claude's headline+body when present; falls back to templated
// narrative built from live score, or the ai.js mock for empty state.
function resolveInsight(liveScore, trader, claudeInsight) {
  if (!liveScore || liveScore.score == null) {
    const m = generateScoreInsight();
    return { headline: m.headline, body: m.body, delta: null, confidence: m.confidence };
  }
  if (claudeInsight?.headline && Array.isArray(claudeInsight.body)) {
    return {
      headline: claudeInsight.headline,
      body: claudeInsight.body,
      delta: liveScore.delta ?? null,
      confidence: 0.92,
    };
  }
  const factors = [...(liveScore.factors || [])];
  const top  = factors.slice().sort((a, b) => b.value - a.value)[0];
  const weak = factors.slice().sort((a, b) => a.value - b.value)[0];
  const agg  = liveScore.aggregates || {};
  const txN  = agg.transactions || 0;
  const uN   = agg.uniqueCustomers || 0;
  const body = [];
  body.push(`${trader.firstName || 'Hi'}, your TradeScore of ${liveScore.score} is built from ${txN} ${txN === 1 ? 'transaction' : 'transactions'} across ${uN} unique ${uN === 1 ? 'payer' : 'payers'} on your Squad virtual account.`);
  if (top)  body.push(`Your strongest factor is **${top.label}** (${top.value}/100) — ${top.desc.toLowerCase()}.`);
  if (weak && weak.label !== top?.label) {
    body.push(`The biggest lift remaining is **${weak.label}** (${weak.value}/100). Focusing here moves the score fastest.`);
  }
  return {
    headline: liveScore.score >= 750 ? `Your score is in the top tier — ${liveScore.score}/850.`
            : liveScore.score >= 650 ? `Solid base at ${liveScore.score}/850.`
            : `Early days at ${liveScore.score}/850 — let's build it.`,
    body,
    delta: liveScore.delta ?? null,
    confidence: 0.88,
  };
}

// ── Factor breakdown ────────────────────────────────────────
function buildFactors() {
  const liveScore = getScore();
  const factors = liveScore?.factors?.length ? liveScore.factors : MOCK_FACTORS;

  const card = el('div', { class: 'card p-6' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-1' },
    el('h3', {
      class: 'font-display text-[20px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, 'How your score is built'),
    el('span', { class: 'chip', style: { background: '#F5F5F0', color: '#4A5C56' } },
      '5 factors · weighted'),
  ));
  card.appendChild(el('p', { class: 'text-[13px] text-ink-3 mb-6' },
    liveScore
      ? 'TradeScore = 350 + Σ (factor × weight) × 5. Each factor reads directly from your Squad inflows.'
      : 'TradeScore = Σ (factor × weight). Shown values are illustrative until your first payment arrives.'));

  const grid = el('div', { class: 'grid md:grid-cols-2 gap-4' });
  factors.forEach((f, i) => grid.appendChild(FactorCard(f, i)));
  card.appendChild(grid);
  return card;
}

// ── Boost tips (Claude-narrated if present) ─────────────────
function buildTips() {
  const insights = getInsights();
  const claudeTips = insights?.payload?.boost_tips || [];
  const skeletons  = insights?.boost_skeletons || [];

  const tips = el('div', { class: 'card p-6' });
  tips.appendChild(el('h3', {
    class: 'font-display text-[18px] font-extrabold text-squad-deep mb-1',
    style: { letterSpacing: '-0.02em' },
  }, 'Boost your score'));
  tips.appendChild(el('p', { class: 'text-[12.5px] text-ink-3 mb-5' },
    skeletons.length
      ? 'AI-prioritised by the score-point gain each action would unlock over the next 30 days.'
      : 'Specific actions appear here once your TradeScore has at least one factor with room to improve.'));

  // Fallback static tips when we have no live skeletons yet — mirrors the
  // attached new design exactly so the panel never feels empty in a demo.
  const items = skeletons.length
    ? skeletons.map((s, i) => ({
        gain: '+' + s.gainPoints,
        title: tipTitleForFactor(s.factor),
        body: claudeTips[i] || fallbackTipBody(s),
        chip: `${s.current} → ${s.target}`,
      }))
    : [
        { gain: '+8', title: 'Encourage 8 more unique customers', body: 'Promote your Squad QR at the till. Improves Customer Diversity from 79 → 86.' },
        { gain: '+5', title: 'Maintain daily inflow streak',      body: 'Hold your 12-month consistency for 4 more weeks to unlock the 18-month bonus tier.' },
        { gain: '+4', title: 'Diversify outflow types',           body: 'Currently 53% of outflows are stock — adding utility/payroll improves the cash-flow signature.' },
        { gain: '+3', title: 'Repay one loan on time',            body: 'A clean repayment cycle is the single biggest signal we can give the lending tier.' },
      ];

  const tipList = el('div', { class: 'space-y-3' });
  items.forEach((t, i) => tipList.appendChild(el('div', {
    class: 'flex gap-4 p-4 rounded-xl border border-line hover:border-squad-green hover:bg-squad-pale/30 transition cursor-pointer',
    style: { animation: `fadeUp 0.5s ${0.1 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both` },
  },
    el('div', {
      class: 'font-display font-extrabold text-[18px] flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
      style: { background: '#E8FF8B', color: '#022B23' },
    }, t.gain),
    el('div', { class: 'flex-1' },
      el('div', { class: 'flex items-center gap-2 flex-wrap' },
        el('span', { class: 'text-[14px] font-bold text-ink-1' }, t.title),
        t.chip ? el('span', {
          class: 'chip',
          style: { background: '#E8F4EE', color: '#0B6E4F', padding: '2px 8px', fontSize: '10.5px' },
        }, t.chip) : null,
      ),
      el('div', { class: 'text-[12.5px] text-ink-2 leading-relaxed mt-0.5' }, t.body),
    ),
    el('span', { class: 'text-ink-3 self-center', style: { fontSize: '14px' } }, icon('arrow-right')),
  )));
  tips.appendChild(tipList);
  return tips;
}

function tipTitleForFactor(label) {
  switch (label) {
    case 'Transaction Volume':  return 'Process more payments through Squad';
    case 'Payment Consistency': return 'Spread inflows evenly across the week';
    case 'Business Growth':     return "Lift this month's revenue above last";
    case 'Account Longevity':   return 'Stay active — this grows with time';
    case 'Customer Diversity':  return 'Get more unique customers paying you';
    default:                    return `Improve ${label}`;
  }
}
function fallbackTipBody(s) {
  return `Move ${s.factor} from ${s.current}/100 toward ${s.target}/100 to gain ${s.gainPoints} score points over the next 30 days.`;
}

// ── Factor card with animated bar ───────────────────────────
function FactorCard(f, idx) {
  const card = el('div', {
    class: 'p-5 rounded-2xl border border-line bg-white card-hover',
    style: { animation: `fadeUp 0.5s ${0.05 + idx * 0.06}s cubic-bezier(0.22,1,0.36,1) both` },
  });
  card.appendChild(el('div', { class: 'flex items-start justify-between mb-1' },
    el('div', {},
      el('div', { class: 'text-[14px] font-bold text-ink-1' }, f.label),
      el('div', { class: 'text-[12px] text-ink-3 mt-0.5' }, f.desc),
    ),
    el('div', {
      class: 'font-display font-extrabold',
      style: { color: '#0B6E4F', fontSize: '24px', letterSpacing: '-0.5px' },
    }, '0'),
  ));
  const scoreEl = card.querySelector('.font-display');
  animate({ to: f.value, duration: 1100, onUpdate: v => scoreEl.textContent = Math.round(v) });

  const track = el('div', {
    class: 'mt-3 h-[7px] rounded-full overflow-hidden',
    style: { background: '#E2E8E4' },
  });
  const bar = el('div', {
    class: 'h-full rounded-full',
    style: {
      width: '0%',
      background: 'linear-gradient(90deg, #1F8A65, #27AE60)',
      transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
    },
  });
  track.appendChild(bar);
  card.appendChild(track);
  card.appendChild(el('div', {
    class: 'mt-2 text-[10.5px] font-bold uppercase tracking-wider',
    style: { color: '#9AA8A2' },
  }, `Weight in score: ${f.weight}%`));

  setTimeout(() => { bar.style.width = f.value + '%'; }, 200 + idx * 50);
  return card;
}
