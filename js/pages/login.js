import { el, icon } from '../utils.js';
import { api, setCid, getCid } from '../api.js';
import { saveUser, refreshTxsFromServer, refreshScoreFromServer, clearUserScopedStorage } from '../store.js';

export function Login({ navigate }) {
  const root = el('div', { class: 'min-h-screen flex' });

  // Left brand
  root.appendChild(el('aside', {
    class: 'hidden lg:flex flex-col justify-between p-12 w-[42%] relative overflow-hidden',
    style: {
      background:
        'radial-gradient(900px 500px at -10% -10%, #0B6E4F 0%, transparent 60%),' +
        'radial-gradient(700px 400px at 110% 110%, #1F8A65 0%, transparent 60%),' +
        'linear-gradient(155deg, #022B23 0%, #043b30 100%)',
      color: '#fff',
    },
  },
    el('a', {
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
    ),
    el('div', {},
      el('h2', { class: 'font-display text-[36px] font-extrabold leading-tight' },
        'Welcome back.', el('br'), 'Your AI is up to speed.'),
      el('p', { class: 'mt-4 text-white/70 text-[14.5px] leading-relaxed max-w-[420px]' },
        'Sign in and we’ll resume tracking your inflows, recompute your TradeScore, and surface any new loan offers.'),
    ),
    el('div', { class: 'text-[11.5px] text-white/45' },
      'Powered by Squad API · GTCO regulated · NDPR compliant'),
  ));

  // Right form
  const right = el('section', {
    class: 'flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-squad-paper',
  });

  const top = el('div', { class: 'w-full max-w-[420px] flex items-center justify-between mb-10' });
  top.appendChild(el('a', {
    class: 'lg:hidden flex items-center gap-2 cursor-pointer',
    onClick: () => navigate('#/'),
  },
    el('div', { class: 'w-9 h-9 rounded-lg bg-squad-deep flex items-center justify-center text-squad-lime', style: { fontSize: '15px' } }, icon('shop')),
    el('span', { class: 'font-display font-extrabold text-squad-deep' }, 'TradeScore'),
  ));
  top.appendChild(el('span', { class: 'text-[13px] text-ink-2 ml-auto' },
    'New here? ',
    el('a', {
      class: 'text-squad-green font-bold hover:underline cursor-pointer',
      onClick: () => navigate('#/signup'),
    }, 'Create account'),
  ));
  right.appendChild(top);

  const card = el('div', { class: 'w-full max-w-[420px] fade-up' });
  card.appendChild(el('h1', { class: 'font-display text-[30px] font-extrabold text-squad-deep' },
    'Log in to TradeScore'));
  card.appendChild(el('p', { class: 'text-[14px] text-ink-2 mt-1.5 mb-8' },
    'Pick up where you left off.'));

  const form = el('form', { class: 'space-y-4' });

  const emailWrap = el('div');
  emailWrap.appendChild(el('label', { class: 'label' }, 'Email'));
  const emailInput = el('input', { class: 'input', type: 'email', placeholder: 'you@business.ng', autocomplete: 'email' });
  emailWrap.appendChild(emailInput);
  form.appendChild(emailWrap);

  const passWrap = el('div');
  passWrap.appendChild(el('div', { class: 'flex items-center justify-between' },
    el('label', { class: 'label !mb-2' }, 'Password'),
    el('a', {
      class: 'text-[12px] text-squad-green font-bold hover:underline cursor-pointer mb-2',
      onClick: () => alert('To reset your password during development, run:\n\n  node server/reset-password.js <email> <new-password>'),
    }, 'Forgot?'),
  ));
  const passInput = el('input', { class: 'input', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });
  passWrap.appendChild(passInput);
  form.appendChild(passWrap);

  // Inline error banner (hidden by default)
  const errBox = el('div', {
    class: 'rounded-xl p-3 text-[12.5px]',
    style: { background: '#FCE8E8', color: '#9A1F1F', display: 'none' },
  });
  form.appendChild(errBox);

  const cta = el('button', {
    class: 'btn btn-primary w-full mt-2 py-[15px]',
    type: 'submit',
  }, 'Log in', icon('arrow-right'));
  form.appendChild(cta);

  let busy = false;
  async function submit(ev) {
    if (ev) ev.preventDefault();
    if (busy) return;
    errBox.style.display = 'none';

    const email = emailInput.value.trim();
    const password = passInput.value;
    if (!email || !password) {
      errBox.textContent = 'Email and password are required.';
      errBox.style.display = 'block';
      return;
    }

    busy = true;
    cta.disabled = true;
    cta.innerHTML = '';
    cta.appendChild(el('span', { class: 'spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' }));
    cta.appendChild(el('span', {}, 'Signing you in…'));

    try {
      const resp = await api.login({ email, password });
      const user = resp.user;

      // Switching identities on this browser? Wipe the previous user's cache
      // so we don't render their txs / sales / score before the server refresh lands.
      if (getCid() && getCid() !== user.customer_identifier) {
        clearUserScopedStorage();
      }

      // Persist session + user shape the dashboard expects
      setCid(user.customer_identifier);
      saveUser({
        customer_identifier: user.customer_identifier,
        role: user.role || 'trader',
        name: `${user.first_name} ${user.last_name}`,
        firstName: user.first_name,
        email: user.email,
        business: user.business_name
          || (user.role === 'worker' ? 'Job seeker' : `${user.first_name}’s Shop`),
        category: user.category,
        location: user.location,
        squadWallet: user.virtual_account_number || null,
        virtualAccountBank: user.virtual_account_bank || null,
      });

      // Warm up the live data caches before bouncing to the dashboard.
      // We don't block on these — the dashboard already listens to update events.
      refreshTxsFromServer();
      refreshScoreFromServer();

      navigate('#/app/overview');
    } catch (e) {
      busy = false;
      cta.disabled = false;
      cta.innerHTML = '';
      cta.appendChild(el('span', {}, 'Log in'));
      cta.appendChild(icon('arrow-right'));
      errBox.style.display = 'block';
      errBox.textContent = e.network
        ? 'Cannot reach the TradeScore backend. Make sure `npm run dev` is running.'
        : (e.data?.error || e.message || 'Login failed.');
    }
  }
  form.addEventListener('submit', submit);

  card.appendChild(form);
  right.appendChild(card);
  root.appendChild(right);
  return root;
}
