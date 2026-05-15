import { el, fmt, icon } from '../utils.js';

// Transaction row used in the Overview and Transactions panels.
// `opts.showCategory` toggles the AI-tagged category chip.
// `opts.categorize` is the AI categorisation function (passed in to keep
// imports tidy and let us swap implementations later).
export function TxRow(tx, opts = {}) {
  const isIn = tx.type === 'in';
  const cat = opts.showCategory && opts.categorize ? opts.categorize(tx) : null;

  return el('div', {
    class: 'flex items-center gap-4 py-3.5',
  },
    el('div', {
      class: 'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
      style: {
        background: isIn ? '#E5F9F0' : '#FFEFE5',
        color: isIn ? '#27AE60' : '#D4711F',
        fontSize: '16px',
      },
    }, icon(isIn ? 'arrow-down' : 'arrow-up')),

    el('div', { class: 'flex-1 min-w-0' },
      el('div', { class: 'flex items-center gap-2 flex-wrap' },
        el('div', { class: 'text-[14px] font-bold text-ink-1' }, tx.name),
        cat ? el('span', {
          class: 'chip',
          style: { background: cat.color + '18', color: cat.color, padding: '2px 8px', fontSize: '10px' },
        }, icon('tag-fill'), cat.category) : null,
      ),
      el('div', { class: 'text-[11.5px] text-ink-3 mt-0.5' }, tx.time + (tx.ref ? ' · ' + tx.ref : '')),
    ),

    el('div', {
      class: 'text-[14px] font-extrabold flex-shrink-0',
      style: { color: isIn ? '#27AE60' : '#0A1F1A' },
    }, (isIn ? '+' : '-') + fmt(tx.amount)),
  );
}
