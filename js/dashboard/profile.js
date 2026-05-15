import { el, fmt, icon, openModal, toast } from '../utils.js';
import {
  getUser, saveUser, clearUser, getPrefs, savePrefs, getScore, onScoreUpdated, onTxsUpdated,
  CATALOG,
} from '../store.js';

export function ProfilePanel({ navigate }) {
  const root = el('div', { class: 'max-w-[960px] mx-auto space-y-6' });
  render();
  // Re-render whenever live score or txs change — keeps the header chips and
  // stat strip in sync with whatever's happening on the Overview tab.
  onScoreUpdated(() => render());
  onTxsUpdated(() => render());

  function render() {
    const TRADER = getUser();
    const liveScore = getScore();
    const score = liveScore?.score;
    const agg = liveScore?.aggregates || {};
    root.innerHTML = '';

    const SETTINGS = [
      { icon: 'shop',              label: 'Business details', sub: 'Edit shop name, category, location',  onClick: openBusinessModal },
      { icon: 'link-45deg',        label: 'Squad wallet',
        sub: TRADER.squadWallet
          ? `${TRADER.virtualAccountBank || 'GTBank'} · ${TRADER.squadWallet}`
          : 'Provisioning — refresh in a moment',
        tag: TRADER.squadWallet ? 'Linked' : 'Pending',
        onClick: openWalletModal },
      { icon: 'box-seam',          label: 'Inventory',        sub: 'Manage items and prices',             onClick: () => navigate('#/app/inventory') },
      { icon: 'file-earmark-text', label: 'Loan history',     sub: 'View past loans & repayment schedule', onClick: openLoanHistoryModal },
      { icon: 'bell',              label: 'Notifications',    sub: 'Email, SMS and in-app alerts',         onClick: openNotificationsModal },
      { icon: 'shield-lock',       label: 'Security & PIN',   sub: 'Two-factor authentication, login PIN', onClick: openSecurityModal },
      { icon: 'robot',             label: 'AI preferences',   sub: 'Tune insight frequency and tone',      onClick: openAiPrefsModal },
      { icon: 'question-circle',   label: 'Help & support',   sub: 'Chat with our team, read FAQs',        onClick: openHelpModal },
    ];

    // ── Header card ──────────────────────────────────────────
    const header = el('div', {
      class: 'rounded-2xl p-7 lg:p-8 grid lg:grid-cols-[auto_1fr_auto] gap-6 items-center fade-up',
      style: {
        background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)',
        boxShadow: '0 16px 40px rgba(2, 43, 35, 0.18)',
      },
    });
    header.appendChild(el('div', {
      class: 'w-[88px] h-[88px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[26px]',
      style: { background: 'rgba(232,255,139,0.18)', border: '1px solid rgba(232,255,139,0.28)' },
    }, TRADER.avatar || initialsOf(TRADER.name) || '?'));

    const info = el('div', {});
    info.appendChild(el('h1', { class: 'font-display text-white font-extrabold text-[26px] lg:text-[30px]' },
      TRADER.name || 'Your profile'));
    info.appendChild(el('p', {
      class: 'text-[13.5px] mt-1 flex items-center gap-1.5 flex-wrap', style: { color: 'rgba(255,255,255,0.75)' },
    },
      TRADER.business ? TRADER.business + ' · ' : '',
      TRADER.location ? icon('geo-alt') : null,
      TRADER.location || '',
    ));

    const chips = el('div', { class: 'flex flex-wrap gap-2 mt-3' });
    if (score != null) {
      chips.appendChild(el('span', { class: 'chip', style: { background: '#E8FF8B', color: '#022B23' } },
        'TradeScore ' + score));
    } else {
      chips.appendChild(el('span', {
        class: 'chip',
        style: { background: 'rgba(255,255,255,0.10)', color: 'rgba(232,255,139,0.85)', border: '1px solid rgba(232,255,139,0.30)' },
      }, 'No score yet'));
    }
    if (TRADER.since) {
      chips.appendChild(el('span', {
        class: 'chip',
        style: { background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(232,255,139,0.30)' },
      }, 'Member since ' + TRADER.since));
    }
    info.appendChild(chips);
    header.appendChild(info);

    header.appendChild(el('button', {
      class: 'btn btn-lime !py-3 !px-5 !text-[13px] self-start lg:self-center',
      onClick: openBusinessModal,
    }, icon('pencil-square'), 'Edit profile'));
    root.appendChild(header);

    // ── Stat strip ──────────────────────────────────────────
    const dash = '—';
    const stripWrap = el('div', { class: 'fade-up-1' });
    const stripHeader = el('div', { class: 'flex items-center justify-between mb-2 px-1' },
      el('div', { class: 'text-[10.5px] uppercase tracking-wider text-ink-3 font-bold' }, 'At a glance'),
      el('div', { class: 'flex items-center gap-1.5 text-[11px] font-medium', style: { color: '#0B6E4F' } },
        el('span', {
          class: 'inline-block rounded-full',
          style: {
            width: '7px', height: '7px', background: '#27AE60',
            animation: 'pulse 1.6s infinite',
          },
        }),
        'Live',
      ),
    );
    const strip = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4' });
    [
      { label: 'TradeScore',      value: score ?? dash,                                   accent: '#022B23' },
      { label: 'Monthly revenue', value: agg.monthlyRevenue ? fmt(agg.monthlyRevenue) : dash, accent: '#27AE60' },
      { label: 'Transactions',    value: agg.transactions ?? 0,                            accent: '#0B6E4F' },
      { label: 'Unique payers',   value: agg.uniqueCustomers ?? 0,                         accent: '#1F8A65' },
    ].forEach(s => strip.appendChild(el('div', {
      class: 'card p-5',
      style: { borderTop: '3px solid ' + s.accent },
    },
      el('div', {
        class: 'text-[10.5px] uppercase tracking-wider font-bold',
        style: { color: s.accent },
      }, s.label),
      el('div', {
        class: 'font-display font-extrabold text-squad-deep mt-1',
        style: { fontSize: '24px', letterSpacing: '-0.5px' },
      }, String(s.value)),
    )));
    stripWrap.appendChild(stripHeader);
    stripWrap.appendChild(strip);
    root.appendChild(stripWrap);

    // ── Settings list ───────────────────────────────────────
    const list = el('div', { class: 'card overflow-hidden fade-up-2' });
    SETTINGS.forEach((s, i) => {
      const row = el('button', {
        class: 'w-full flex items-center gap-4 p-5 text-left hover:bg-squad-paper transition-colors',
        style: i < SETTINGS.length - 1 ? { borderBottom: '1px solid #E2E8E4' } : {},
        onClick: s.onClick,
      },
        el('div', {
          class: 'w-11 h-11 rounded-xl flex items-center justify-center',
          style: { background: '#E8F4EE', color: '#0B6E4F', fontSize: '18px' },
        }, icon(s.icon)),
        el('div', { class: 'flex-1 min-w-0' },
          el('div', { class: 'flex items-center gap-2' },
            el('span', { class: 'text-[14.5px] font-bold text-ink-1' }, s.label),
            s.tag ? el('span', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } }, s.tag) : null,
          ),
          el('div', { class: 'text-[12px] text-ink-3 mt-0.5' }, s.sub),
        ),
        el('span', { class: 'text-ink-3', style: { fontSize: '14px' } }, icon('chevron-right')),
      );
      list.appendChild(row);
    });
    root.appendChild(list);

    // ── Logout ──────────────────────────────────────────────
    root.appendChild(el('button', {
      class: 'w-full btn !py-3.5 !text-[13.5px] fade-up-3',
      style: { background: '#FCE8E8', color: '#D43E3E' },
      onClick: () => {
        if (confirm('Log out of TradeScore? Your saved data stays on this device.')) {
          // Wipe local session so a fresh signup doesn't see stale state.
          clearUser();
          localStorage.removeItem('tradescore_txs');
          localStorage.removeItem('tradescore_score');
          localStorage.removeItem('tradescore_insights');
          toast('Logged out', { iconName: 'box-arrow-right', color: '#fff' });
          setTimeout(() => navigate('#/'), 400);
        }
      },
    }, icon('box-arrow-right'), 'Log out'));
  }

  // ── Modals ──────────────────────────────────────────────────
  function openBusinessModal() {
    const u = getUser();
    openModal(({ modal, close }) => {
      modal.appendChild(modalTitle('Business details', 'Update your shop info — saved instantly.'));
      const form = el('form', { class: 'space-y-3' });
      const fields = [
        { key: 'name',     label: 'Full name',     value: u.name },
        { key: 'business', label: 'Business name', value: u.business },
        { key: 'category', label: 'Category',      value: u.category, select: Object.keys(CATALOG) },
        { key: 'location', label: 'Location',      value: u.location },
        { key: 'email',    label: 'Email',         value: u.email,    type: 'email' },
        { key: 'phone',    label: 'Phone',         value: u.phone },
      ];
      const inputs = {};
      fields.forEach(f => {
        if (f.select) {
          inputs[f.key] = f.value;
          form.appendChild(el('div', {},
            el('div', { class: 'label' }, f.label),
            selectInput(f.value, f.select, val => inputs[f.key] = val),
          ));
        } else {
          inputs[f.key] = f.value || '';
          form.appendChild(el('div', {},
            el('div', { class: 'label' }, f.label),
            el('input', {
              class: 'input', value: f.value || '', type: f.type || 'text',
              onInput: e => inputs[f.key] = e.target.value,
            }),
          ));
        }
      });
      form.appendChild(el('div', { class: 'flex gap-2 mt-4' },
        el('button', { class: 'btn btn-ghost flex-1', type: 'button', onClick: close }, 'Cancel'),
        el('button', { class: 'btn btn-primary flex-1', type: 'submit' }, icon('check-lg'), 'Save changes'),
      ));
      form.addEventListener('submit', e => {
        e.preventDefault();
        saveUser(inputs);
        close();
        toast('Business details updated', { iconName: 'check-circle-fill' });
        render();
      });
      modal.appendChild(form);
    });
  }

  function openWalletModal() {
    const u = getUser();
    openModal(({ modal, close }) => {
      modal.appendChild(modalTitle('Squad wallet', 'Connected · sync status and controls.'));
      modal.appendChild(el('div', {
        class: 'rounded-2xl p-5 mb-4',
        style: { background: 'linear-gradient(135deg, #022B23 0%, #0B6E4F 100%)', color: '#fff' },
      },
        el('div', { class: 'text-[10.5px] uppercase tracking-widest font-bold', style: { color: '#E8FF8B' } }, 'Virtual account'),
        el('div', { class: 'font-display text-[22px] font-extrabold mt-1 select-all' },
          u.squadWallet || 'Provisioning…'),
        el('div', { class: 'text-[12px] mt-1', style: { color: 'rgba(255,255,255,0.7)' } },
          (u.virtualAccountBank || 'GTBank') + (u.name ? ' · ' + u.name : '')),
      ));
      modal.appendChild(el('div', { class: 'space-y-2' },
        kvLine('Account name', u.name || '—'),
        kvLine('Linked since', u.since || '—'),
        kvLine('Status', u.squadWallet ? 'Active' : 'Pending', u.squadWallet ? '#27AE60' : '#E89B2A'),
      ));
      modal.appendChild(el('div', { class: 'grid grid-cols-2 gap-2 mt-5' },
        el('button', {
          class: 'btn btn-ghost', onClick: () => {
            toast('Wallet re-syncing…', { iconName: 'arrow-clockwise' });
            close();
          },
        }, icon('arrow-clockwise'), 'Re-sync now'),
        el('button', {
          class: 'btn', style: { background: '#FCE8E8', color: '#D43E3E' },
          onClick: () => {
            if (confirm('Disconnect Squad wallet? You will lose live transaction data.')) {
              toast('Wallet disconnected', { iconName: 'plug', color: '#D43E3E' });
              close();
            }
          },
        }, icon('plug'), 'Disconnect'),
      ));
    });
  }

  function openLoanHistoryModal() {
    openModal(({ modal }) => {
      modal.appendChild(modalTitle('Loan history', 'Past loans drawn via TradeScore.'));
      // Placeholder — wire to api.loans.list() in a follow-up. For now show a
      // friendly empty state so the modal still feels useful.
      modal.appendChild(el('div', {
        class: 'p-6 rounded-xl text-center text-[13px]',
        style: { background: '#F5F9F6', border: '1px dashed #E2E8E4', color: '#4A5C56' },
      },
        el('div', { class: 'flex justify-center mb-2', style: { color: '#0B6E4F', fontSize: '24px' } }, icon('inbox')),
        el('div', { class: 'font-bold text-ink-1 mb-1' }, 'No loans drawn yet'),
        el('div', {}, 'Once you take your first loan from the Loans tab, the repayment schedule will appear here.'),
      ));
      modal.appendChild(el('div', { class: 'mt-5 p-3 rounded-xl text-[12.5px] flex items-center gap-2',
        style: { background: '#E8F4EE', color: '#0B6E4F' } },
        icon('info-circle-fill'),
        el('span', {}, 'Repayments auto-debit from your Squad wallet on schedule.'),
      ));
    });
  }

  function openNotificationsModal() {
    const prefs = getPrefs();
    openModal(({ modal, close }) => {
      modal.appendChild(modalTitle('Notifications', 'Choose how we keep you in the loop.'));
      const state = { ...prefs.notifications };
      const channels = [
        { key: 'email', label: 'Email', sub: 'Score changes, monthly summary' },
        { key: 'sms',   label: 'SMS',   sub: 'Loan approvals, repayment reminders' },
        { key: 'push',  label: 'In-app push', sub: 'Live insights and alerts' },
      ];
      const wrap = el('div', { class: 'space-y-2' });
      channels.forEach(c => wrap.appendChild(toggleRow(c.label, c.sub, state[c.key], v => state[c.key] = v)));
      modal.appendChild(wrap);
      modal.appendChild(el('button', {
        class: 'btn btn-primary w-full mt-5',
        onClick: () => {
          savePrefs({ notifications: state });
          toast('Notification preferences saved', { iconName: 'bell-fill' });
          close();
        },
      }, icon('check-lg'), 'Save preferences'));
    });
  }

  function openSecurityModal() {
    const prefs = getPrefs();
    openModal(({ modal, close }) => {
      modal.appendChild(modalTitle('Security & PIN', 'Protect your TradeScore account.'));
      const state = { pin: prefs.security.pin || '', twoFA: prefs.security.twoFA };

      modal.appendChild(el('div', { class: 'label' }, '4-digit login PIN'));
      const pinInput = el('input', {
        class: 'input text-center !text-[22px] tracking-[0.6em] font-extrabold',
        type: 'password', maxlength: '4', inputmode: 'numeric',
        placeholder: '••••', value: state.pin,
      });
      pinInput.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        state.pin = e.target.value;
      });
      modal.appendChild(pinInput);

      modal.appendChild(el('div', { class: 'mt-4' },
        toggleRow('Two-factor authentication', 'OTP via SMS on every login', state.twoFA, v => state.twoFA = v),
      ));

      modal.appendChild(el('div', {
        class: 'mt-4 p-3 rounded-xl text-[12px] flex items-start gap-2',
        style: { background: '#FFF4E0', color: '#7B5500' },
      },
        icon('shield-exclamation'),
        el('span', {}, 'Your PIN is stored locally — TradeScore never sees it in plain text.'),
      ));

      modal.appendChild(el('button', {
        class: 'btn btn-primary w-full mt-5',
        onClick: () => {
          if (state.pin && state.pin.length !== 4) {
            toast('PIN must be 4 digits', { iconName: 'exclamation-triangle-fill', color: '#D43E3E' });
            return;
          }
          savePrefs({ security: state });
          toast('Security settings updated', { iconName: 'shield-check' });
          close();
        },
      }, icon('check-lg'), 'Save'));
    });
  }

  function openAiPrefsModal() {
    const prefs = getPrefs();
    openModal(({ modal, close }) => {
      modal.appendChild(modalTitle('AI preferences', 'Tune how the assistant speaks to you.'));
      const state = { ...prefs.ai };

      modal.appendChild(el('div', { class: 'label' }, 'Tone'));
      modal.appendChild(segPicker(['friendly', 'concise', 'formal'], state.tone, v => state.tone = v));

      modal.appendChild(el('div', { class: 'label mt-4' }, 'Insight frequency'));
      modal.appendChild(segPicker(['daily', 'weekly', 'monthly'], state.frequency, v => state.frequency = v));

      modal.appendChild(el('button', {
        class: 'btn btn-primary w-full mt-5',
        onClick: () => {
          savePrefs({ ai: state });
          toast('AI preferences saved', { iconName: 'robot' });
          close();
        },
      }, icon('check-lg'), 'Save'));
    });
  }

  function openHelpModal() {
    openModal(({ modal }) => {
      modal.appendChild(modalTitle('Help & support', 'We usually reply within 1 working hour.'));
      const contacts = [
        { i: 'whatsapp',  label: 'WhatsApp us',  sub: '+234 700 123 4567',          accent: '#27AE60', href: 'https://wa.me/2347001234567' },
        { i: 'envelope',  label: 'Email support', sub: 'support@tradescore.ng',     accent: '#0B6E4F', href: 'mailto:support@tradescore.ng' },
        { i: 'telephone', label: 'Call our line', sub: '0700 TRADE-SCORE',          accent: '#1F8A65', href: 'tel:0700872337' },
        { i: 'book',      label: 'Read the FAQs', sub: 'Common questions answered', accent: '#6C5CE7', href: '#' },
      ];
      const list = el('div', { class: 'space-y-2' });
      contacts.forEach(c => list.appendChild(el('a', {
        class: 'flex items-center gap-3 p-3 rounded-xl border border-line hover:bg-squad-paper',
        href: c.href, target: '_blank', rel: 'noopener',
      },
        el('div', {
          class: 'w-10 h-10 rounded-xl flex items-center justify-center',
          style: { background: c.accent + '18', color: c.accent, fontSize: '15px' },
        }, icon(c.i)),
        el('div', { class: 'flex-1 min-w-0' },
          el('div', { class: 'text-[13.5px] font-bold text-ink-1' }, c.label),
          el('div', { class: 'text-[11.5px] text-ink-3' }, c.sub),
        ),
        el('span', { class: 'text-ink-3', style: { fontSize: '13px' } }, icon('arrow-up-right')),
      )));
      modal.appendChild(list);
    });
  }

  return root;
}

// ── Small reusable bits ────────────────────────────────────────
function initialsOf(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

function modalTitle(title, sub) {
  const wrap = el('div', { class: 'mb-4 pr-10' });
  wrap.appendChild(el('h3', {
    class: 'font-display text-[20px] font-extrabold text-squad-deep',
    style: { letterSpacing: '-0.02em' },
  }, title));
  if (sub) wrap.appendChild(el('p', { class: 'text-[12.5px] text-ink-3 mt-0.5' }, sub));
  return wrap;
}

function kvLine(k, v, vColor) {
  return el('div', { class: 'flex items-center justify-between text-[13px] py-1.5' },
    el('span', { class: 'text-ink-2' }, k),
    el('span', { class: 'font-extrabold', style: { color: vColor || '#0A1F1A' } }, v),
  );
}

function toggleRow(label, sub, initial, onChange) {
  let on = !!initial;
  const knob = el('span', {
    class: 'block w-5 h-5 rounded-full bg-white transition-transform',
    style: { transform: on ? 'translateX(20px)' : 'translateX(2px)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' },
  });
  const track = el('button', {
    type: 'button',
    class: 'w-11 h-6 rounded-full flex items-center transition-colors flex-shrink-0',
    style: { background: on ? '#0B6E4F' : '#E2E8E4' },
    onClick: () => {
      on = !on;
      track.style.background = on ? '#0B6E4F' : '#E2E8E4';
      knob.style.transform = on ? 'translateX(20px)' : 'translateX(2px)';
      onChange(on);
    },
  }, knob);
  return el('div', { class: 'flex items-center gap-3 p-3 rounded-xl hover:bg-squad-paper' },
    el('div', { class: 'flex-1 min-w-0' },
      el('div', { class: 'text-[13.5px] font-bold text-ink-1' }, label),
      el('div', { class: 'text-[11.5px] text-ink-3' }, sub),
    ),
    track,
  );
}

function segPicker(options, initial, onChange) {
  let active = initial;
  const row = el('div', { class: 'grid gap-2', style: { gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` } });
  options.forEach(o => {
    const btn = el('button', {
      type: 'button',
      class: 'h-10 rounded-xl text-[12.5px] font-bold capitalize transition-all',
      'data-opt': o,
      onClick: () => { active = o; paint(); onChange(o); },
    }, o);
    row.appendChild(btn);
  });
  function paint() {
    row.querySelectorAll('[data-opt]').forEach(b => {
      const a = b.dataset.opt === active;
      b.style.background = a ? '#0B6E4F' : '#fff';
      b.style.color      = a ? '#fff'    : '#4A5C56';
      b.style.border     = a ? '1px solid #0B6E4F' : '1px solid #E2E8E4';
      b.style.boxShadow  = a ? '0 4px 12px rgba(11,110,79,0.18)' : 'none';
    });
  }
  paint();
  return row;
}

function selectInput(initial, options, onChange) {
  const sel = el('select', {
    class: 'input',
    onChange: e => onChange(e.target.value),
  });
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o; opt.textContent = o;
    if (o === initial) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}
