import { el, fmt, icon } from '../utils.js';
import { getTxs, onTxsUpdated } from '../store.js';
import { categorize } from '../ai.js';

export function Transactions() {
  const root = el('div', { class: 'max-w-[1280px] mx-auto space-y-6' });
  let filter = 'all';
  let category = null;
  // Pre-fill from ?q= in the URL (set by the topbar search submit) so a search
  // from any tab lands here pre-filtered.
  let query = (new URLSearchParams(location.search).get('q') || '').trim().toLowerCase();

  // Containers that get refilled whenever txs change
  const kpiRow = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up' });
  root.appendChild(kpiRow);

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

  // Returns the currently-visible (filter/category/query-respecting) txs.
  // Mirrors the logic inside renderList so the CSV matches the screen.
  function visibleTxs() {
    let v = getTxs().filter(t => filter === 'all' || t.type === filter);
    if (category) v = v.filter(t => categorize(t).category === category);
    if (query) {
      v = v.filter(t => {
        const haystack = [t.name, t.ref, categorize(t).category, String(t.amount)]
          .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    return v;
  }

  // ── Category chips (rebuilt on data change) ─────────────
  const catBar = el('div', { class: 'flex flex-wrap gap-2 fade-up-2' });
  root.appendChild(catBar);

  // ── List ────────────────────────────────────────────────
  const card = el('div', { class: 'card p-2 md:p-3 fade-up-3' });
  const list = el('div', { class: 'divide-y divide-line' });
  card.appendChild(list);
  root.appendChild(card);

  function renderKpis() {
    const txs = getTxs();
    const inflow  = txs.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    const outflow = txs.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    const inCount  = txs.filter(t => t.type === 'in').length;
    const outCount = txs.filter(t => t.type === 'out').length;
    kpiRow.innerHTML = '';
    kpiRow.appendChild(KpiSm('Total inflow',  fmt(inflow),  `${inCount} ${inCount === 1 ? 'transaction' : 'transactions'} · all time`, '#27AE60', 'arrow-down-circle'));
    kpiRow.appendChild(KpiSm('Total outflow', fmt(outflow), `${outCount} ${outCount === 1 ? 'transaction' : 'transactions'} · all time`, '#D4711F', 'arrow-up-circle'));
    kpiRow.appendChild(KpiSm('Net flow',      fmt(inflow - outflow), 'All time', '#0B6E4F', 'graph-up-arrow'));
    kpiRow.appendChild(KpiSm('Categories',    Object.keys(buildCategoryMap(txs)).length, 'AI-detected types', '#6C5CE7', 'tags'));
  }

  function renderCats() {
    const txs = getTxs();
    const cats = buildCategoryMap(txs);
    catBar.innerHTML = '';
    const allBtn = el('button', {
      class: 'chip px-4 py-2 cursor-pointer tap',
      'data-cat': '__all',
      onClick: () => { category = null; renderList(); paintCats(); },
    }, icon('grid-fill'), 'All categories');
    catBar.appendChild(allBtn);
    Object.entries(cats).forEach(([name, info]) => {
      const btn = el('button', {
        class: 'chip px-4 py-2 cursor-pointer tap',
        'data-cat': name,
        onClick: () => { category = (category === name ? null : name); renderList(); paintCats(); },
      }, icon('tag-fill'), `${name} · ${info.count}`);
      catBar.appendChild(btn);
    });
    paintCats();
  }
  function paintCats() {
    const cats = buildCategoryMap(getTxs());
    catBar.querySelectorAll('[data-cat]').forEach(b => {
      const key = b.dataset.cat;
      const isAll = key === '__all';
      const active = isAll ? !category : (category === key);
      if (isAll) {
        b.style.background = active ? '#022B23' : '#fff';
        b.style.color      = active ? '#fff' : '#4A5C56';
        b.style.border     = active ? '1px solid #022B23' : '1px solid #E2E8E4';
      } else {
        const info = cats[key];
        b.style.background = active ? info.color : '#fff';
        b.style.color      = active ? '#fff' : info.color;
        b.style.border     = active ? '1px solid ' + info.color : '1px solid #E2E8E4';
      }
    });
  }

  function renderList() {
    const txs = getTxs();
    list.innerHTML = '';
    let visible = txs.filter(t => filter === 'all' || t.type === filter);
    if (category) visible = visible.filter(t => categorize(t).category === category);
    if (query) {
      visible = visible.filter(t => {
        const haystack = [
          t.name,
          t.ref,
          categorize(t).category,
          String(t.amount),
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    if (!visible.length) {
      list.appendChild(el('div', { class: 'p-8 text-center text-ink-3 text-[13px]' },
        query ? `No transactions match "${query}".` : 'No transactions match this filter.'));
      return;
    }
    visible.forEach(t => list.appendChild(buildRow(t)));
  }

  function renderAll() {
    renderKpis();
    renderCats();
    renderList();
  }
  renderAll();
  onTxsUpdated(() => renderAll());

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
      el('div', { class: 'text-[11.5px] text-ink-3 mt-0.5' }, tx.time + (tx.ref ? ' · ' + tx.ref : '')),
    ),
    el('div', {
      class: 'text-[14.5px] font-extrabold flex-shrink-0',
      style: { color: isIn ? '#27AE60' : '#0A1F1A' },
    }, (isIn ? '+' : '-') + fmt(tx.amount)),
  );
}

function KpiSm(label, value, sub, accent, iconName) {
  return el('div', { class: 'card p-4' },
    el('div', { class: 'flex items-center gap-2' },
      iconName ? el('span', { style: { color: accent, fontSize: '15px' } }, icon(iconName)) : null,
      el('div', { class: 'text-[10.5px] uppercase tracking-[0.1em] text-ink-3 font-bold' }, label),
    ),
    el('div', {
      class: 'font-display font-extrabold text-squad-deep mt-1.5',
      style: { fontSize: '24px', letterSpacing: '-0.025em' },
    }, value),
    el('div', { class: 'text-[11px] mt-0.5 text-ink-3' }, sub),
  );
}

// Build a CSV from the current filtered transactions and trigger a browser
// download. Quotes every field defensively so commas/newlines in descriptions
// don't break the file.
function exportFilteredCsv(txs) {
  if (!txs.length) return;
  const header = ['Date', 'Description', 'Reference', 'Direction', 'Category', 'Amount (NGN)'];
  const csvRow = (arr) => arr
    .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',');
  const lines = [csvRow(header)];
  txs.forEach(t => {
    lines.push(csvRow([
      t.occurred_at || t.time || '',
      t.name || '',
      t.ref || '',
      t.type === 'in' ? 'Inflow' : 'Outflow',
      categorize(t).category,
      (t.type === 'in' ? '+' : '-') + (t.amount || 0),
    ]));
  });
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tradescore-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildCategoryMap(txs) {
  const map = {};
  (txs || []).forEach(t => {
    const c = categorize(t);
    map[c.category] = map[c.category] || { color: c.color, count: 0 };
    map[c.category].count += 1;
  });
  return map;
}
