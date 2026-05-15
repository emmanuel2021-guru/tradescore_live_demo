import { el, fmt, icon } from '../utils.js';
import { getAllTransactions, onTxsUpdated } from '../store.js';
import { categorize } from '../ai.js';

export function Transactions() {
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });
  let filter = 'all';
  let category = null;
  // Pre-fill from ?q= set by the topbar search submit.
  let query = (new URLSearchParams(location.search).get('q') || '').trim().toLowerCase();

  // ── Header KPIs (refilled on tx updates) ─────────────────
  const kpiRow = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up' });
  root.appendChild(kpiRow);
  function renderKpis() {
    const all = getAllTransactions();
    const inflow  = all.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    const outflow = all.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    kpiRow.innerHTML = '';
    kpiRow.appendChild(KpiSm('Total inflow',  fmt(inflow),  all.filter(t => t.type === 'in').length + ' transactions',  '#27AE60', 'arrow-down-circle'));
    kpiRow.appendChild(KpiSm('Total outflow', fmt(outflow), all.filter(t => t.type === 'out').length + ' transactions', '#D4711F', 'arrow-up-circle'));
    kpiRow.appendChild(KpiSm('Net flow',      fmt(inflow - outflow), 'All time', '#0B6E4F', 'graph-up-arrow'));
    kpiRow.appendChild(KpiSm('Categories',    Object.keys(buildCategoryMap(all)).length, 'AI-detected types', '#6C5CE7', 'tags'));
  }
  renderKpis();

  // ── Filters bar ──────────────────────────────────────────
  const bar = el('div', { class: 'card p-4 flex flex-wrap items-center gap-3 fade-up-1' });
  const searchInput = el('input', {
    class: 'flex-1 bg-transparent outline-none text-[13px]',
    placeholder: 'Search transactions, refs, customers…',
  });
  if (query) searchInput.value = query;
  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim().toLowerCase();
    renderList();
  });
  bar.appendChild(el('div', {
    class: 'flex items-center gap-2 px-3 py-2 rounded-xl bg-squad-paper border border-line flex-1 min-w-[200px]',
  },
    el('span', { class: 'text-ink-3', style: { fontSize: '14px' } }, icon('search')),
    searchInput,
  ));

  const segWrap = el('div', { class: 'flex bg-squad-paper p-1 rounded-xl border border-line', 'data-seg': '1' });
  ['all', 'in', 'out'].forEach(s => {
    const btn = el('button', {
      class: 'px-4 py-2 rounded-lg text-[12.5px] font-bold capitalize tap',
      'data-filter': s,
      onClick: () => { filter = s; renderList(); paintSeg(); },
    }, s === 'in' ? 'Inflow' : s === 'out' ? 'Outflow' : 'All');
    segWrap.appendChild(btn);
  });
  bar.appendChild(segWrap);
  function paintSeg() {
    segWrap.querySelectorAll('[data-filter]').forEach(b => {
      const a = b.dataset.filter === filter;
      b.style.background = a ? '#fff' : 'transparent';
      b.style.color      = a ? '#0A1F1A' : '#9AA8A2';
      b.style.boxShadow  = a ? '0 2px 8px rgba(0,0,0,0.06)' : 'none';
    });
  }
  paintSeg();

  bar.appendChild(el('button', {
    class: 'btn btn-ghost !py-2.5 !px-4 !text-[12.5px]',
    onClick: () => exportFilteredCsv(visibleTxs()),
  }, icon('download'), 'Export CSV'));
  root.appendChild(bar);

  // ── Category chip bar ───────────────────────────────────
  const catBar = el('div', { class: 'flex flex-wrap gap-2 fade-up-2' });
  root.appendChild(catBar);
  function renderCats() {
    catBar.innerHTML = '';
    const cats = buildCategoryMap(getAllTransactions());
    const allBtn = el('button', {
      class: 'chip px-4 py-2 cursor-pointer tap',
      'data-cat': '__all',
      style: { background: '#022B23', color: '#fff' },
      onClick: () => { category = null; renderList(); renderCats(); },
    }, icon('grid-fill'), 'All categories');
    catBar.appendChild(allBtn);
    Object.entries(cats).forEach(([name, info]) => {
      const active = category === name;
      const btn = el('button', {
        class: 'chip px-4 py-2 cursor-pointer tap',
        'data-cat': name,
        style: active
          ? { background: info.color, color: '#fff', border: '1px solid ' + info.color }
          : { background: '#fff', color: info.color, border: '1px solid #E2E8E4' },
        onClick: () => { category = (category === name ? null : name); renderList(); renderCats(); },
      }, icon('tag-fill'), `${name} · ${info.count}`);
      catBar.appendChild(btn);
    });
    // Paint the "all categories" chip state
    if (category) {
      allBtn.style.background = '#fff';
      allBtn.style.color = '#4A5C56';
      allBtn.style.border = '1px solid #E2E8E4';
    }
  }
  renderCats();

  // ── List ─────────────────────────────────────────────────
  const card = el('div', { class: 'card p-2 md:p-3 fade-up-3' });
  const list = el('div', { class: 'divide-y divide-line' });
  card.appendChild(list);
  root.appendChild(card);

  function visibleTxs() {
    let v = getAllTransactions().filter(t => filter === 'all' || t.type === filter);
    if (category) v = v.filter(t => categorize(t).category === category);
    if (query) {
      v = v.filter(t =>
        (t.name || '').toLowerCase().includes(query) ||
        (t.ref  || '').toLowerCase().includes(query),
      );
    }
    return v;
  }
  function renderList() {
    list.innerHTML = '';
    const v = visibleTxs();
    if (!v.length) {
      list.appendChild(el('div', { class: 'p-8 text-center text-ink-3 text-[13px]' },
        'No transactions match this filter.'));
      return;
    }
    v.forEach(t => list.appendChild(buildRow(t)));
  }
  renderList();

  // Re-render everything when a fresh /api/transactions response lands.
  onTxsUpdated(() => {
    renderKpis();
    renderCats();
    renderList();
  });

  return root;
}

function buildRow(tx) {
  const isIn = tx.type === 'in';
  const cat = categorize(tx);
  return el('div', { class: 'flex items-center gap-4 p-4' },
    el('div', {
      class: 'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
      style: {
        background: isIn ? '#E5F9F0' : '#FFEFE5',
        color: isIn ? '#27AE60' : '#D4711F',
        fontSize: '17px',
      },
    }, icon(isIn ? 'arrow-down' : 'arrow-up')),
    el('div', { class: 'flex-1 min-w-0' },
      el('div', { class: 'flex items-center gap-2 flex-wrap' },
        el('span', { class: 'text-[14px] font-bold text-ink-1' }, tx.name),
        el('span', {
          class: 'chip',
          style: { background: cat.color + '18', color: cat.color, padding: '2px 8px', fontSize: '10.5px' },
        }, icon('tag-fill'), cat.category),
      ),
      el('div', { class: 'text-[11.5px] text-ink-3 mt-0.5' }, (tx.time || '') + (tx.ref ? ' · ' + tx.ref : '')),
    ),
    el('div', {
      class: 'text-[14.5px] font-extrabold flex-shrink-0',
      style: { color: isIn ? '#27AE60' : '#0A1F1A' },
    }, (isIn ? '+' : '-') + fmt(tx.amount)),
  );
}

function KpiSm(label, value, sub, accent, iconName) {
  return el('div', { class: 'card p-4 relative overflow-hidden' },
    el('div', {
      style: {
        position: 'absolute', left: 0, right: 0, top: 0, height: '3px',
        background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
      },
    }),
    el('div', {
      style: {
        position: 'absolute', top: '-30px', right: '-30px',
        width: '90px', height: '90px', borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}1A, transparent 70%)`,
        pointerEvents: 'none',
      },
    }),
    el('div', { class: 'flex items-center gap-2 relative' },
      iconName ? el('div', {
        class: 'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        style: {
          background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
          color: '#fff', fontSize: '14px',
          boxShadow: `0 6px 14px -4px ${accent}66`,
        },
      }, icon(iconName)) : null,
      el('div', {
        class: 'text-[11px] uppercase tracking-[0.12em] font-extrabold',
        style: { color: accent },
      }, label),
    ),
    el('div', {
      class: 'font-display font-extrabold text-squad-deep mt-2 relative',
      style: { fontSize: '24px', letterSpacing: '-0.025em' },
    }, value),
    el('div', { class: 'text-[11px] mt-0.5 font-semibold relative', style: { color: accent, opacity: 0.85 } }, sub),
  );
}

function buildCategoryMap(list) {
  const map = {};
  (list || getAllTransactions()).forEach(t => {
    const c = categorize(t);
    map[c.category] = map[c.category] || { color: c.color, count: 0 };
    map[c.category].count += 1;
  });
  return map;
}

// CSV export — writes whatever is currently visible (filter+category+query).
function exportFilteredCsv(rows) {
  const headers = ['name', 'type', 'amount', 'category', 'time', 'ref'];
  const lines = [headers.join(',')];
  rows.forEach(t => {
    const cat = categorize(t).category;
    const row = [t.name || '', t.type || '', t.amount || 0, cat, t.time || '', t.ref || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    lines.push(row);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tradescore-transactions-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
}
