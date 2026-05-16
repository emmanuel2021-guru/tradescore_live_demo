import { el, fmt, icon } from '../utils.js';
import { getUser, getTxs, getWalletBalance, onTxsUpdated } from '../store.js';
import { Overview }       from './overview.js';
import { ScorePanel }     from './score.js';
import { LoansPanel }     from './loans.js';
import { Transactions }   from './transactions.js';
import { InventoryPanel } from './inventory.js';
import { Assistant }      from './assistant.js';
import { NetworkPanel }   from './network.js';
import { ProfilePanel }   from './profile.js';

const PANELS = {
  overview:     { title: 'Overview',       icon: 'house-door',       render: Overview       },
  score:        { title: 'TradeScore',     icon: 'speedometer2',     render: ScorePanel     },
  loans:        { title: 'Loans',          icon: 'cash-coin',        render: LoansPanel     },
  inventory:    { title: 'Inventory',      icon: 'box-seam',         render: InventoryPanel, roles: ['trader'] },
  transactions: { title: 'Transactions',   icon: 'arrow-left-right', render: Transactions   },
  assistant:    { title: 'AI Assistant',   icon: 'stars',            render: Assistant      },
  network:      { title: 'Network',        icon: 'diagram-3',        render: NetworkPanel   },
  profile:      { title: 'Profile',        icon: 'person-circle',    render: ProfilePanel   },
};

// Workers see a slimmer nav — no Inventory (they don't run a shop), and the
// Transactions tab is reframed as "Earnings" in the label below.
function visiblePanels(role) {
  return Object.fromEntries(
    Object.entries(PANELS).filter(([, p]) => !p.roles || p.roles.includes(role))
  );
}
const WORKER_LABELS = {
  overview:     'Earnings',
  transactions: 'Gig history',
};

export function Shell({ panel, navigate }) {
  const user = getUser();
  const role = user.role || 'trader';
  const panels = visiblePanels(role);
  const labelFor = (key, fallback) =>
    (role === 'worker' && WORKER_LABELS[key]) || fallback;
  const root = el('div', { class: 'min-h-screen bg-squad-paper relative' });

  // Backdrop for mobile sidebar
  const backdrop = el('div', {
    class: 'fixed inset-0 bg-black/30 z-30 hidden',
    'data-backdrop': '1',
    onClick: () => root.classList.remove('sidebar-open'),
  });
  root.appendChild(backdrop);

  // ── Sidebar ───────────────────────────────────────────────
  const aside = el('aside', {
    class: 'sidebar-toggle-target fixed lg:sticky top-0 left-0 z-40 h-screen w-[260px] bg-white border-r border-line flex flex-col',
  });

  // Logo
  aside.appendChild(el('div', {
    class: 'h-[64px] px-5 border-b border-line flex items-center gap-2.5',
  },
    el('div', {
      class: 'w-9 h-9 rounded-xl bg-squad-deep flex items-center justify-center text-squad-lime cursor-pointer',
      style: { fontSize: '15px' },
      onClick: () => navigate('#/'),
    }, icon('shop')),
    el('div', { class: 'leading-tight' },
      el('div', { class: 'font-display font-extrabold text-[15.5px] text-squad-deep' }, 'TradeScore'),
      el('div', { class: 'text-[9.5px] uppercase font-bold tracking-[0.18em] text-squad-green -mt-[1px]' }, 'by Squad'),
    ),
  ));

  // Nav items
  const nav = el('nav', { class: 'flex-1 p-4 space-y-1 overflow-y-auto' });
  Object.entries(panels).forEach(([key, p]) => {
    const item = el('div', {
      class: 'nav-item' + (key === panel ? ' active' : ''),
      onClick: () => {
        navigate('#/app/' + key);
        root.classList.remove('sidebar-open');
      },
    },
      el('span', { class: 'nav-icon' }, icon(p.icon)),
      el('span', {}, labelFor(key, p.title)),
    );
    if (key === 'assistant') {
      item.appendChild(el('span', {
        class: 'ml-auto chip',
        style: { background: '#E8FF8B', color: '#022B23', padding: '2px 7px', fontSize: '10px' },
      }, 'AI'));
    }
    nav.appendChild(item);
  });

  // Sidebar AI insight teaser
  const teaser = el('div', {
    class: 'mx-2 mt-6 mb-3 p-4 rounded-2xl cursor-pointer',
    style: { background: 'linear-gradient(135deg, #022B23, #0B6E4F)' },
    onClick: () => { navigate('#/app/assistant'); root.classList.remove('sidebar-open'); },
  },
    el('div', { class: 'flex items-center gap-2 mb-2' },
      el('div', {
        class: 'w-7 h-7 rounded-full flex items-center justify-center',
        style: { background: 'rgba(232,255,139,0.20)', color: '#E8FF8B', fontSize: '12px' },
      }, icon('stars')),
      el('div', {
        class: 'text-[10.5px] font-bold uppercase tracking-[0.15em]',
        style: { color: '#E8FF8B' },
      }, 'AI Insight'),
    ),
    el('div', { class: 'text-white text-[12.5px] leading-snug' },
      'Your inflows jumped 24% this week — good time to restock.'),
    el('div', {
      class: 'text-[11px] mt-2 font-semibold flex items-center gap-1',
      style: { color: '#E8FF8B' },
    }, 'Ask AI', icon('arrow-right')),
  );
  nav.appendChild(teaser);
  aside.appendChild(nav);

  // User card at bottom
  aside.appendChild(el('div', {
    class: 'p-3 border-t border-line',
  },
    el('div', {
      class: 'flex items-center gap-3 p-2 rounded-xl hover:bg-squad-paper cursor-pointer',
      onClick: () => navigate('#/app/profile'),
    },
      el('div', {
        class: 'w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-[13px]',
        style: { background: 'linear-gradient(135deg, #0B6E4F, #1F8A65)' },
      }, user.avatar || '?'),
      el('div', { class: 'flex-1 min-w-0' },
        el('div', { class: 'text-[13px] font-bold text-ink-1 truncate' }, user.name || 'Profile'),
        el('div', { class: 'text-[11px] text-ink-3 truncate' }, user.business || 'Tap to view'),
      ),
      el('span', { class: 'text-ink-3', style: { fontSize: '14px' } }, icon('three-dots')),
    ),
  ));
  root.appendChild(aside);

  // Show backdrop only when sidebar is open
  const observer = new MutationObserver(() => {
    backdrop.classList.toggle('hidden', !root.classList.contains('sidebar-open'));
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });

  // ── Main column ───────────────────────────────────────────
  const main = el('div', { class: 'flex flex-col min-h-screen min-w-0' });

  // Topbar
  const topbar = el('header', {
    class: 'sticky top-0 z-20 bg-squad-paper/85 backdrop-blur-md border-b border-line h-[64px] flex items-center px-4 lg:px-8 gap-4',
  });
  topbar.appendChild(el('button', {
    class: 'lg:hidden w-10 h-10 rounded-lg hover:bg-white flex items-center justify-center text-ink-1',
    style: { fontSize: '18px' },
    onClick: () => root.classList.toggle('sidebar-open'),
  }, icon('list')));

  topbar.appendChild(el('div', { class: 'leading-tight' },
    el('div', { class: 'text-[10.5px] uppercase tracking-[0.15em] text-ink-3 font-bold' }, 'Dashboard'),
    el('h1', {
      class: 'font-display text-[20px] lg:text-[22px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, labelFor(panel, panels[panel]?.title || 'Overview')),
  ));

  // Search (desktop) — submits to /app/transactions?q=…
  const searchInput = el('input', {
    class: 'input flex-1 !p-0 !border-none !bg-transparent text-[13.5px] !shadow-none',
    placeholder: 'Search transactions, refs, customers…',
  });
  const searchForm = el('form', {
    class: 'hidden md:flex items-center gap-2 ml-6 flex-1 max-w-[420px] h-10 px-3.5 rounded-xl bg-white border border-line',
  },
    el('span', { class: 'text-ink-3', style: { fontSize: '14px' } }, icon('search')),
    searchInput,
    el('span', { class: 'text-[10px] font-semibold text-ink-3 px-1.5 py-0.5 rounded border border-line' }, '⌘K'),
  );
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    navigate(q ? `/app/transactions?q=${encodeURIComponent(q)}` : '/app/transactions');
  });
  topbar.appendChild(searchForm);

  // ⌘K / Ctrl+K focuses the search input
  const keyHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  };
  window.addEventListener('keydown', keyHandler);
  topbar.addEventListener('removed', () => window.removeEventListener('keydown', keyHandler));

  // Wallet pill — live balance from getWalletBalance()
  const walletPill = el('button', {
    class: 'hidden md:flex items-center gap-2.5 px-3.5 h-10 rounded-xl bg-white border border-line hover:bg-squad-paper text-ink-1 transition',
    onClick: () => navigate('/app/overview'),
    title: 'Open wallet',
  });
  const repaintWallet = () => {
    const { available } = getWalletBalance();
    walletPill.innerHTML = '';
    walletPill.appendChild(el('span', {
      style: { color: '#0B6E4F', fontSize: '14px' },
    }, icon('wallet2')));
    walletPill.appendChild(el('div', { class: 'leading-tight text-left' },
      el('div', {
        class: 'text-[9px] font-bold uppercase tracking-[0.12em] text-ink-3',
      }, 'Wallet'),
      el('div', {
        class: 'text-[12.5px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.01em' },
      }, fmt(available)),
    ));
  };
  repaintWallet();
  onTxsUpdated(() => repaintWallet());

  // Bell: badge = inflows in last 24h
  const bellBtn = iconBtn('bell', 0);
  bellBtn.addEventListener('click', () => navigate('/app/transactions'));
  const repaintBell = () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const count = getTxs().filter(t =>
      t.type === 'in' && t.occurred_at && new Date(t.occurred_at).getTime() >= cutoff
    ).length;
    setIconBtnBadge(bellBtn, count);
  };
  repaintBell();
  onTxsUpdated(() => repaintBell());

  const gearBtn = iconBtn('gear');
  gearBtn.addEventListener('click', () => navigate('/app/profile'));

  topbar.appendChild(el('div', { class: 'flex items-center gap-2 ml-auto' },
    walletPill,
    bellBtn,
    gearBtn,
    el('button', {
      class: 'btn btn-primary !py-2.5 !px-4 !text-[13px]',
      onClick: () => navigate('/app/loans'),
    }, icon('plus-lg'), role === 'worker' ? 'See loans' : 'New loan'),
  ));
  main.appendChild(topbar);

  // ── Panel content ─────────────────────────────────────────
  const content = el('main', { class: 'flex-1 px-4 lg:px-8 py-6 lg:py-8' });
  const factory = panels[panel]?.render || Overview;
  content.appendChild(factory({ navigate }));
  main.appendChild(content);

  root.appendChild(main);

  root.classList.add('lg:grid');
  root.style.gridTemplateColumns = '260px minmax(0, 1fr)';

  return root;
}

function iconBtn(name, badge) {
  const btn = el('button', {
    class: 'relative w-10 h-10 rounded-xl bg-white border border-line hover:bg-squad-paper flex items-center justify-center text-ink-1',
    style: { fontSize: '15px' },
  }, icon(name));
  setIconBtnBadge(btn, badge);
  return btn;
}

function setIconBtnBadge(btn, badge) {
  const existing = btn.querySelector('[data-badge]');
  if (existing) existing.remove();
  if (!badge) return;
  btn.appendChild(el('span', {
    class: 'absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full text-white text-[10px] font-extrabold flex items-center justify-center',
    style: { background: '#D43E3E' },
    'data-badge': '1',
  }, String(badge)));
}
