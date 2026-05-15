import { el, fmt, icon, iconTile, toast, openModal } from '../utils.js';
import {
  getUser, getInventory, addInventoryItem, updateInventoryItem, removeInventoryItem,
  recordSale, getSalesToday,
  onInventoryUpdated,
  CATALOG, DEFAULT_PRICE,
} from '../store.js';
import { createPaymentLink, generateReference } from '../payments.js';

const CATEGORIES = Object.keys(CATALOG);

export function InventoryPanel() {
  const user = getUser();

  // Default to the user's signup category if it matches, else first.
  let activeCat = CATEGORIES.includes(user.category) ? user.category : CATEGORIES[0];
  let pickedItem = null;
  let price = DEFAULT_PRICE[activeCat] || 1000;
  let qty   = 1;

  const root = el('div', { class: 'max-w-[1180px] mx-auto space-y-6' });

  // ── Header ──────────────────────────────────────────────────
  root.appendChild(el('div', { class: 'flex flex-wrap items-end justify-between gap-3' },
    el('div', {},
      el('p', { class: 'text-ink-2 text-[14px]' }, 'Your shop catalogue'),
      el('h2', {
        class: 'font-display text-[24px] md:text-[30px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.025em' },
      }, 'What do you sell?'),
      el('p', { class: 'text-[13px] text-ink-2 mt-1 max-w-[640px]' },
        'Pick a category, tap an item, set the price. Your TradeScore AI uses this to match restock loans and forecast revenue.'),
    ),
    el('div', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } },
      icon('cloud-check'), 'Auto-saved'),
  ));

  // ── Add panel ──────────────────────────────────────────────
  const addCard = el('div', { class: 'card p-5 lg:p-6 grid lg:grid-cols-[1.2fr_1fr] gap-6' });

  // Left: category + item picker
  const left = el('div', {});
  left.appendChild(el('div', { class: 'label' }, 'Category'));
  const catRow = el('div', { class: 'flex flex-wrap gap-2 mb-5' });
  CATEGORIES.forEach(c => {
    const btn = el('button', {
      class: 'px-3.5 py-2 rounded-full text-[12.5px] font-semibold tap transition-all',
      'data-cat': c,
      onClick: () => {
        activeCat = c;
        pickedItem = null;
        price = DEFAULT_PRICE[c] || 1000;
        priceInput.value = String(price);
        paintPriceDisplay();
        renderItems(); paintCats(); renderPicked();
      },
    }, c);
    catRow.appendChild(btn);
  });
  left.appendChild(catRow);
  function paintCats() {
    catRow.querySelectorAll('[data-cat]').forEach(b => {
      const a = b.dataset.cat === activeCat;
      b.style.background = a ? '#022B23' : '#fff';
      b.style.color      = a ? '#fff'    : '#4A5C56';
      b.style.border     = a ? '1px solid #022B23' : '1px solid #E2E8E4';
    });
  }
  paintCats();

  left.appendChild(el('div', { class: 'label' }, 'Pick an item'));
  const itemGrid = el('div', { class: 'grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3' });
  left.appendChild(itemGrid);

  left.appendChild(el('div', { class: 'label mt-2' }, 'Or type a custom item'));
  const customInput = el('input', {
    class: 'input',
    placeholder: 'e.g. Hand-woven basket',
  });
  customInput.addEventListener('input', () => {
    if (customInput.value.trim()) {
      pickedItem = customInput.value.trim();
      paintItems();
      renderPicked();
    }
  });
  left.appendChild(customInput);

  function renderItems() {
    itemGrid.innerHTML = '';
    (CATALOG[activeCat] || []).forEach(name => {
      const btn = el('button', {
        class: 'h-11 rounded-xl text-[12.5px] font-semibold tap text-left px-3 truncate transition-all',
        'data-item': name,
        onClick: () => {
          pickedItem = name;
          customInput.value = '';
          paintItems();
          renderPicked();
        },
      }, name);
      itemGrid.appendChild(btn);
    });
    paintItems();
  }
  function paintItems() {
    itemGrid.querySelectorAll('[data-item]').forEach(b => {
      const a = b.dataset.item === pickedItem;
      b.style.background = a ? '#E8F4EE' : '#fff';
      b.style.color      = a ? '#0B6E4F' : '#4A5C56';
      b.style.border     = a ? '1px solid #0B6E4F' : '1px solid #E2E8E4';
      b.style.boxShadow  = a ? '0 4px 12px rgba(11,110,79,0.18)' : 'none';
    });
  }
  renderItems();

  // Right: price + qty + add
  const right = el('div', { class: 'p-5 rounded-2xl', style: { background: '#FAFAF6', border: '1px solid #E2E8E4' } });

  const pickedDisplay = el('div', {
    class: 'mb-4 p-3 rounded-xl bg-white border border-line text-[13px] flex items-center gap-2',
  });
  right.appendChild(pickedDisplay);

  function renderPicked() {
    pickedDisplay.innerHTML = '';
    pickedDisplay.appendChild(el('span', {
      class: 'w-7 h-7 rounded-lg flex items-center justify-center text-squad-green',
      style: { background: '#E8F4EE', fontSize: '13px' },
    }, icon('box-seam')));
    if (pickedItem) {
      pickedDisplay.appendChild(el('span', { class: 'font-bold text-ink-1' }, pickedItem));
      pickedDisplay.appendChild(el('span', {
        class: 'chip ml-auto',
        style: { background: '#E8F4EE', color: '#0B6E4F' },
      }, activeCat));
    } else {
      pickedDisplay.appendChild(el('span', { class: 'text-ink-3 italic' }, 'No item selected yet'));
    }
  }
  renderPicked();

  // Price
  right.appendChild(el('div', { class: 'label' }, 'Unit price (₦)'));
  const priceWrap = el('div', { class: 'flex items-center gap-2' });
  const priceMinus = stepBtn('dash-lg', () => { price = Math.max(0, price - stepFor()); priceInput.value = String(price); paintPriceDisplay(); });
  const priceInput = el('input', {
    class: 'input text-center !text-[18px] font-display font-extrabold !py-2.5',
    type: 'number', min: '0', step: '100', value: String(price),
  });
  priceInput.addEventListener('input', () => {
    const n = parseInt(priceInput.value, 10);
    price = isNaN(n) ? 0 : n;
    paintPriceDisplay();
  });
  const pricePlus = stepBtn('plus-lg', () => { price = price + stepFor(); priceInput.value = String(price); paintPriceDisplay(); });
  priceWrap.appendChild(priceMinus);
  priceWrap.appendChild(priceInput);
  priceWrap.appendChild(pricePlus);
  right.appendChild(priceWrap);

  const stepRow = el('div', { class: 'flex flex-wrap gap-2 mt-2.5' });
  let activeStep = 100;
  function stepFor() { return activeStep; }
  [100, 500, 1000, 5000].forEach(s => {
    const b = el('button', {
      class: 'px-3 py-1.5 rounded-full text-[11.5px] font-semibold tap',
      'data-step': s,
      onClick: () => { activeStep = s; paintSteps(); },
    }, '± ₦' + s.toLocaleString());
    stepRow.appendChild(b);
  });
  function paintSteps() {
    stepRow.querySelectorAll('[data-step]').forEach(b => {
      const a = +b.dataset.step === activeStep;
      b.style.background = a ? '#022B23' : '#fff';
      b.style.color      = a ? '#fff'    : '#4A5C56';
      b.style.border     = a ? '1px solid #022B23' : '1px solid #E2E8E4';
    });
  }
  paintSteps();
  right.appendChild(stepRow);

  const preview = el('div', { class: 'mt-4 text-[12px] text-ink-3' });
  function paintPriceDisplay() { preview.textContent = 'Preview: ' + fmt(price) + ' per unit'; }
  paintPriceDisplay();
  right.appendChild(preview);

  // Quantity in stock
  right.appendChild(el('div', { class: 'label mt-5' }, 'Quantity in stock'));
  const qtyWrap = el('div', { class: 'flex items-center gap-2' });
  const qtyMinus = stepBtn('dash-lg', () => { qty = Math.max(1, qty - 1); qtyInput.value = String(qty); });
  const qtyInput = el('input', {
    class: 'input text-center !text-[16px] font-bold !py-2.5',
    type: 'number', min: '1', step: '1', value: String(qty),
  });
  qtyInput.addEventListener('input', () => {
    const n = parseInt(qtyInput.value, 10);
    qty = isNaN(n) || n < 1 ? 1 : n;
  });
  const qtyPlus = stepBtn('plus-lg', () => { qty = qty + 1; qtyInput.value = String(qty); });
  qtyWrap.appendChild(qtyMinus);
  qtyWrap.appendChild(qtyInput);
  qtyWrap.appendChild(qtyPlus);
  right.appendChild(qtyWrap);

  // Add button — optimistic local update + backend POST handled inside store.
  const addBtn = el('button', {
    class: 'btn btn-primary w-full mt-5 !py-3.5',
    onClick: () => {
      if (!pickedItem) {
        flash(pickedDisplay, '#FCE8E8');
        return;
      }
      addInventoryItem({
        name: pickedItem,
        category: activeCat,
        price,
        qty,
      });
      pickedItem = null;
      customInput.value = '';
      qty = 1; qtyInput.value = '1';
      paintItems(); renderPicked();
      flash(addBtn, '#E5F9F0');
    },
  }, icon('plus-circle-fill'), 'Add to inventory');
  right.appendChild(addBtn);

  addCard.appendChild(left);
  addCard.appendChild(right);
  root.appendChild(addCard);

  // ── List of saved items ─────────────────────────────────────
  const listCard = el('div', { class: 'card p-5 lg:p-6' });
  const listHeader = el('div', { class: 'flex items-center justify-between flex-wrap gap-2 mb-4' });
  listHeader.appendChild(el('div', {},
    el('h3', {
      class: 'font-display text-[18px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, 'Your inventory'),
    el('p', { class: 'text-[12px] text-ink-3 mt-0.5' },
      'Tap − or + under any price to adjust. Quantity controls are on the right.'),
  ));
  const headerChips = el('div', { class: 'flex items-center gap-2 flex-wrap' });
  const salesChip = el('span', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } });
  const totalChip = el('span', { class: 'chip', style: { background: '#022B23', color: '#E8FF8B' } });
  headerChips.appendChild(salesChip);
  headerChips.appendChild(totalChip);
  listHeader.appendChild(headerChips);
  listCard.appendChild(listHeader);

  const list = el('div', { class: 'divide-y divide-line -mx-2' });
  listCard.appendChild(list);
  root.appendChild(listCard);

  function renderList() {
    const items = getInventory();
    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(el('div', { class: 'p-8 text-center text-ink-3 text-[13px]' },
        'No items yet — pick a category above and add your first one.'));
      totalChip.innerHTML = '';
      totalChip.appendChild(el('span', {}, '0 items'));
      salesChip.innerHTML = '';
      salesChip.appendChild(el('span', {}, 'No sales today'));
      return;
    }
    items.forEach(it => list.appendChild(buildRow(it, renderList)));
    const totalValue = items.reduce((s, it) => s + (it.price * it.qty), 0);
    totalChip.innerHTML = '';
    totalChip.appendChild(el('span', {}, items.length + ' items · '));
    totalChip.appendChild(el('span', {}, fmt(totalValue) + ' total stock value'));

    const todays = getSalesToday();
    const earned = todays.reduce((s, t) => s + t.total, 0);
    salesChip.innerHTML = '';
    salesChip.appendChild(el('span', { style: { fontSize: '11px', display: 'inline-flex', marginRight: '4px' } }, icon('cash-coin')));
    salesChip.appendChild(el('span', {}, todays.length + ' sold today · ' + fmt(earned)));
  }
  renderList();

  // Re-render when backend pushes a fresh inventory snapshot.
  onInventoryUpdated(() => renderList());

  return root;
}

function buildRow(it, refresh) {
  const row = el('div', { class: 'flex flex-wrap items-center gap-3 p-3 mx-2 rounded-xl hover:bg-squad-paper' });

  row.appendChild(el('div', { class: 'flex items-center gap-3 flex-1 min-w-[180px]' },
    iconTile('box-seam', { size: 40, fontSize: 16, bg: '#E8F4EE', color: '#0B6E4F', radius: 11 }),
    el('div', { class: 'min-w-0' },
      el('div', { class: 'text-[13.5px] font-bold text-ink-1 truncate' }, it.name),
      el('div', { class: 'text-[11px] text-ink-3 mt-0.5 flex items-center gap-1.5' },
        el('span', { class: 'chip', style: { background: '#E8F4EE', color: '#0B6E4F', padding: '1px 7px', fontSize: '10px' } }, it.category),
      ),
    ),
  ));

  // Price block with - / +
  const priceBlock = el('div', { class: 'flex items-center gap-1.5' });
  priceBlock.appendChild(el('button', {
    class: 'w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center hover:bg-squad-paper text-ink-1',
    style: { fontSize: '13px' },
    onClick: () => {
      const next = Math.max(0, it.price - 100);
      updateInventoryItem(it.id, { price: next });
      refresh();
    },
    title: 'Reduce price by ₦100',
  }, icon('dash-lg')));
  priceBlock.appendChild(el('div', {
    class: 'min-w-[110px] text-center',
  },
    el('div', {
      class: 'font-display text-[16px] font-extrabold text-squad-deep',
      style: { letterSpacing: '-0.02em' },
    }, fmt(it.price)),
    el('div', { class: 'text-[10.5px] text-ink-3' }, 'per unit'),
  ));
  priceBlock.appendChild(el('button', {
    class: 'w-8 h-8 rounded-lg flex items-center justify-center text-white',
    style: { background: '#0B6E4F', fontSize: '13px' },
    onClick: () => {
      updateInventoryItem(it.id, { price: it.price + 100 });
      refresh();
    },
    title: 'Increase price by ₦100',
  }, icon('plus-lg')));

  // Bigger step row (₦1k)
  const bigStepRow = el('div', { class: 'flex items-center gap-1' });
  [-1000, 1000].forEach(s => {
    bigStepRow.appendChild(el('button', {
      class: 'px-2 py-1 rounded-md text-[10.5px] font-semibold border border-line bg-white hover:bg-squad-paper',
      onClick: () => {
        const next = Math.max(0, it.price + s);
        updateInventoryItem(it.id, { price: next });
        refresh();
      },
    }, (s > 0 ? '+' : '−') + '₦1k'));
  });

  const priceCol = el('div', { class: 'flex flex-col items-center gap-1.5' }, priceBlock, bigStepRow);
  row.appendChild(priceCol);

  // Qty stepper
  row.appendChild(el('div', { class: 'flex items-center gap-1' },
    el('button', {
      class: 'w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-ink-1',
      style: { fontSize: '13px' },
      onClick: () => {
        if (it.qty > 1) { updateInventoryItem(it.id, { qty: it.qty - 1 }); refresh(); }
      },
    }, icon('dash-lg')),
    el('div', { class: 'w-12 text-center' },
      el('div', { class: 'text-[14px] font-extrabold text-ink-1' }, String(it.qty)),
      el('div', { class: 'text-[10px] text-ink-3 -mt-0.5' }, 'in stock'),
    ),
    el('button', {
      class: 'w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-ink-1',
      style: { fontSize: '13px' },
      onClick: () => {
        updateInventoryItem(it.id, { qty: it.qty + 1 });
        refresh();
      },
    }, icon('plus-lg')),
  ));

  // Cash sale button
  const soldOut = it.qty <= 0;
  const saleBtn = el('button', {
    class: 'flex items-center gap-1.5 px-3 h-9 rounded-xl text-[12px] font-extrabold tap transition-all',
    style: soldOut
      ? { background: '#F5F5F0', color: '#9AA8A2', cursor: 'not-allowed' }
      : { background: '#E8FF8B', color: '#022B23', boxShadow: '0 6px 14px rgba(232,255,139,0.45)' },
    onClick: () => {
      if (soldOut) {
        toast(it.name + ' is out of stock', { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        return;
      }
      openCashSaleModal(it, refresh);
    },
    title: 'Record a cash sale',
  },
    el('span', { style: { fontSize: '13px', display: 'inline-flex' } }, icon('cash-coin')),
    el('span', {}, soldOut ? 'Sold out' : 'Cash sale'),
  );
  row.appendChild(saleBtn);

  // Delete
  row.appendChild(el('button', {
    class: 'w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:bg-squad-paper hover:text-[#D43E3E]',
    style: { fontSize: '14px' },
    onClick: () => { removeInventoryItem(it.id); refresh(); },
    title: 'Remove item',
  }, icon('trash3')));

  return row;
}

function stepBtn(iconName, onClick) {
  return el('button', {
    class: 'w-11 h-11 rounded-xl bg-white border border-line flex items-center justify-center hover:bg-squad-paper text-ink-1 flex-shrink-0',
    style: { fontSize: '15px' },
    onClick,
  }, icon(iconName));
}

function flash(node, color) {
  const original = node.style.background;
  node.style.background = color;
  setTimeout(() => { node.style.background = original; }, 320);
}

// ── Cash-sale modal ─────────────────────────────────────────────
function openCashSaleModal(item, refresh) {
  openModal(({ modal, close }) => {
    const user = getUser();
    let qty = 1;
    let generating = false;
    let result = null;

    modal.appendChild(el('div', { class: 'mb-4 pr-10' },
      el('h3', {
        class: 'font-display text-[20px] font-extrabold text-squad-deep',
        style: { letterSpacing: '-0.02em' },
      }, 'Cash sale'),
      el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' },
        'Confirm units and generate a payment link to share with the customer.'),
    ));

    modal.appendChild(el('div', {
      class: 'p-4 rounded-2xl mb-4 flex items-center gap-3',
      style: { background: '#FAFAF6', border: '1px solid #E2E8E4' },
    },
      iconTile('box-seam', { size: 44, fontSize: 17, bg: '#E8F4EE', color: '#0B6E4F', radius: 12 }),
      el('div', { class: 'flex-1 min-w-0' },
        el('div', { class: 'text-[14px] font-extrabold text-ink-1' }, item.name),
        el('div', { class: 'text-[11.5px] text-ink-3' },
          item.category + ' · ' + fmt(item.price) + ' / unit · ' + item.qty + ' in stock'),
      ),
    ));

    modal.appendChild(el('div', { class: 'label' }, 'Units sold'));
    const qtyWrap = el('div', { class: 'flex items-center gap-2' });
    const qtyMinus = el('button', {
      class: 'w-11 h-11 rounded-xl bg-white border border-line flex items-center justify-center text-ink-1 hover:bg-squad-paper',
      style: { fontSize: '15px' },
      type: 'button',
      onClick: () => { if (qty > 1) { qty -= 1; qtyInput.value = String(qty); paint(); } },
    }, icon('dash-lg'));
    const qtyInput = el('input', {
      class: 'input text-center !text-[18px] font-extrabold !py-2.5',
      type: 'number', min: '1', max: String(item.qty), value: String(qty),
    });
    qtyInput.addEventListener('input', () => {
      let n = parseInt(qtyInput.value, 10);
      if (isNaN(n) || n < 1) n = 1;
      if (n > item.qty) n = item.qty;
      qty = n;
      qtyInput.value = String(qty);
      paint();
    });
    const qtyPlus = el('button', {
      class: 'w-11 h-11 rounded-xl flex items-center justify-center text-white hover:opacity-90',
      style: { background: '#0B6E4F', fontSize: '15px' },
      type: 'button',
      onClick: () => { if (qty < item.qty) { qty += 1; qtyInput.value = String(qty); paint(); } },
    }, icon('plus-lg'));
    qtyWrap.appendChild(qtyMinus);
    qtyWrap.appendChild(qtyInput);
    qtyWrap.appendChild(qtyPlus);
    modal.appendChild(qtyWrap);

    const totalCard = el('div', {
      class: 'mt-4 p-5 rounded-2xl flex items-center justify-between',
      style: { background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)' },
    });
    const totalLabel = el('div', {},
      el('div', { class: 'text-[10.5px] uppercase tracking-widest font-bold', style: { color: '#E8FF8B' } },
        'Customer pays'),
      el('div', { class: 'text-[11px] mt-0.5', style: { color: 'rgba(255,255,255,0.7)' } }, ''),
    );
    const totalValue = el('div', {
      class: 'font-display font-extrabold text-white',
      style: { fontSize: '28px', letterSpacing: '-0.025em' },
    }, '');
    totalCard.appendChild(totalLabel);
    totalCard.appendChild(totalValue);
    modal.appendChild(totalCard);

    const resultBox = el('div', { class: 'mt-4' });
    modal.appendChild(resultBox);

    const actions = el('div', { class: 'flex gap-2 mt-5' });
    const cancelBtn = el('button', {
      class: 'btn btn-ghost flex-1',
      type: 'button',
      onClick: close,
    }, 'Cancel');
    const genBtn = el('button', {
      class: 'btn btn-primary flex-1',
      type: 'button',
      onClick: doGenerate,
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(genBtn);
    modal.appendChild(actions);

    function paint() {
      const total = item.price * qty;
      totalValue.textContent = fmt(total);
      totalLabel.querySelector('div:last-child').textContent =
        qty + ' × ' + fmt(item.price);
      genBtn.innerHTML = '';
      if (generating) {
        genBtn.appendChild(el('span', { class: 'inline-flex items-center gap-2' },
          el('span', { style: { fontSize: '14px' } }, icon('arrow-clockwise')),
          el('span', {}, 'Generating…'),
        ));
        genBtn.disabled = true;
      } else if (result) {
        genBtn.appendChild(el('span', { class: 'inline-flex items-center gap-2' },
          icon('check-lg'),
          el('span', {}, 'Mark as paid'),
        ));
        genBtn.disabled = false;
      } else {
        genBtn.appendChild(el('span', { class: 'inline-flex items-center gap-2' },
          icon('link-45deg'),
          el('span', {}, 'Generate payment link'),
        ));
        genBtn.disabled = false;
      }
    }
    paint();

    async function doGenerate() {
      // Second click after generation — record the sale and close
      if (result) {
        const r = recordSale(item, qty);
        if (r.ok) {
          toast('Sale recorded · ' + qty + ' × ' + item.name, { iconName: 'check-circle-fill' });
          refresh();
          close();
        } else {
          toast('Not enough stock', { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
        }
        return;
      }
      generating = true; paint();
      try {
        const amount = item.price * qty;
        result = await createPaymentLink({
          item,
          qty,
          amount,
          currency: 'NGN',
          reference: generateReference('TS'),
          customer: { name: user.name, business: user.business, walletId: user.squadWallet },
        });
        renderResult(result, amount);
      } catch (err) {
        toast('Could not generate link · ' + (err?.message || 'try again'),
          { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
      } finally {
        generating = false; paint();
      }
    }

    function renderResult(res, amount) {
      resultBox.innerHTML = '';
      const card = el('div', {
        class: 'p-4 rounded-2xl',
        style: { background: '#E8FF8B', border: '1px solid #C5F362' },
      });
      card.appendChild(el('div', { class: 'flex items-center gap-2 mb-2' },
        el('span', { style: { color: '#022B23', fontSize: '14px' } }, icon('check-circle-fill')),
        el('span', { class: 'text-[11px] uppercase tracking-widest font-extrabold text-squad-deep' },
          'Payment link ready'),
      ));
      const urlField = el('div', {
        class: 'flex items-center gap-1 p-2 rounded-xl bg-white border border-line',
      },
        el('span', { style: { fontSize: '13px', color: '#0B6E4F', padding: '0 6px' } }, icon('link-45deg')),
        el('input', {
          class: 'flex-1 bg-transparent outline-none text-[12.5px] font-mono text-ink-1',
          value: res.url,
          readonly: 'readonly',
          onClick: e => e.target.select(),
        }),
        el('button', {
          class: 'w-9 h-9 rounded-lg flex items-center justify-center text-white',
          style: { background: '#0B6E4F', fontSize: '13px' },
          title: 'Copy link',
          onClick: () => {
            navigator.clipboard?.writeText(res.url);
            toast('Link copied to clipboard', { iconName: 'clipboard-check' });
          },
        }, icon('clipboard')),
      );
      card.appendChild(urlField);

      const shareRow = el('div', { class: 'flex flex-wrap gap-2 mt-3' });
      const waMsg = encodeURIComponent(
        `Hi! Please pay ${fmt(amount)} for ${qty} × ${item.name}.\nLink: ${res.url}\nRef: ${res.reference}`,
      );
      shareRow.appendChild(shareLink('whatsapp',  'WhatsApp', '#25D366', `https://wa.me/?text=${waMsg}`));
      shareRow.appendChild(shareLink('envelope',  'Email',    '#0B6E4F', `mailto:?subject=Payment%20link&body=${waMsg}`));
      shareRow.appendChild(shareLink('telephone', 'SMS',      '#1F8A65', `sms:?&body=${waMsg}`));
      shareRow.appendChild(el('button', {
        class: 'chip cursor-pointer',
        style: { background: '#022B23', color: '#fff' },
        onClick: () => {
          if (navigator.share) {
            navigator.share({ title: 'TradeScore payment', text: 'Pay ' + fmt(amount), url: res.url }).catch(() => {});
          } else {
            navigator.clipboard?.writeText(res.url);
            toast('Link copied — paste it anywhere', { iconName: 'clipboard-check' });
          }
        },
      }, icon('share-fill'), 'Share'));
      card.appendChild(shareRow);

      card.appendChild(el('div', { class: 'mt-3 grid grid-cols-2 gap-2 text-[11.5px] text-squad-deep/80' },
        el('div', {}, el('span', { class: 'font-bold' }, 'Ref: '), res.reference),
        el('div', { class: 'text-right' }, el('span', { class: 'font-bold' }, 'Provider: '), res.provider),
      ));

      resultBox.appendChild(card);
      cancelBtn.textContent = '';
      cancelBtn.appendChild(icon('arrow-clockwise'));
      cancelBtn.appendChild(el('span', { class: 'ml-1' }, 'New link'));
      cancelBtn.onclick = () => {
        result = null;
        resultBox.innerHTML = '';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = close;
        paint();
      };
    }
  });
}

function shareLink(iconName, label, color, href) {
  return el('a', {
    class: 'chip',
    href, target: '_blank', rel: 'noopener',
    style: { background: '#fff', color, border: '1px solid #E2E8E4', textDecoration: 'none' },
  }, icon(iconName), label);
}
