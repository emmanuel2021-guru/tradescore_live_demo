import { el, icon, iconTile } from '../utils.js';

export function Landing({ navigate }) {
  const root = el('div', { class: 'min-h-screen bg-squad-paper' });

  // ── Top nav ────────────────────────────────────────────────
  const nav = el('header', {
    class: 'sticky top-0 z-30 bg-squad-paper/90 backdrop-blur-md border-b border-line',
  });
  const navInner = el('div', {
    class: 'max-w-[1240px] mx-auto px-4 lg:px-10 h-[60px] lg:h-[64px] flex items-center gap-3',
  });
  const logo = el('a', {
    class: 'flex items-center gap-2 cursor-pointer flex-shrink-0',
    onClick: () => navigate('#/'),
  },
    el('div', {
      class: 'w-9 h-9 rounded-xl bg-squad-deep flex items-center justify-center text-squad-lime',
      style: { fontSize: '17px' },
    }, icon('shop')),
    el('div', { class: 'leading-tight' },
      el('div', { class: 'font-display font-extrabold text-[16px] lg:text-[17px] text-squad-deep' }, 'TradeScore'),
      el('div', { class: 'hidden sm:block text-[9.5px] uppercase font-bold tracking-[0.18em] text-squad-green -mt-[1px]' }, 'by Squad'),
    ),
  );
  navInner.appendChild(logo);

  const navLinks = el('nav', { class: 'hidden md:flex items-center gap-7 mx-auto' },
    NavLink('How it works', '#how'),
    NavLink('Features', '#features'),
    NavLink('AI Insights', '#features'),
    NavLink('For Squad', '#cta'),
  );
  navInner.appendChild(navLinks);

  const navActions = el('div', { class: 'flex items-center gap-2 ml-auto' });
  navActions.appendChild(el('button', {
    class: 'btn btn-ghost !py-2 !px-3.5 !text-[13px] hidden sm:inline-flex',
    onClick: () => navigate('#/login'),
  }, 'Log in'));
  navActions.appendChild(el('button', {
    class: 'btn btn-primary !py-2 !px-3.5 !text-[13px]',
    onClick: () => navigate('#/signup'),
  }, el('span', { class: 'hidden sm:inline' }, 'Get started'),
     el('span', { class: 'sm:hidden' }, 'Sign up'),
     icon('arrow-right')));

  // Mobile-only menu toggle (replaces the hamburger feel without one)
  const mobileLogin = el('button', {
    class: 'sm:hidden btn btn-ghost !p-2 !text-[15px] !rounded-lg',
    onClick: () => navigate('#/login'),
    'aria-label': 'Log in',
  }, icon('box-arrow-in-right'));
  navActions.insertBefore(mobileLogin, navActions.firstChild);

  navInner.appendChild(navActions);
  nav.appendChild(navInner);
  root.appendChild(nav);

  // ── Hero ───────────────────────────────────────────────────
  const hero = el('section', { class: 'relative overflow-hidden' });
  hero.appendChild(el('div', {
    class: 'absolute inset-0 pointer-events-none',
    style: {
      zIndex: 0,
      background:
        'radial-gradient(800px 380px at 82% 0%, rgba(232,255,139,0.20), transparent 60%),' +
        'radial-gradient(900px 480px at 18% 100%, rgba(11,110,79,0.10), transparent 60%)',
    },
  }));
  const heroInner = el('div', {
    class: 'relative max-w-[1240px] mx-auto px-5 lg:px-10 pt-10 lg:pt-16 pb-16 lg:pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center',
    style: { zIndex: 1 },
  });

  // Left: copy
  const copy = el('div', {});
  copy.appendChild(el('div', {
    class: 'inline-flex items-center gap-2 chip mb-5',
    style: { background: '#E8F4EE', color: '#0B6E4F' },
  }, icon('stars'), 'AI-powered credit scoring · Powered by Squad'));
  copy.appendChild(el('h1', {
    class: 'font-display text-[40px] sm:text-[52px] lg:text-[64px] font-extrabold text-squad-deep leading-[1.02]',
    style: { letterSpacing: '-0.035em' },
  }, 'Credit for every', el('br'), 'informal worker.'));
  copy.appendChild(el('p', {
    class: 'mt-5 text-[16px] lg:text-[17px] text-ink-2 leading-relaxed max-w-[540px]',
  }, "Traders hire workers. Workers earn through Squad. Every payment becomes credit history. The TradeScore engine underwrites both sides — informal market traders and the job seekers they hire — so fair loans reach the people the banks have always missed."));

  const heroBtns = el('div', { class: 'mt-7 flex flex-wrap gap-3' });
  heroBtns.appendChild(el('button', {
    class: 'btn btn-primary !text-[14.5px] !px-6 !py-[14px]',
    onClick: () => navigate('#/signup'),
  }, 'Create your TradeScore', icon('arrow-right')));
  heroBtns.appendChild(el('button', {
    class: 'btn btn-ghost !text-[14.5px] !px-6 !py-[14px]',
    onClick: () => navigate('#/login'),
  }, icon('play-circle'), 'See live demo'));
  copy.appendChild(heroBtns);

  // Trust strip
  const trust = el('div', { class: 'mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-ink-2 font-medium' });
  [
    { i: 'shield-check', t: 'Auto-debit safe' },
    { i: 'patch-check',  t: 'No collateral' },
    { i: 'lightning-charge', t: 'Funded in < 5 min' },
    { i: 'plug',         t: 'Built on Squad API' },
  ].forEach(({ i, t }) => {
    trust.appendChild(el('span', { class: 'flex items-center gap-1.5' },
      el('span', { class: 'text-squad-leaf', style: { fontSize: '14px' } }, icon(i)), t,
    ));
  });
  copy.appendChild(trust);
  heroInner.appendChild(copy);

  // Right: AI demo card
  heroInner.appendChild(buildAiDemoCard());
  hero.appendChild(heroInner);
  root.appendChild(hero);

  // ── How it works ─────────────────────────────────────────
  const how = el('section', { id: 'how', class: 'py-16 lg:py-20 bg-white border-y border-line' });
  const howInner = el('div', { class: 'max-w-[1240px] mx-auto px-5 lg:px-10' });
  howInner.appendChild(el('div', { class: 'text-center max-w-[640px] mx-auto mb-12' },
    el('div', { class: 'chip mb-3 inline-flex', style: { background: '#FFF8DA', color: '#7B5500' } },
      icon('compass'), 'How it works'),
    el('h2', {
      class: 'font-display text-[30px] md:text-[40px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.03em' },
    }, 'From transactions to credit, in 3 steps.'),
    el('p', { class: 'mt-3 text-ink-2 text-[15px] lg:text-[16px]' },
      'No bank visits. No paperwork. Just your Squad payment history doing the work.'),
  ));

  const steps = el('div', { class: 'grid md:grid-cols-3 gap-5' });
  [
    { n: '01', i: 'link-45deg',  title: 'Connect your Squad wallet', body: 'One tap to authorize. We pull your last 12 months of payment history securely.' },
    { n: '02', i: 'cpu',         title: 'AI builds your TradeScore', body: 'A 5-factor model analyzes volume, consistency, growth, longevity and customer diversity.' },
    { n: '03', i: 'cash-coin',   title: 'Borrow at fair rates',      body: 'Pre-approved offers from 1.8–3.5% / month. Funds hit your Squad wallet instantly.' },
  ].forEach((s, i) => steps.appendChild(StepCard(s, i)));
  howInner.appendChild(steps);
  how.appendChild(howInner);
  root.appendChild(how);

  // ── Features grid ────────────────────────────────────────
  const feat = el('section', { id: 'features', class: 'py-16 lg:py-20' });
  const featInner = el('div', { class: 'max-w-[1240px] mx-auto px-5 lg:px-10' });
  featInner.appendChild(el('div', { class: 'text-center max-w-[640px] mx-auto mb-12' },
    el('div', { class: 'chip mb-3 inline-flex', style: { background: '#E8F4EE', color: '#0B6E4F' } },
      icon('stars'), 'AI features'),
    el('h2', {
      class: 'font-display text-[30px] md:text-[40px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.03em' },
    }, 'Smarter than any loan app you’ve used.'),
  ));
  const fGrid = el('div', { class: 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5' });
  [
    { i: 'lightbulb',           color: '#0B6E4F', bg: '#E8F4EE', title: 'AI score insights',    body: 'Plain-language explanations of why your score is what it is — and exactly what to do to improve it.' },
    { i: 'chat-square-quote',   color: '#27AE60', bg: '#E5F9F0', title: 'Trader assistant',     body: 'Ask anything: "How much can I borrow safely?" or "When should I restock?". Always in context of your business.' },
    { i: 'graph-up-arrow',      color: '#1F8A65', bg: '#E8F4EE', title: 'Revenue forecasting',  body: 'Predicts next month’s inflow based on your real Squad data, not guesses. Plan with confidence.' },
    { i: 'tags',                color: '#6C5CE7', bg: '#EFEDFE', title: 'Auto-categorisation',  body: 'Every transaction is tagged in real-time — sales, stock, rent, utilities — so you know where your money goes.' },
    { i: 'exclamation-triangle',color: '#D4711F', bg: '#FFEFE5', title: 'Risk alerts',          body: 'Anomaly detection warns you when your outflows concentrate or inflows slip — before it’s a problem.' },
    { i: 'bullseye',            color: '#022B23', bg: '#E2E8E4', title: 'Smart loan offers',    body: 'AI matches your cashflow to a loan term you can actually repay. No surprises, no traps.' },
  ].forEach((f, i) => fGrid.appendChild(FeatCard(f, i)));
  featInner.appendChild(fGrid);
  feat.appendChild(featInner);
  root.appendChild(feat);

  // ── CTA ───────────────────────────────────────────────────
  const cta = el('section', { id: 'cta', class: 'pb-20' });
  const ctaInner = el('div', { class: 'max-w-[1100px] mx-auto px-5 lg:px-10' });
  const ctaCard = el('div', {
    class: 'rounded-[24px] p-8 md:p-12 relative overflow-hidden',
    style: {
      background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
      boxShadow: '0 30px 80px rgba(2,43,35,0.30)',
    },
  });
  ctaCard.appendChild(el('div', {
    class: 'absolute rounded-full pointer-events-none',
    style: { width: '320px', height: '320px', top: '-100px', right: '-100px',
             background: 'radial-gradient(circle, rgba(232,255,139,0.18), transparent 70%)' },
  }));
  const ctaContent = el('div', { class: 'relative z-10 grid md:grid-cols-[1.5fr_1fr] gap-8 items-center' });
  ctaContent.appendChild(el('div', {},
    el('h3', {
      class: 'font-display text-white text-[28px] md:text-[38px] font-extrabold leading-[1.1]',
      style: { letterSpacing: '-0.03em' },
    }, 'Ready to turn your sales into credit?'),
    el('p', { class: 'text-white/75 mt-3 text-[15px] max-w-[520px] leading-relaxed' },
      'Join hundreds of traders already pre-approved. Setup takes 2 minutes — and you keep full control of your data.'),
  ));
  ctaContent.appendChild(el('div', { class: 'flex flex-col sm:flex-row md:flex-col gap-3' },
    el('button', {
      class: 'btn btn-lime !text-[14.5px] !px-6 !py-[14px]',
      onClick: () => navigate('#/signup'),
    }, 'Get started — it’s free', icon('arrow-right')),
    el('button', {
      class: 'btn !text-[14.5px] !px-6 !py-[14px] text-white border border-white/30 hover:bg-white/10',
      onClick: () => navigate('#/login'),
    }, icon('box-arrow-in-right'), 'Sign in'),
  ));
  ctaCard.appendChild(ctaContent);
  ctaInner.appendChild(ctaCard);
  cta.appendChild(ctaInner);
  root.appendChild(cta);

  // ── Footer ────────────────────────────────────────────────
  const foot = el('footer', { class: 'border-t border-line py-8 bg-white' });
  const footInner = el('div', {
    class: 'max-w-[1240px] mx-auto px-5 lg:px-10 flex flex-col md:flex-row items-center justify-between gap-4',
  });
  footInner.appendChild(el('div', { class: 'flex items-center gap-2.5' },
    el('div', {
      class: 'w-8 h-8 rounded-lg bg-squad-deep flex items-center justify-center text-squad-lime',
      style: { fontSize: '14px' },
    }, icon('shop')),
    el('span', { class: 'font-display font-extrabold text-squad-deep text-[15px]' }, 'TradeScore'),
    el('span', { class: 'text-[12px] text-ink-3' }, '· Built for hackathon · Powered by Squad API'),
  ));
  footInner.appendChild(el('div', { class: 'text-[12px] text-ink-3 text-center md:text-right' },
    '© 2026 TradeScore. Banking your way out of high-interest loan apps.'));
  foot.appendChild(footInner);
  root.appendChild(foot);

  return root;
}

function NavLink(label, href = '#') {
  return el('a', {
    class: 'text-[13.5px] font-medium text-ink-2 hover:text-squad-deep transition',
    href,
  }, label);
}

function StepCard(s, i) {
  return el('div', {
    class: 'card card-hover p-6',
    style: { animation: `fadeUp 0.5s ${0.05 + i * 0.07}s cubic-bezier(0.22,1,0.36,1) both` },
  },
    el('div', { class: 'flex items-start justify-between mb-4' },
      iconTile(s.i, { size: 46, fontSize: 20, bg: '#E8F4EE', color: '#0B6E4F', radius: 14 }),
      el('span', {
        class: 'font-display text-[26px] font-extrabold',
        style: { color: '#E2E8E4', letterSpacing: '-0.03em' },
      }, s.n),
    ),
    el('h3', {
      class: 'font-display text-[18px] font-extrabold text-squad-deep mb-1.5',
      style: { letterSpacing: '-0.02em' },
    }, s.title),
    el('p',  { class: 'text-[13.5px] text-ink-2 leading-relaxed' }, s.body),
  );
}

function FeatCard(f, i) {
  return el('div', {
    class: 'card p-5 lg:p-6',
    style: { animation: `fadeUp 0.5s ${0.04 + i * 0.05}s cubic-bezier(0.22,1,0.36,1) both` },
  },
    iconTile(f.i, { size: 42, fontSize: 18, bg: f.bg, color: f.color, radius: 12, className: 'mb-3.5' }),
    el('h3', {
      class: 'font-display text-[15.5px] font-extrabold text-squad-deep mb-1',
      style: { letterSpacing: '-0.015em' },
    }, f.title),
    el('p',  { class: 'text-[13px] text-ink-2 leading-relaxed' }, f.body),
  );
}

// ── AI Demo Card (right side of hero) ───────────────────────
function buildAiDemoCard() {
  const card = el('div', {
    class: 'card p-5 md:p-6',
    style: {
      boxShadow: '0 30px 70px rgba(2, 43, 35, 0.10)',
      animation: 'fadeUp 0.55s 0.1s cubic-bezier(0.22,1,0.36,1) both',
    },
  });

  // Header
  card.appendChild(el('div', { class: 'flex items-center justify-between mb-4' },
    el('div', { class: 'flex items-center gap-2.5' },
      el('div', {
        class: 'w-9 h-9 rounded-full flex items-center justify-center text-white',
        style: { background: 'linear-gradient(135deg, #0B6E4F, #27AE60)', fontSize: '14px' },
      }, icon('stars')),
      el('div', { class: 'leading-tight' },
        el('div', { class: 'text-[13px] font-bold text-squad-deep' }, 'TradeScore AI'),
        el('div', { class: 'text-[10.5px] text-ink-3' }, 'Live · analysing 17 transactions'),
      ),
    ),
    el('span', {
      class: 'chip',
      style: { background: '#E8F4EE', color: '#0B6E4F' },
    }, el('span', { style: { fontSize: '7px' } }, '●'), 'Online'),
  ));

  // Score preview
  card.appendChild(el('div', {
    class: 'rounded-2xl p-5 mb-4',
    style: { background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)' },
  },
    el('div', { class: 'text-[10px] uppercase tracking-[0.15em] font-bold', style: { color: '#E8FF8B' } },
      'Funmi’s TradeScore'),
    el('div', { class: 'flex items-end justify-between mt-1' },
      el('div', {
        class: 'font-display text-white font-extrabold',
        style: { fontSize: '46px', lineHeight: '1', letterSpacing: '-0.04em' },
      }, '742'),
      el('div', { class: 'chip', style: { background: '#E8FF8B', color: '#022B23' } },
        icon('arrow-up-short'), '+12 this week'),
    ),
    el('div', { class: 'h-1.5 rounded-full bg-white/15 mt-4 overflow-hidden' },
      el('div', {
        class: 'h-full rounded-full',
        style: {
          width: '80%',
          background: 'linear-gradient(90deg, #1F8A65, #E8FF8B)',
          animation: 'fadeIn 1s ease',
        },
      }),
    ),
  ));

  // AI insight
  card.appendChild(el('div', { class: 'flex gap-3 mb-4' },
    el('div', {
      class: 'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white',
      style: { background: 'linear-gradient(135deg, #0B6E4F, #27AE60)', fontSize: '13px' },
    }, icon('robot')),
    el('div', { class: 'chat-bubble chat-ai ai-text', style: { background: '#F5F5F0' } },
      el('span', { html: 'Funmi, you’re in the <strong>top 18%</strong> of Lagos market traders. Push <strong>Customer Diversity</strong> by 6 points and you’ll unlock the <strong>₦1M tier</strong> at <strong>1.8% / month</strong>.' }),
    ),
  ));

  // Pre-approved
  card.appendChild(el('div', {
    class: 'rounded-xl p-4 flex items-center justify-between',
    style: { background: '#E8FF8B' },
  },
    el('div', {},
      el('div', { class: 'text-[10.5px] font-bold uppercase tracking-widest text-squad-deep' }, 'Pre-approved'),
      el('div', {
        class: 'font-display text-[22px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.025em' },
      }, '₦500,000'),
      el('div', { class: 'text-[11px] text-squad-deep/70' }, '2.2% / month · 90 days'),
    ),
    el('div', { class: 'text-squad-deep', style: { fontSize: '20px' } }, icon('arrow-right-circle')),
  ));

  return card;
}
