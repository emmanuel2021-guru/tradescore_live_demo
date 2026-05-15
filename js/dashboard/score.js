import { el, animate, icon } from '../utils.js';
import { FACTORS as MOCK_FACTORS } from '../data.js';
import { getUser, getScore, getInsights, onScoreUpdated, onInsightsUpdated } from '../store.js';
import { ScoreGauge } from '../components/scoreGauge.js';

export function ScorePanel({ navigate }) {
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  // Three host containers refilled on every score/insights update so the
  // panel reacts to a "Send ₦" click on the Overview tab without forcing
  // the user to navigate away and come back.
  const heroHost     = el('div', { class: 'fade-up' });
  const factorsHost  = el('div', { class: 'fade-up-1' });
  const tipsHost     = el('div', { class: 'fade-up-2' });
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

// ── Hero (gauge + AI insight) ─────────────────────────────────
function buildHero(navigate) {
  const TRADER = getUser();
  const liveScore = getScore();
  const insights = getInsights();
  const claudeInsight = insights?.payload?.insight;

  const hasScore = liveScore?.score != null;
  const score = liveScore?.score ?? 350;
  const ins = buildHeroInsight(liveScore, TRADER, claudeInsight);

  const top = el('div', {
    class: 'rounded-2xl p-6 lg:p-8 grid lg:grid-cols-[280px_1fr] gap-8 items-center',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 16px 40px rgba(2, 43, 35, 0.20)',
    },
  });

  // Left: gauge or placeholder
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

  // Right: Claude-or-template narrative
  const right = el('div', {});
  right.appendChild(el('div', { class: 'flex items-center gap-2 mb-2' },
    el('span', { class: 'chip', style: { background: 'rgba(232,255,139,0.18)', color: '#E8FF8B' } },
      icon('stars'), claudeInsight ? 'AI INSIGHT · GENERATED LIVE' : 'INSIGHT'),
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
      onClick: () => navigate('/app/assistant'),
    }, icon('chat-square-quote'), 'Ask AI a follow-up'),
    el('button', {
      class: 'btn !py-2.5 !px-4 !text-[13px] text-white border border-white/30 hover:bg-white/10',
      onClick: () => navigate('/app/loans'),
    }, 'See loan options', icon('arrow-right')),
  ));
  top.appendChild(right);
  return top;
}

// Prefers Claude's headline+body when present; falls back to a clean templated
// narrative. Returns shape: { headline, body[], delta }.
function buildHeroInsight(liveScore, trader, claudeInsight) {
  // No score yet at all
  if (!liveScore || liveScore.score == null) {
    return {
      headline: 'No TradeScore yet',
      body: [
        `${trader.firstName || 'Hi'} — your account doesn't have any Squad inflows yet, so we can't compute a score.`,
        `Once the **first 3 payments** land in your virtual account, we'll compute a starter score and explain every factor.`,
        `Head back to **Overview** and use the simulate-payment card to send a test payment right now.`,
      ],
      delta: null,
    };
  }

  if (claudeInsight && claudeInsight.headline && Array.isArray(claudeInsight.body)) {
    return {
      headline: claudeInsight.headline,
      body: claudeInsight.body,
      delta: liveScore.delta ?? null,
    };
  }

  // Templated fallback (uses the live numbers we already have)
  const factors = [...(liveScore.factors || [])];
  const top  = factors.slice().sort((a, b) => b.value - a.value)[0];
  const weak = factors.slice().sort((a, b) => a.value - b.value)[0];
  const agg = liveScore.aggregates || {};
  const txN = agg.transactions || 0;
  const uN  = agg.uniqueCustomers || 0;
  const body = [];
  body.push(`${trader.firstName || 'Hi'}, your TradeScore of ${liveScore.score} is built from ${txN} ${txN === 1 ? 'transaction' : 'transactions'} across ${uN} unique ${uN === 1 ? 'payer' : 'payers'} on your Squad virtual account.`);
  if (top)  body.push(`Your strongest factor is **${top.label}** (${top.value}/100) — ${top.desc.toLowerCase()}.`);
  if (weak && weak.label !== top?.label) {
    body.push(`The biggest lift remaining is **${weak.label}** (${weak.value}/100). Focusing here will move the score fastest.`);
  }
  return {
    headline: liveScore.score >= 720 ? `Top tier — ${liveScore.score}/850.`
            : liveScore.score >= 600 ? `Solid base at ${liveScore.score}/850.`
            : `Early days at ${liveScore.score}/850 — let's build it.`,
    body,
    delta: liveScore.delta ?? null,
  };
}

// ── Factor breakdown ──────────────────────────────────────────
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
  // Drop the misleading "hover for AI explanation" hint — we never implemented
  // that tooltip. Replaced with an honest description of the formula.
  card.appendChild(el('p', { class: 'text-[13px] text-ink-3 mb-6' },
    'TradeScore = 350 + Σ (factor × weight) × 5. Each factor reads directly from your Squad inflows.'));

  const grid = el('div', { class: 'grid md:grid-cols-2 gap-4' });
  factors.forEach((f, i) => grid.appendChild(FactorCard(f, i)));
  card.appendChild(grid);
  return card;
}

// ── Boost tips (Claude-narrated, real point-gain math) ────────
function buildTips() {
  const insights = getInsights();
  const claudeTips = insights?.payload?.boost_tips || [];
  const skeletons = insights?.boost_skeletons || [];

  const tips = el('div', { class: 'card p-6' });
  tips.appendChild(el('h3', {
    class: 'font-display text-[18px] font-extrabold text-squad-deep mb-1',
    style: { letterSpacing: '-0.02em' },
  }, 'Boost your score'));
  tips.appendChild(el('p', { class: 'text-[12.5px] text-ink-3 mb-5' },
    skeletons.length
      ? 'AI-prioritised by the score-point gain each action would unlock over the next 30 days.'
      : 'Specific actions will appear here once your TradeScore has at least one factor with room to improve.'));

  if (!skeletons.length) return tips;

  const list = el('div', { class: 'space-y-3' });
  skeletons.forEach((s, i) => {
    const body = claudeTips[i] || fallbackTipBody(s);
    const title = tipTitleForFactor(s.factor, s.current, s.target);
    list.appendChild(el('div', {
      class: 'flex gap-4 p-4 rounded-xl border border-line hover:border-squad-green hover:bg-squad-pale/30 transition cursor-pointer',
      style: { animation: `fadeUp 0.5s ${0.1 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both` },
    },
      el('div', {
        class: 'font-display font-extrabold text-[18px] flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
        style: { background: '#E8FF8B', color: '#022B23' },
      }, '+' + s.gainPoints),
      el('div', { class: 'flex-1' },
        el('div', { class: 'flex items-center gap-2 flex-wrap' },
          el('span', { class: 'text-[14px] font-bold text-ink-1' }, title),
          el('span', {
            class: 'chip',
            style: { background: '#E8F4EE', color: '#0B6E4F', padding: '2px 8px', fontSize: '10.5px' },
          }, `${s.current} → ${s.target}`),
        ),
        el('div', { class: 'text-[12.5px] text-ink-2 leading-relaxed mt-0.5' }, body),
      ),
      el('span', { class: 'text-ink-3 self-center', style: { fontSize: '14px' } }, icon('arrow-right')),
    ));
  });
  tips.appendChild(list);
  return tips;
}

function tipTitleForFactor(label, _current, _target) {
  switch (label) {
    case 'Transaction Volume':  return 'Process more payments through Squad';
    case 'Payment Consistency': return 'Spread inflows evenly across the week';
    case 'Business Growth':     return 'Lift this month\'s revenue above last';
    case 'Account Longevity':   return 'Stay active — this grows with time';
    case 'Customer Diversity':  return 'Get more unique customers paying you';
    default:                    return `Improve ${label}`;
  }
}

function fallbackTipBody(s) {
  switch (s.factor) {
    case 'Transaction Volume':  return `Push your monthly inflow up so this factor moves from ${s.current}/100 toward ${s.target}/100.`;
    case 'Payment Consistency': return `Spread inflows more evenly to take this from ${s.current} to ${s.target}.`;
    case 'Business Growth':     return `A higher revenue month vs. last month would lift this from ${s.current} to ${s.target}.`;
    case 'Account Longevity':   return `Each month you stay active raises this. From ${s.current} now toward ${s.target}.`;
    case 'Customer Diversity':  return `Earn payments from more unique customers to push this from ${s.current} to ${s.target}.`;
    default:                    return `Move this factor from ${s.current} to ${s.target} to gain ${s.gainPoints} score points.`;
  }
}

// ── Factor card with animated bar ─────────────────────────────
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
