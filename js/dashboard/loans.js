import { el, fmt, icon } from '../utils.js';
import { LOAN_TIERS } from '../data.js';
import { getUser, getScore, refreshTxsFromServer } from '../store.js';
import { api } from '../api.js';

// Derive a borrowing ceiling + working score from live data, falling back to
// safe zeros (no loan offers) when the user has nothing tracked yet.
function liveLoanContext(trader) {
  const score = getScore();
  const userScore = score?.score ?? trader.score ?? 0;
  // Walk LOAN_TIERS top-down; the highest tier whose minScore is met sets
  // the eligibility ceiling.
  const topTier = [...LOAN_TIERS].reverse().find(t => userScore >= t.minScore);
  const loanEligible = topTier?.max ?? 0;
  return { userScore, loanEligible };
}

export function LoansPanel({ navigate }) {
  const TRADER = getUser();
  const { userScore, loanEligible } = liveLoanContext(TRADER);
  // Patch the user object with live-derived values so the calculator (which
  // still reads TRADER.score / TRADER.loanEligible) behaves correctly.
  TRADER.score = userScore;
  TRADER.loanEligible = loanEligible;

  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });

  // ── Hero / eligibility ────────────────────────────────────
  const hero = el('div', {
    class: 'grid lg:grid-cols-[1.4fr_1fr] gap-5 fade-up',
  });

  // Big card
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
  }, loanEligible > 0 ? "You're pre-approved for" : 'Build your TradeScore to unlock'));
  big.appendChild(el('div', {
    class: 'font-display font-extrabold text-white relative mt-1',
    style: { fontSize: '52px', lineHeight: '1.05', letterSpacing: '-0.04em' },
  }, loanEligible > 0 ? fmt(loanEligible) : 'No offers yet'));
  big.appendChild(el('div', { class: 'text-[14px] mt-1 relative', style: { color: 'rgba(255,255,255,0.7)' } },
    loanEligible > 0
      ? `Based on TradeScore ${userScore} · From 2.2% / month`
      : `Current TradeScore ${userScore || '—'} · Reach 600 to unlock Quick Float`));

  // AI rec (only when the user actually qualifies for something).
  // Computed live from the score engine's monthlyRevenue — same 18% safe-
  // repayment heuristic as the Overview loan card.
  if (loanEligible > 0) {
    const liveScore = getScore();
    const monthlyRevenue = liveScore?.aggregates?.monthlyRevenue || 0;
    const safeMonthly = Math.round(monthlyRevenue * 0.18);
    const recommendedRaw = Math.max(20_000, Math.round((safeMonthly * 2) / 5_000) * 5_000);
    let bestTier = null;
    for (const t of LOAN_TIERS) {
      if (userScore >= t.minScore && t.max >= recommendedRaw) {
        if (!bestTier || t.rateMonthly < bestTier.rateMonthly) bestTier = t;
      }
    }
    if (!bestTier) bestTier = [...LOAN_TIERS].reverse().find(t => userScore >= t.minScore) || null;

    const recAmount = Math.min(recommendedRaw, loanEligible);
    const recRate   = bestTier?.rateMonthly ?? 2.2;
    const recTerm   = bestTier?.term ?? '60 days';
    const reason = monthlyRevenue > 0
      ? `Stock-up loans match your inflow rhythm. At ${fmt(recAmount)}, repayment uses about ${Math.round((safeMonthly / monthlyRevenue) * 100)}% of your ${fmt(monthlyRevenue)} monthly revenue.`
      : 'Send a few inflows to your virtual account so we can recommend a safe amount based on your real cashflow.';

    const aiBox = el('div', {
      class: 'mt-5 p-4 rounded-2xl glass relative',
    });
    aiBox.appendChild(el('div', { class: 'flex items-center gap-2 mb-1' },
      el('span', { style: { color: '#E8FF8B', fontSize: '14px' } }, icon('stars')),
      el('span', { class: 'text-[10.5px] font-extrabold uppercase tracking-[0.15em]', style: { color: '#E8FF8B' } },
        'AI recommendation'),
    ));
    aiBox.appendChild(el('div', {
      class: 'text-white text-[15px] leading-relaxed',
      html: `Borrow <strong style="color:#E8FF8B;">${fmt(recAmount)}</strong> over <strong style="color:#E8FF8B;">${recTerm}</strong> at <strong style="color:#E8FF8B;">${recRate}%/mo</strong>. ${reason}`,
    }));
    big.appendChild(aiBox);
  }
  hero.appendChild(big);

  // Right: 3 quick stats
  const right = el('div', { class: 'grid gap-4' });
  right.appendChild(StatCard({ iconName: 'percent', label: 'Lowest rate available', value: '2.2%', sub: 'per month', accent: '#0B6E4F' }));
  right.appendChild(StatCard({ iconName: 'calendar3', label: 'Max term', value: '120', sub: 'days', accent: '#1F8A65' }));
  right.appendChild(StatCard({ iconName: 'lightning-charge', label: 'Funding speed', value: '< 5', sub: 'minutes', accent: '#27AE60' }));
  hero.appendChild(right);

  root.appendChild(hero);

  // ── Loan tiers grid ──────────────────────────────────────
  const tiersWrap = el('div', { class: 'fade-up-1' });
  tiersWrap.appendChild(el('div', { class: 'flex items-center justify-between mb-4' },
    el('div', {},
      el('h3', { class: 'font-display text-[20px] font-extrabold text-squad-deep' }, 'Loan products'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        'Tiers unlock as your TradeScore grows. Tap any tier to apply.'),
    ),
  ));
  const tiersGrid = el('div', { class: 'grid md:grid-cols-2 lg:grid-cols-4 gap-4' });
  LOAN_TIERS.forEach((t, i) => tiersGrid.appendChild(TierCard(t, TRADER.score >= t.minScore, i)));
  tiersWrap.appendChild(tiersGrid);
  root.appendChild(tiersWrap);

  // ── Calculator ────────────────────────────────────────────
  root.appendChild(buildCalculator(TRADER, navigate));

  // ── Loan history (real, fetched from /api/loans) ──────────
  root.appendChild(buildLoanHistory());

  return root;
}

// Fetches the user's disbursed/pending/failed loans from /api/loans and
// renders them. Empty state shown while we wait or if there are none.
function buildLoanHistory() {
  const card = el('div', { class: 'card p-6 fade-up-3' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-1' },
    el('h3', {
      class: 'font-display text-[20px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, 'Loan history'),
    el('span', { class: 'chip', style: { background: '#F5F5F0', color: '#4A5C56' } },
      'From Squad Payout API'),
  ));
  card.appendChild(el('p', { class: 'text-[13px] text-ink-3 mb-5' },
    'Every loan you’ve applied for, with the real NIP reference from Squad.'));

  const list = el('div', { class: 'space-y-3' },
    el('div', { class: 'p-6 text-center text-[13px] text-ink-3' }, 'Loading…'),
  );
  card.appendChild(list);

  api.loans.list().then(resp => {
    list.innerHTML = '';
    const loans = resp?.loans || [];
    if (!loans.length) {
      list.appendChild(el('div', {
        class: 'p-6 text-center rounded-xl border border-dashed border-line text-[13px] text-ink-2',
      },
        el('div', { class: 'font-semibold text-ink-1 mb-1' }, 'No loans yet'),
        el('div', {}, 'When you apply for a loan, it’ll appear here with its NIP reference and disbursement status.'),
      ));
      return;
    }
    loans.forEach(l => list.appendChild(buildLoanRow(l)));
  }).catch(err => {
    console.warn('[loans/history] failed:', err);
    list.innerHTML = '';
    list.appendChild(el('div', {
      class: 'p-4 rounded-xl text-[13px]',
      style: { background: '#FCE8E8', color: '#9A1F1F' },
    }, 'Could not load loan history. Make sure the backend is running.'));
  });

  return card;
}

function buildLoanRow(loan) {
  const status = loan.status || 'pending';
  const tone = status === 'disbursed'      ? { bg: '#E5F9F0', fg: '#27AE60', label: 'Disbursed' }
            : status === 'demo_disbursed'  ? { bg: '#FFF8DA', fg: '#7B5500', label: 'Sandbox demo' }
            : status === 'failed'          ? { bg: '#FCE8E8', fg: '#D43E3E', label: 'Failed' }
            : { bg: '#FFF8DA', fg: '#B58400', label: 'Pending' };

  const row = el('div', {
    class: 'flex flex-wrap items-center gap-4 p-4 rounded-xl border border-line',
  });
  row.appendChild(el('div', {
    class: 'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
    style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '17px' },
  }, icon('cash-coin')));

  const meta = el('div', { class: 'flex-1 min-w-0' });
  meta.appendChild(el('div', { class: 'flex items-center gap-2 flex-wrap' },
    el('span', { class: 'text-[14px] font-bold text-ink-1' }, fmt(Math.round((loan.amount_kobo || 0) / 100))),
    el('span', { class: 'chip', style: { background: tone.bg, color: tone.fg } }, tone.label),
    loan.purpose ? el('span', {
      class: 'chip',
      style: { background: '#F5F5F0', color: '#4A5C56' },
    }, loan.purpose) : null,
  ));

  const detailParts = [];
  detailParts.push(`${loan.rate_monthly ?? '—'}% / month`);
  detailParts.push(`${loan.term_days || '—'} days`);
  if (loan.nip_ref)       detailParts.push(`NIP ${loan.nip_ref}`);
  if (loan.disbursed_at)  detailParts.push(`disbursed ${formatShortDate(loan.disbursed_at)}`);
  else if (loan.created_at) detailParts.push(`requested ${formatShortDate(loan.created_at)}`);
  meta.appendChild(el('div', {
    class: 'text-[11.5px] text-ink-3 mt-1 break-all',
  }, detailParts.join(' · ')));

  row.appendChild(meta);
  return row;
}

function formatShortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ iconName, label, value, sub, accent }) {
  return el('div', { class: 'card p-5 flex items-center gap-4' },
    el('div', {
      class: 'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
      style: { background: '#E8F4EE', color: accent, fontSize: '20px' },
    }, icon(iconName)),
    el('div', { class: 'min-w-0' },
      el('div', { class: 'text-[10.5px] uppercase tracking-[0.1em] text-ink-3 font-bold' }, label),
      el('div', { class: 'flex items-baseline gap-1.5 mt-0.5' },
        el('span', {
          class: 'font-display font-extrabold text-squad-deep',
          style: { fontSize: '28px', letterSpacing: '-0.025em' },
        }, value),
        el('span', { class: 'text-[12.5px] font-medium', style: { color: accent } }, sub),
      ),
    ),
  );
}

function TierCard(t, eligible, i) {
  const card = el('div', {
    class: 'card p-5 ' + (eligible ? 'card-hover cursor-pointer' : 'opacity-60'),
    style: { animation: `fadeUp 0.5s ${0.05 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both` },
  });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-3' },
    el('div', {
      class: 'w-10 h-10 rounded-xl flex items-center justify-center',
      style: {
        background: eligible ? '#E8F4EE' : '#F5F5F0',
        color: eligible ? '#0B6E4F' : '#9AA8A2',
        fontSize: '17px',
      },
    }, icon(eligible ? 'unlock-fill' : 'lock-fill')),
    el('span', {
      class: 'chip',
      style: eligible
        ? { background: '#E5F9F0', color: '#27AE60' }
        : { background: '#F5F5F0', color: '#9AA8A2' },
    }, eligible ? 'Eligible' : `Need ${t.minScore}+`),
  ));
  card.appendChild(el('h4', {
    class: 'font-display text-[18px] font-extrabold text-squad-deep',
    style: { letterSpacing: '-0.02em' },
  }, t.name));
  card.appendChild(el('p', { class: 'text-[12px] text-ink-3 mt-0.5 mb-4' }, t.desc));
  card.appendChild(el('div', { class: 'flex items-baseline gap-1.5' },
    el('span', { class: 'font-display font-extrabold text-squad-deep', style: { fontSize: '28px' } },
      'Up to ' + fmt(t.max)),
  ));
  card.appendChild(el('div', { class: 'text-[12px] text-ink-2 mt-1' },
    `${t.rateMonthly}% / month · ${t.term}`));
  return card;
}

// ── Calculator ────────────────────────────────────────────────
function buildCalculator(TRADER, _navigate) {
  const maxAmount = TRADER.loanEligible || 0;

  // Calculator is meaningless until the user qualifies for at least one tier.
  // Show an honest locked card instead of a broken slider with max=0.
  if (maxAmount <= 0) {
    const lockedCard = el('div', { class: 'card p-8 fade-up-2 text-center' });
    lockedCard.appendChild(el('div', {
      class: 'w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center',
      style: { background: '#F5F5F0', color: '#9AA8A2', fontSize: '22px' },
    }, icon('lock-fill')));
    lockedCard.appendChild(el('h3', {
      class: 'font-display text-[18px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, 'Loan calculator unlocks at 600'));
    lockedCard.appendChild(el('p', { class: 'text-[13px] text-ink-2 mt-1.5 max-w-[440px] mx-auto leading-relaxed' },
      `Your TradeScore is currently ${TRADER.score || '—'}. Reach 600 to unlock the Quick Float tier and the loan calculator. Keep receiving payments to your Squad virtual account — your score updates automatically.`));
    return lockedCard;
  }

  // Live monthly revenue feeds the repayment-safety % math below. Falls back
  // to 0 if no aggregates yet (which means we just won't show the % note).
  const monthlyRevenue = (getScore()?.aggregates?.monthlyRevenue) || 0;

  // Initial amount is the smaller of ₦250k (the original default) and what
  // this user can actually borrow — never above the slider max.
  let amount = Math.min(250000, maxAmount);
  if (amount < 20000) amount = Math.min(20000, maxAmount);
  let term   = '60 days';

  const card = el('div', { class: 'card p-6 lg:p-8 fade-up-2' });
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-1' },
    el('h3', {
      class: 'font-display text-[20px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, 'Loan calculator'),
    el('span', { class: 'chip', style: { background: '#E8F4EE', color: '#0B6E4F' } },
      icon('stars'), 'Auto-rate from your score'),
  ));
  card.appendChild(el('p', { class: 'text-[13px] text-ink-3 mb-6' },
    'Pick an amount and term — we’ll match the lowest rate your TradeScore unlocks.'));

  const grid = el('div', { class: 'grid lg:grid-cols-[1.3fr_1fr] gap-8' });

  // Left: controls
  const controls = el('div', {});

  // Amount slider
  controls.appendChild(el('label', { class: 'label' }, 'Loan amount'));
  const amountDisplay = el('div', {
    class: 'font-display font-extrabold text-squad-deep mb-3',
    style: { fontSize: '34px', letterSpacing: '-0.03em' },
  }, fmt(amount));
  controls.appendChild(amountDisplay);
  const slider = el('input', {
    type: 'range', min: '20000', max: String(maxAmount),
    step: '5000', value: String(amount),
    class: 'w-full',
  });
  controls.appendChild(slider);
  controls.appendChild(el('div', { class: 'flex justify-between mt-2 text-[11px] text-ink-3 font-semibold' },
    el('span', {}, fmt(20000)),
    el('span', {}, fmt(maxAmount)),
  ));

  // Term selector
  controls.appendChild(el('div', { class: 'label mt-7' }, 'Repayment period'));
  const termRow = el('div', { class: 'grid grid-cols-4 gap-2' });
  ['30 days', '60 days', '90 days', '120 days'].forEach(t => {
    const btn = el('button', {
      class: 'h-12 rounded-xl font-bold text-[13px] tap text-center transition-all',
      'data-term': t,
    }, t);
    btn.addEventListener('click', () => {
      term = t; paintTerms(); paint();
    });
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

  // Purpose
  controls.appendChild(el('div', { class: 'label mt-7' }, 'Purpose'));
  const purposeRow = el('div', { class: 'flex flex-wrap gap-2' });
  let purpose = 'stock';
  ['stock', 'rent', 'expansion', 'emergency', 'other'].forEach(p => {
    const btn = el('button', {
      class: 'px-4 py-2.5 rounded-full font-bold text-[12px] tap capitalize transition-all',
      'data-purpose': p,
    }, p);
    btn.addEventListener('click', () => {
      purpose = p; paintPurpose(); paint();
    });
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
    onClick: () => showLoanFlow({
      amount_kobo: amount * 100,
      amount_naira: amount,
      term_days: parseInt(term, 10),
      term_label: term,
      rate_monthly: pickRate(),
      purpose,
      trader: TRADER,
    }),
  }, 'Apply now', icon('arrow-right'));
  summary.appendChild(apply);

  grid.appendChild(summary);
  card.appendChild(grid);

  function pickRate() {
    const eligible = LOAN_TIERS.filter(t => t.minScore <= TRADER.score && t.max >= amount)
      .sort((a, b) => a.rateMonthly - b.rateMonthly);
    return eligible[0]?.rateMonthly ?? 3.5;
  }

  function paint() {
    const rate = pickRate();
    const months = parseInt(term, 10) / 30;
    const interest = Math.round(amount * (rate / 100) * months);
    const total = amount + interest;
    const installment = Math.round(total / months);

    amountDisplay.textContent = fmt(amount);
    totalEl.textContent = fmt(total);
    sumList.innerHTML = '';
    sumList.appendChild(rowKv('Loan amount', fmt(amount)));
    sumList.appendChild(rowKv('Interest rate', rate + '% / month'));
    sumList.appendChild(rowKv('Term', term));
    sumList.appendChild(rowKv('Total interest', fmt(interest)));
    sumList.appendChild(rowKv('Monthly instalment', fmt(installment), true));

    // Repayment-safety note. Falls back to a neutral message when we don't
    // yet have a monthly-revenue figure (so we never print "Infinity%").
    if (monthlyRevenue > 0) {
      const pct = Math.round((installment / monthlyRevenue) * 100);
      const safe = pct <= 25;
      aiNote.innerHTML = `<strong style="color:#E8FF8B;">AI:</strong> At ${fmt(installment)} / month, your repayment uses <strong style="color:#E8FF8B;">${pct}%</strong> of your ${fmt(monthlyRevenue)} average revenue — ${safe ? 'within the safe 18–25% range.' : 'above the safe 18–25% range; consider a smaller amount or longer term.'}`;
    } else {
      aiNote.innerHTML = `<strong style="color:#E8FF8B;">AI:</strong> Once a month of inflows is on record, we'll show how this repayment compares to your revenue.`;
    }
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

// ── Real loan disbursement flow ──────────────────────────────
// Three stages inside one overlay:
//   1) Collect bank + account number
//   2) Lookup account → confirm
//   3) Squad.transfer → success with real NIP reference
//
// At each stage we mutate the inner `modal` rather than the overlay, so the
// dim background and dismiss-on-outside-click behaviour stay consistent.
function showLoanFlow(ctx) {
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

  // Stage state — mutated as we move through the flow
  const state = {
    ...ctx,
    bank_code: '058',
    bank_name: 'GTBank',
    account_number: '',
    account_name: '',
    nip_ref: '',
    payout_ref: '',
  };

  // Banks list is fetched once, cached on first stage render
  let banksPromise = api.loans.banks().then(r => r.banks).catch(() => []);

  renderCollect();

  // ── Stage 1: collect bank + account ──────────────────────
  async function renderCollect() {
    modal.innerHTML = '';
    modal.appendChild(stageHeader('Where should we send it?',
      `Disbursing ${fmt(state.amount_naira)} to your bank account in seconds via Squad's Payout API.`));

    const banks = await banksPromise;
    if (banks.length && !banks.find(b => b.code === state.bank_code)) {
      state.bank_code = banks[0].code;
      state.bank_name = banks[0].name;
    }

    modal.appendChild(el('label', { class: 'label mt-1' }, 'Bank'));
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
      class: 'input', placeholder: '0123456789',
      inputmode: 'numeric', maxlength: '10',
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

    const cancel = el('button', {
      class: 'btn btn-ghost w-full mt-2 !py-3 !text-[13px]',
      onClick: close,
    }, 'Cancel');
    modal.appendChild(cancel);

    next.addEventListener('click', async () => {
      err.classList.add('hidden');
      const acct = acctInput.value.trim();
      if (!/^\d{10}$/.test(acct) && state.bank_code.length <= 4) {
        err.textContent = 'Account number must be 10 digits.';
        err.classList.remove('hidden');
        return;
      }
      state.account_number = acct;
      next.disabled = true;
      next.innerHTML = '';
      next.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
      next.appendChild(el('span', {}, 'Looking up…'));
      try {
        const lookup = await api.loans.lookupAccount({
          bank_code: state.bank_code,
          account_number: state.account_number,
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

  // ── Stage 2: confirm details ─────────────────────────────
  function renderConfirm() {
    modal.innerHTML = '';
    modal.appendChild(stageHeader('Confirm disbursement',
      'Please verify the recipient before we move funds.'));

    const card = el('div', {
      class: 'mt-2 p-5 rounded-2xl',
      style: { background: '#022B23' },
    });
    card.appendChild(el('div', { class: 'text-[10.5px] font-bold uppercase tracking-[0.18em]',
      style: { color: '#E8FF8B' } }, 'Recipient'));
    card.appendChild(el('div', {
      class: 'font-display text-white text-[22px] font-extrabold mt-1',
    }, state.account_name));
    card.appendChild(el('div', {
      class: 'text-[12.5px] mt-1', style: { color: 'rgba(255,255,255,0.7)' },
    }, `${state.bank_name} · ${state.account_number}`));
    modal.appendChild(card);

    const sum = el('div', {
      class: 'mt-4 p-4 rounded-xl space-y-2',
      style: { background: '#F5F5F0' },
    });
    sum.appendChild(rowKvL('Amount', fmt(state.amount_naira)));
    sum.appendChild(rowKvL('Rate', `${state.rate_monthly}% / month`));
    sum.appendChild(rowKvL('Term', state.term_label));
    sum.appendChild(rowKvL('Purpose', state.purpose));
    modal.appendChild(sum);

    const err = el('div', {
      class: 'mt-3 text-[12.5px] rounded-xl p-3 hidden',
      style: { background: '#FCE8E8', color: '#9A1F1F' },
    });
    modal.appendChild(err);

    const confirm = el('button', {
      class: 'btn btn-primary w-full mt-5 !py-3.5',
    }, icon('lightning-charge-fill'), 'Disburse now');
    modal.appendChild(confirm);

    modal.appendChild(el('button', {
      class: 'btn btn-ghost w-full mt-2 !py-3 !text-[13px]',
      onClick: renderCollect,
    }, icon('arrow-left'), 'Back'));

    confirm.addEventListener('click', async () => {
      err.classList.add('hidden');
      confirm.disabled = true;
      confirm.innerHTML = '';
      confirm.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
      confirm.appendChild(el('span', {}, 'Sending ' + fmt(state.amount_naira) + '…'));
      try {
        const resp = await api.loans.apply({
          amount_kobo: state.amount_kobo,
          term_days: state.term_days,
          rate_monthly: state.rate_monthly,
          purpose: state.purpose,
          bank_code: state.bank_code,
          account_number: state.account_number,
          account_name: state.account_name,
        });
        state.nip_ref = resp.loan?.nip_ref || resp.transfer?.data?.nip_session_id || '';
        state.payout_ref = resp.loan?.payout_ref || '';
        state.demo_fallback = !!resp.demo_fallback;
        // Pull fresh transactions so the dashboard reflects the outflow
        refreshTxsFromServer();
        renderSuccess();
      } catch (e) {
        confirm.disabled = false;
        confirm.innerHTML = '';
        confirm.appendChild(icon('lightning-charge-fill'));
        confirm.appendChild(el('span', {}, 'Try again'));
        err.textContent = e?.data?.error || e.message || 'Disbursement failed';
        err.classList.remove('hidden');
      }
    });
  }

  // ── Stage 3: real success with NIP reference ─────────────
  function renderSuccess() {
    modal.innerHTML = '';
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
    }, 'Disbursed!'));
    if (state.demo_fallback) {
      modal.appendChild(el('div', { class: 'flex justify-center mt-2' },
        el('span', {
          class: 'chip',
          style: { background: '#FFF8DA', color: '#7B5500', border: '1px solid #F0DA9A' },
        }, icon('shield-check'), 'Sandbox demo · merchant wallet not funded'),
      ));
    }
    modal.appendChild(el('p', {
      class: 'text-[14px] text-ink-2 text-center mt-2 leading-relaxed',
    }, state.demo_fallback
      ? `${fmt(state.amount_naira)} recorded for ${state.account_name}. Squad accepted the request — only the wallet debit was deferred.`
      : `${fmt(state.amount_naira)} on its way to ${state.account_name} via Squad.`));

    const detail = el('div', {
      class: 'mt-6 p-4 rounded-xl space-y-2',
      style: { background: '#F5F5F0' },
    });
    detail.appendChild(rowKvL('Recipient', `${state.bank_name} · ${state.account_number}`));
    if (state.nip_ref) detail.appendChild(rowKvL('NIP reference', state.nip_ref));
    if (state.payout_ref) detail.appendChild(rowKvL('Transaction ref', state.payout_ref));
    detail.appendChild(rowKvL('First instalment', `${state.term_days} days from today`));
    modal.appendChild(detail);

    modal.appendChild(el('button', {
      class: 'btn btn-primary w-full mt-6 !py-3.5',
      onClick: close,
    }, 'Done'));
  }
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
