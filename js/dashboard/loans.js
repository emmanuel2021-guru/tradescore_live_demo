import { el, fmt, icon, toast } from '../utils.js';
import { LOAN_TIERS } from '../data.js';
import { getUser, getScore, refreshTxsFromServer } from '../store.js';
import { recommendLoan } from '../ai.js';
import { api } from '../api.js';

export function LoansPanel() {
  const TRADER = getUser();
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
      el('h3', { class: 'font-display text-[20px] font-extrabold text-squad-deep' }, 'GTBank loan products'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        'Live rates from GTBank — tiers unlock as your TradeScore grows.'),
    ),
    el('span', { class: 'chip', style: { background: '#FFF4E0', color: '#7B5500' } },
      icon('bank2'), 'Powered by GTBank'),
  ));
  const tiersGrid = el('div', { class: 'grid md:grid-cols-2 lg:grid-cols-4 gap-4' });
  LOAN_TIERS.forEach((t, i) => tiersGrid.appendChild(TierCard(t, userScore >= t.minScore, i)));
  tiersWrap.appendChild(tiersGrid);
  root.appendChild(tiersWrap);

  // ── Calculator ───────────────────────────────────────────
  root.appendChild(buildCalculator({ userScore, monthlyRevenue, preApproved }));

  return root;
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
function buildCalculator({ userScore, monthlyRevenue, preApproved, navigate }) {
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
