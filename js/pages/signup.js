import { el, icon } from '../utils.js';
import { saveUser, clearUserScopedStorage } from '../store.js';
import { api, setCid } from '../api.js';

const STEPS = [
  { key: 'account',  title: 'Create your account',         sub: 'Just an email & a password to start.' },
  { key: 'business', title: 'Tell us about your shop',     sub: 'So we can tailor your TradeScore.' },
  { key: 'verify',   title: 'Verify your identity',        sub: 'Required by Squad to provision your virtual account. NDPR compliant.' },
  { key: 'done',     title: 'You’re in!',                  sub: 'Your virtual account is live and your AI is analysing.' },
];

// Step copy adapts to the chosen role — workers don't run a shop.
const STEP_COPY = {
  trader: {
    business: { title: 'Tell us about your shop',     sub: 'So we can tailor your TradeScore.' },
  },
  worker: {
    business: { title: 'Tell us about your work',     sub: 'So traders nearby can match with you.' },
  },
};

export function Signup({ navigate }) {
  let step = 0;
  const data = {
    role: 'trader',
    first_name: '', last_name: '', middle_name: '',
    email: '', password: '',
    business_name: '', category: 'Fashion', location: '', mobile_num: '',
    dob: '', bvn: '', gender: '1', address: '',
  };
  // Filled after a successful signup call.
  let provisioned = null;
  let provisionError = null;

  const root = el('div', { class: 'min-h-screen flex' });

  // ── Left brand pane ─────────────────────────────────────
  const brand = el('aside', {
    class: 'hidden lg:flex flex-col justify-between p-12 w-[42%] relative overflow-hidden',
    style: {
      background:
        'radial-gradient(900px 500px at -10% -10%, #0B6E4F 0%, transparent 60%),' +
        'radial-gradient(700px 400px at 110% 110%, #1F8A65 0%, transparent 60%),' +
        'linear-gradient(155deg, #022B23 0%, #043b30 100%)',
      color: '#fff',
    },
  });
  brand.appendChild(el('a', {
    class: 'flex items-center gap-3 cursor-pointer',
    onClick: () => navigate('#/'),
  },
    el('div', {
      class: 'w-11 h-11 rounded-xl flex items-center justify-center',
      style: { background: 'rgba(232,255,139,0.16)', border: '1px solid rgba(232,255,139,0.28)', color: '#E8FF8B', fontSize: '19px' },
    }, icon('shop')),
    el('div', {},
      el('div', { class: 'font-display text-[20px] font-extrabold' }, 'TradeScore'),
      el('div', { class: 'text-[11px]', style: { color: 'rgba(232,255,139,0.85)' } }, 'by Squad'),
    ),
  ));

  brand.appendChild(el('div', {},
    el('h2', { class: 'font-display text-[40px] font-extrabold leading-tight' },
      'Build credit', el('br'), 'while you trade.'),
    el('p', { class: 'mt-5 text-white/70 text-[15px] leading-relaxed max-w-[420px]' },
      'Setup takes 2 minutes. We provision a real Squad virtual account in your name — every payment your customers send becomes credit history.'),
    el('div', { class: 'mt-8 space-y-3' }, ...[
      'Real GTBank-backed virtual account',
      'BVN-verified, NDPR-compliant',
      'Cancel and disconnect anytime',
    ].map(t => el('div', { class: 'flex items-center gap-3 text-[14px]' },
      el('span', {
        class: 'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
        style: { background: 'rgba(232,255,139,0.20)', color: '#E8FF8B' },
      }, icon('check-lg')),
      t,
    ))),
  ));

  brand.appendChild(el('div', { class: 'text-[11.5px] text-white/45' },
    'Powered by Squad API · GTCO regulated · NDPR compliant'));
  root.appendChild(brand);

  // ── Right form pane ────────────────────────────────────
  const right = el('section', {
    class: 'flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-squad-paper overflow-y-auto',
  });

  const topbar = el('div', { class: 'w-full max-w-[480px] flex items-center justify-between mb-8' });
  topbar.appendChild(el('a', {
    class: 'lg:hidden flex items-center gap-2 cursor-pointer',
    onClick: () => navigate('#/'),
  },
    el('div', { class: 'w-9 h-9 rounded-lg bg-squad-deep flex items-center justify-center text-squad-lime', style: { fontSize: '15px' } }, icon('shop')),
    el('span', { class: 'font-display font-extrabold text-squad-deep' }, 'TradeScore'),
  ));
  topbar.appendChild(el('span', { class: 'text-[13px] text-ink-2 ml-auto' },
    'Have an account? ',
    el('a', {
      class: 'text-squad-green font-bold hover:underline cursor-pointer',
      onClick: () => navigate('#/login'),
    }, 'Log in'),
  ));
  right.appendChild(topbar);

  const card = el('div', { class: 'w-full max-w-[480px]' });
  right.appendChild(card);

  const progress = el('div', { class: 'flex gap-1.5 mb-8' });
  STEPS.forEach((_, i) => progress.appendChild(el('div', {
    class: 'h-1 flex-1 rounded-full transition-colors',
    'data-step-bar': i,
    style: { background: i === 0 ? '#0B6E4F' : '#E2E8E4' },
  })));
  card.appendChild(progress);

  const header = el('div', { class: 'mb-7' });
  const title = el('h1', { class: 'font-display text-[28px] font-extrabold text-squad-deep' });
  const sub = el('p', { class: 'text-[14px] text-ink-2 mt-1' });
  header.appendChild(title);
  header.appendChild(sub);
  card.appendChild(header);

  const body = el('div', { class: 'fade-up' });
  card.appendChild(body);

  function paintProgress() {
    progress.querySelectorAll('[data-step-bar]').forEach((bar, i) => {
      bar.style.background = i <= step ? '#0B6E4F' : '#E2E8E4';
    });
    const stepKey = STEPS[step].key;
    const override = STEP_COPY[data.role]?.[stepKey];
    title.textContent = override?.title ?? STEPS[step].title;
    sub.textContent   = override?.sub   ?? STEPS[step].sub;
  }

  function render() {
    body.innerHTML = '';
    body.classList.remove('fade-up');
    void body.offsetWidth;
    body.classList.add('fade-up');
    paintProgress();
    if (step === 0)      body.appendChild(stepAccount());
    else if (step === 1) body.appendChild(stepBusiness());
    else if (step === 2) body.appendChild(stepVerify());
    else                 body.appendChild(stepDone());
  }

  function next() {
    if (step < STEPS.length - 1) { step++; render(); }
    else navigate('#/app/overview');
  }
  function back() { if (step > 0) { step--; render(); } }

  // ── Step 1: Account ─────────────────────────────────────
  function stepAccount() {
    const wrap = el('div', { class: 'space-y-4' });

    // Role toggle — first thing the user picks. Drives copy + form fields later.
    const roleWrap = el('div');
    roleWrap.appendChild(el('label', { class: 'label' }, 'I want to…'));
    const roleRow = el('div', { class: 'grid grid-cols-2 gap-2' });
    [
      { v: 'trader', label: 'Sell as a trader',   sub: 'Run a shop, sell goods, build credit from customer payments.' },
      { v: 'worker', label: 'Work as a job seeker', sub: 'Get hired for gigs, earn through Squad, build your TradeScore.' },
    ].forEach(opt => {
      const btn = el('button', {
        class: 'p-3.5 rounded-xl text-left tap transition-all',
        'data-role': opt.v,
      },
        el('div', { class: 'font-bold text-[13.5px]' }, opt.label),
        el('div', { class: 'text-[11.5px] mt-0.5 leading-snug', style: { opacity: '0.78' } }, opt.sub),
      );
      btn.addEventListener('click', () => { data.role = opt.v; paintRole(); });
      roleRow.appendChild(btn);
    });
    function paintRole() {
      roleRow.querySelectorAll('[data-role]').forEach(b => {
        const a = b.dataset.role === data.role;
        b.style.background = a ? '#0B6E4F' : '#fff';
        b.style.color      = a ? '#fff'    : '#4A5C56';
        b.style.border     = a ? '1px solid #0B6E4F' : '1px solid #E2E8E4';
        b.style.boxShadow  = a ? '0 4px 14px rgba(11,110,79,0.22)' : 'none';
      });
    }
    paintRole();
    roleWrap.appendChild(roleRow);
    wrap.appendChild(roleWrap);

    const row = el('div', { class: 'grid grid-cols-2 gap-3' });
    const firstField = field('First name', 'first_name', 'Funmi');
    const lastField  = field('Last name',  'last_name',  'Adeyemi');
    firstField.input.value = data.first_name;
    lastField.input.value  = data.last_name;
    row.appendChild(firstField.field);
    row.appendChild(lastField.field);
    wrap.appendChild(row);

    const middleField = field('Middle name (optional)', 'middle_name', 'Olamide');
    middleField.input.value = data.middle_name;
    wrap.appendChild(middleField.field);

    const emailField = field('Email address', 'email', 'you@business.ng', 'email');
    const passField  = field('Create password', 'password', 'At least 8 characters', 'password');
    emailField.input.value = data.email;
    passField.input.value  = data.password;
    wrap.appendChild(emailField.field);
    wrap.appendChild(passField.field);

    const cta = el('button', {
      class: 'btn btn-primary w-full mt-6 py-[15px]',
      onClick: () => {
        if (!firstField.input.value.trim()) return showErr(firstField, 'Required.');
        if (!lastField.input.value.trim())  return showErr(lastField, 'Required.');
        if (!emailField.input.value || emailField.input.value.length < 4)
          return showErr(emailField, 'Enter a valid email.');
        if (!passField.input.value || passField.input.value.length < 6)
          return showErr(passField, 'Use at least 6 characters.');
        data.first_name  = firstField.input.value.trim();
        data.last_name   = lastField.input.value.trim();
        data.middle_name = middleField.input.value.trim();
        data.email       = emailField.input.value.trim();
        data.password    = passField.input.value;
        next();
      },
    }, 'Continue', icon('arrow-right'));
    wrap.appendChild(cta);
    return wrap;
  }

  // ── Step 2: Business (trader) / Work (worker) ──────────
  function stepBusiness() {
    const isWorker = data.role === 'worker';
    const wrap = el('div', { class: 'space-y-4' });

    // Trader: "Business name" + category grid.
    // Worker: "What kind of work?" — short free-text + skill chips reused
    //         as the business_name field so we don't change the schema.
    const nameField = field(
      isWorker ? 'What kind of work can you do?' : 'Business name',
      'business_name',
      isWorker ? 'e.g. Delivery, shop help, market runs' : "e.g. Funmi's Fashion Fabrics",
    );
    nameField.input.value = data.business_name;
    wrap.appendChild(nameField.field);

    if (isWorker) {
      // Skill chips — clicking appends to the work-description field.
      const chips = el('div', { class: 'flex flex-wrap gap-1.5' },
        ...['Delivery', 'Load-bearing', 'Shop help', 'Market runs', 'Cashier', 'Errands', 'Bookkeeping', 'Driver']
          .map(s => el('button', {
            class: 'chip cursor-pointer',
            style: { background: '#F5F9F6', color: '#0B6E4F', fontSize: '11px', padding: '4px 9px' },
            onClick: () => {
              const cur = nameField.input.value.trim();
              nameField.input.value = cur ? `${cur}, ${s}` : s;
            },
          }, '+ ' + s)),
      );
      wrap.appendChild(chips);
    } else {
      const catWrap = el('div');
      catWrap.appendChild(el('label', { class: 'label' }, 'Category'));
      const cats = ['Fashion', 'Food & Drinks', 'Electronics', 'Beauty', 'Groceries', 'Other'];
      const grid = el('div', { class: 'grid grid-cols-3 gap-2' });
      cats.forEach(c => {
        const btn = el('button', {
          class: 'py-3 px-3 rounded-xl text-[13px] font-bold tap text-center transition-all',
          'data-cat': c,
        }, c);
        btn.addEventListener('click', () => {
          data.category = c;
          grid.querySelectorAll('[data-cat]').forEach(b => paintCat(b));
        });
        function paintCat(b) {
          const a = b.dataset.cat === data.category;
          b.style.background = a ? '#0B6E4F' : '#fff';
          b.style.color      = a ? '#fff' : '#4A5C56';
          b.style.border     = a ? '1px solid #0B6E4F' : '1px solid #E2E8E4';
          b.style.boxShadow  = a ? '0 4px 14px rgba(11,110,79,0.25)' : 'none';
        }
        paintCat(btn);
        grid.appendChild(btn);
      });
      catWrap.appendChild(grid);
      wrap.appendChild(catWrap);
    }

    const locField = field(
      isWorker ? 'Where are you based?' : 'Shop location',
      'location',
      'e.g. Yaba, Lagos',
    );
    locField.input.value = data.location;
    wrap.appendChild(locField.field);

    const phoneField = field('Mobile number', 'mobile_num', '08012345678');
    phoneField.input.value = data.mobile_num;
    phoneField.input.setAttribute('inputmode', 'numeric');
    phoneField.input.setAttribute('maxlength', '11');
    wrap.appendChild(phoneField.field);

    const row = el('div', { class: 'flex gap-3 mt-6' });
    row.appendChild(el('button', { class: 'btn btn-ghost flex-1 py-[15px]', onClick: back }, icon('arrow-left'), 'Back'));
    row.appendChild(el('button', {
      class: 'btn btn-primary flex-[2] py-[15px]',
      onClick: () => {
        if (!nameField.input.value.trim()) return showErr(nameField, 'Required.');
        const phone = phoneField.input.value.trim();
        if (!/^\d{11}$/.test(phone))       return showErr(phoneField, 'Enter an 11-digit phone number.');
        data.business_name = nameField.input.value.trim();
        data.location      = locField.input.value.trim();
        data.mobile_num    = phone;
        next();
      },
    }, 'Continue', icon('arrow-right')));
    wrap.appendChild(row);
    return wrap;
  }

  // ── Step 3: Verify + Provision ─────────────────────────
  function stepVerify() {
    const wrap = el('div', { class: 'space-y-4' });

    // Sandbox notice
    wrap.appendChild(el('div', {
      class: 'rounded-xl p-3.5 text-[12px] leading-relaxed',
      style: { background: '#FFF8DA', color: '#7B5500', border: '1px solid #F0DA9A' },
    },
      el('div', { class: 'flex items-center gap-2 mb-1 font-bold' }, icon('shield-check'), 'Sandbox mode'),
      'Squad strictly validates BVN against your name, DOB and phone. Use a test BVN from your Squad sandbox dashboard.',
    ));

    const bvnField = field('BVN', 'bvn', '22XXXXXXXXX');
    bvnField.input.value = data.bvn;
    bvnField.input.setAttribute('inputmode', 'numeric');
    bvnField.input.setAttribute('maxlength', '11');
    wrap.appendChild(bvnField.field);

    const dobField = field('Date of birth', 'dob', '', 'date');
    if (data.dob) dobField.input.value = isoFromMdy(data.dob);
    wrap.appendChild(dobField.field);

    // Gender
    const genderWrap = el('div');
    genderWrap.appendChild(el('label', { class: 'label' }, 'Gender'));
    const gRow = el('div', { class: 'grid grid-cols-2 gap-2' });
    [['1', 'Male'], ['2', 'Female']].forEach(([v, label]) => {
      const btn = el('button', {
        class: 'py-3 px-3 rounded-xl text-[13px] font-bold tap text-center transition-all',
        'data-g': v,
      }, label);
      btn.addEventListener('click', () => { data.gender = v; paint(); });
      gRow.appendChild(btn);
    });
    function paint() {
      gRow.querySelectorAll('[data-g]').forEach(b => {
        const a = b.dataset.g === data.gender;
        b.style.background = a ? '#0B6E4F' : '#fff';
        b.style.color      = a ? '#fff'    : '#4A5C56';
        b.style.border     = a ? '1px solid #0B6E4F' : '1px solid #E2E8E4';
      });
    }
    paint();
    genderWrap.appendChild(gRow);
    wrap.appendChild(genderWrap);

    const addrField = field('Residential address', 'address', '12 Marina Road, Lagos Island');
    addrField.input.value = data.address;
    wrap.appendChild(addrField.field);

    // Live error banner for Squad failures
    const errBox = el('div', {
      class: 'rounded-xl p-3.5 text-[12.5px] leading-relaxed',
      style: { background: '#FCE8E8', color: '#9A1F1F', border: '1px solid #F0BFBF', display: 'none' },
    });
    wrap.appendChild(errBox);

    const submitBtn = el('button', {
      class: 'btn btn-primary w-full py-[15px]',
    }, icon('lightning-charge-fill'), 'Create virtual account');

    let submitting = false;
    submitBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      console.log('[signup] submit clicked');
      if (submitting) return;
      errBox.style.display = 'none';

      const bvn = bvnField.input.value.trim();
      if (!/^\d{11}$/.test(bvn))        return showErr(bvnField, 'BVN must be 11 digits.');
      if (!dobField.input.value)        return showErr(dobField, 'Required.');
      if (!addrField.input.value.trim()) return showErr(addrField, 'Required.');

      data.bvn     = bvn;
      data.dob     = mdyFromIso(dobField.input.value); // Squad wants mm/dd/yyyy
      data.address = addrField.input.value.trim();

      submitting = true;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
      submitBtn.appendChild(el('span', {}, 'Provisioning with Squad…'));

      try {
        console.log('[signup] calling /api/signup');
        const resp = await api.signup({
          role: data.role,
          first_name: data.first_name, last_name: data.last_name, middle_name: data.middle_name,
          email: data.email, password: data.password,
          business_name: data.business_name, category: data.category, location: data.location,
          mobile_num: data.mobile_num, dob: data.dob, bvn: data.bvn,
          gender: data.gender, address: data.address,
        });

        // Fresh account on this browser — wipe any cached data from a prior
        // user so we don't inherit their txs / sales / score / inventory.
        clearUserScopedStorage();

        // Persist session + user
        setCid(resp.user.customer_identifier);
        saveUser({
          customer_identifier: resp.user.customer_identifier,
          role: resp.user.role || data.role,
          name: `${resp.user.first_name} ${resp.user.last_name}`,
          firstName: resp.user.first_name,
          email: resp.user.email,
          business: resp.user.business_name
            || (data.role === 'worker' ? 'Job seeker' : `${resp.user.first_name}’s Shop`),
          category: resp.user.category,
          location: resp.user.location,
          squadWallet: resp.user.virtual_account_number || null,
          virtualAccountBank: resp.user.virtual_account_bank || null,
          since: new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' }),
        });

        console.log('[signup] response', resp);
        provisioned = resp.user;
        provisionError = resp.squad_error || null;
        provisioned.__demo = !!resp.demo_fallback;
        next();
      } catch (e) {
        console.error('[signup] error', e, e.data);
        submitting = false;
        submitBtn.innerHTML = '';
        submitBtn.appendChild(icon('lightning-charge-fill'));
        submitBtn.appendChild(el('span', {}, 'Try again'));
        errBox.style.display = 'block';
        errBox.textContent = e.network
          ? 'Cannot reach the TradeScore backend. Start it with `npm run dev` in the /server folder.'
          : (e.data?.error || e.message || 'Something went wrong.');
        errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    wrap.appendChild(submitBtn);

    wrap.appendChild(el('button', {
      class: 'btn btn-ghost w-full mt-1 py-[14px]', onClick: back,
    }, icon('arrow-left'), 'Back'));
    return wrap;
  }

  // ── Step 4: Done ────────────────────────────────────────
  function stepDone() {
    const wrap = el('div', { class: 'text-center pop' });
    wrap.appendChild(el('div', {
      class: 'w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center',
      style: {
        background: 'linear-gradient(135deg, #E8FF8B, #27AE60)',
        boxShadow: '0 8px 28px rgba(39,174,96,0.35)',
      },
    }, el('span', { class: 'text-white', style: { fontSize: '38px' } }, icon('check-lg'))));

    if (provisioned?.virtual_account_number) {
      wrap.appendChild(el('p', { class: 'text-ink-2 text-[14.5px] leading-relaxed mt-2' },
        provisioned.__demo
          ? 'Squad sandbox is rate-limited on this merchant, so we issued a demo virtual account for now. The moment Squad lifts the cap, fresh signups will get real numbers.'
          : 'We provisioned a real Squad virtual account in your name. Share this number with your customers — every payment that lands here becomes credit history.'));

      // Big VA number card
      wrap.appendChild(el('div', {
        class: 'mt-6 p-5 rounded-2xl text-left',
        style: { background: 'linear-gradient(135deg, #022B23, #0B6E4F)' },
      },
        el('div', { class: 'text-[10.5px] font-bold uppercase tracking-[0.2em]', style: { color: '#E8FF8B' } },
          'Your virtual account'),
        el('div', {
          class: 'font-display text-white font-extrabold mt-1 select-all',
          style: { fontSize: '34px', letterSpacing: '0.04em' },
        }, provisioned.virtual_account_number),
        el('div', { class: 'text-[12px] mt-1 flex items-center gap-2 flex-wrap', style: { color: 'rgba(255,255,255,0.7)' } },
          el('span', {}, (provisioned.virtual_account_bank || 'GTBank') + ' · ' + provisioned.first_name + ' ' + provisioned.last_name),
          provisioned.__demo ? el('span', {
            class: 'chip',
            style: { background: 'rgba(232,255,139,0.15)', color: '#E8FF8B', border: '1px solid rgba(232,255,139,0.30)' },
          }, 'Sandbox demo') : null,
        ),
      ));
    } else {
      // Squad failed but local user was created
      wrap.appendChild(el('p', { class: 'text-ink-2 text-[14.5px] leading-relaxed mt-2' },
        'Your account was created. Squad couldn’t provision a virtual account right now — we’ll retry in the background. You can still use the dashboard.'));
      if (provisionError) {
        wrap.appendChild(el('div', {
          class: 'mt-4 p-3 rounded-xl text-[12px] text-left',
          style: { background: '#FCE8E8', color: '#9A1F1F' },
        },
          el('div', { class: 'font-bold mb-1' }, 'Squad response'),
          provisionError.message || 'Unknown error',
        ));
      }
    }

    const cta = el('button', {
      class: 'btn btn-primary w-full mt-6 py-[15px]',
      onClick: () => navigate('#/app/overview'),
    }, 'Open my dashboard', icon('arrow-right'));
    wrap.appendChild(cta);
    return wrap;
  }

  // ── Helpers ─────────────────────────────────────────────
  function field(label, _key, placeholder, type = 'text') {
    const wrap = el('div');
    wrap.appendChild(el('label', { class: 'label' }, label));
    const input = el('input', { class: 'input', placeholder, type });
    wrap.appendChild(input);
    const error = el('div', {
      class: 'text-[12px] mt-1.5',
      style: { color: '#D43E3E', display: 'none' },
    });
    wrap.appendChild(error);
    return { field: wrap, input, error };
  }
  function showErr(f, msg) {
    f.error.textContent = msg;
    f.error.style.display = 'block';
  }
  // Squad B2C endpoint wants mm/dd/yyyy (their error message is the source of truth,
  // not the example payload). HTML date input is yyyy-mm-dd.
  function mdyFromIso(iso) {
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  }
  function isoFromMdy(mdy) {
    const [m, d, y] = mdy.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  render();
  root.appendChild(right);
  return root;
}
