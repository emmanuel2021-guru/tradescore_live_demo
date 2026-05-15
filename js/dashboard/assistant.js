import { el, icon } from '../utils.js';
import { streamReply, chatRespond } from '../ai.js';
import { getUser, getScore } from '../store.js';
import { api } from '../api.js';

export function Assistant() {
  const TRADER = getUser();
  const liveScore = getScore();
  const root = el('div', { class: 'max-w-[960px] mx-auto h-[calc(100vh-120px)] flex flex-col' });

  // Conversation history that we pass to the backend each turn (stateless server).
  let history = [];

  // ── Header ────────────────────────────────────────────────
  const header = el('div', { class: 'card p-5 mb-4 flex items-center justify-between gap-3' });
  header.appendChild(el('div', { class: 'flex items-center gap-3' },
    el('div', {
      class: 'w-12 h-12 rounded-2xl flex items-center justify-center',
      style: { background: 'linear-gradient(135deg, #0B6E4F, #27AE60)', color: '#fff', fontSize: '20px' },
    }, icon('stars')),
    el('div', {},
      el('div', { class: 'flex items-center gap-2' },
        el('h2', { class: 'font-display text-[19px] font-extrabold text-squad-deep', style: { letterSpacing: '-0.02em' } }, 'TradeScore AI'),
        el('span', { class: 'chip', style: { background: '#E5F9F0', color: '#27AE60' } },
          el('span', { style: { fontSize: '7px' } }, '●'), 'Online'),
      ),
      el('div', { class: 'text-[12px] text-ink-3 -mt-0.5' },
        contextLine(TRADER, liveScore)),
    ),
  ));
  const newChatBtn = el('button', {
    class: 'btn btn-ghost !py-2 !px-3 !text-[12px]',
  }, icon('arrow-clockwise'), 'New chat');
  header.appendChild(newChatBtn);
  root.appendChild(header);

  // ── Chat scroll area ─────────────────────────────────────
  const chat = el('div', { class: 'flex-1 overflow-y-auto pr-2' });
  root.appendChild(chat);

  // Suggestions — score-aware
  const suggestions = el('div', { class: 'flex flex-wrap gap-2 mt-3 mb-2' });
  const sugItems = buildSuggestions(liveScore);
  sugItems.forEach(s => suggestions.appendChild(el('button', {
    class: 'chip px-3.5 py-2 cursor-pointer tap text-[12px] hover:bg-squad-pale',
    style: { background: '#fff', color: '#4A5C56', border: '1px solid #E2E8E4' },
    onClick: () => { input.value = s; submit(); },
  }, s)));

  renderGreeting();

  function renderGreeting() {
    const greeting = chatBubble('ai', null);
    chat.appendChild(greeting);
    const text = buildGreeting(TRADER, liveScore);
    typeOut(greeting.querySelector('[data-content]'), text);
    chat.appendChild(suggestions);
  }

  // ── Input bar ────────────────────────────────────────────
  const inputBar = el('form', {
    class: 'mt-4 p-2 rounded-2xl border border-line bg-white flex items-center gap-2',
    style: { boxShadow: '0 8px 22px rgba(2, 43, 35, 0.06)' },
  });
  const input = el('input', {
    class: 'flex-1 px-3 py-2.5 bg-transparent outline-none text-[14px]',
    placeholder: 'Ask about your score, loans, revenue, risks…',
  });
  inputBar.appendChild(input);
  const sendBtn = el('button', {
    class: 'btn btn-primary !py-2.5 !px-4 !text-[13px]',
    type: 'submit',
  }, 'Send', icon('send'));
  inputBar.appendChild(sendBtn);
  root.appendChild(inputBar);

  let busy = false;
  async function submit() {
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    if (suggestions.isConnected) suggestions.remove();

    chat.appendChild(chatBubble('user', text));
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    busy = true;
    sendBtn.disabled = true;
    const typing = el('div', { class: 'flex gap-3 mt-4 fade-in' },
      avatar('ai'),
      el('div', { class: 'chat-bubble chat-ai' },
        el('div', { class: 'flex items-center gap-1.5' },
          dotPulse(0), dotPulse(0.15), dotPulse(0.3),
        ),
      ),
    );
    chat.appendChild(typing);
    chat.scrollTop = chat.scrollHeight;

    let replyText;
    let fromFallback = false;
    let respMeta = null;
    try {
      const resp = await api.chat({ message: text, history });
      replyText = resp.text;
      respMeta = { model: resp.model, usage: resp.usage };
    } catch (e) {
      console.warn('[chat] backend unreachable, using fallback:', e.message);
      replyText = await chatRespond(text);
      fromFallback = true;
    }
    typing.remove();

    // Persist to history (only real assistant turns — fallback also OK to keep)
    history = [...history, { role: 'user', content: text }, { role: 'assistant', content: replyText }];

    const aiB = chatBubble('ai', null);
    chat.appendChild(aiB);
    await typeOut(aiB.querySelector('[data-content]'), replyText);

    if (fromFallback) {
      aiB.appendChild(el('div', {
        class: 'text-[10.5px] text-ink-3 mt-1 ml-12',
      }, 'offline · backend unreachable'));
    } else if (respMeta) {
      const u = respMeta.usage || {};
      const cached = u.cache_read_input_tokens || 0;
      const created = u.cache_creation_input_tokens || 0;
      const cacheNote = cached ? ` · ${cached} cached tokens reused`
                      : created ? ` · ${created} tokens cached for next turn`
                      : '';
      aiB.appendChild(el('div', {
        class: 'text-[10.5px] text-ink-3 mt-1 ml-12 flex items-center gap-1.5',
      },
        el('span', { style: { color: '#27AE60', fontSize: '7px' } }, '●'),
        `${respMeta.model} · ${u.input_tokens || 0} in / ${u.output_tokens || 0} out${cacheNote}`,
      ));
    }

    busy = false;
    sendBtn.disabled = false;
    chat.scrollTop = chat.scrollHeight;
  }
  inputBar.addEventListener('submit', e => { e.preventDefault(); submit(); });

  newChatBtn.addEventListener('click', () => {
    history = [];
    chat.innerHTML = '';
    renderGreeting();
  });

  return root;
}

// ── Greeting + suggestions ──────────────────────────────────────
function contextLine(trader, score) {
  if (score && score.aggregates) {
    const a = score.aggregates;
    const biz = trader.business?.toLowerCase() || 'your business';
    return `Score ${score.score}/850 · ${a.transactions || 0} tx · ${a.uniqueCustomers || 0} unique payers · knows ${biz} inside out`;
  }
  return `Knows ${(trader.business || 'your business').toLowerCase()} inside out`;
}

function buildGreeting(trader, score) {
  if (score && score.factors?.length) {
    const top  = [...score.factors].sort((a, b) => b.value - a.value)[0];
    const weak = [...score.factors].sort((a, b) => a.value - b.value)[0];
    const agg = score.aggregates || {};
    return `Hello ${trader.firstName}! Your TradeScore is **${score.score}/850**, built from ${agg.transactions || 0} transactions across ${agg.uniqueCustomers || 0} unique payers. Your strongest factor is **${top.label}** (${top.value}/100); the biggest lift is **${weak.label}** (${weak.value}/100). Ask me anything — I have your full transaction history in context.`;
  }
  return `Hello ${trader.firstName}! I'm your TradeScore assistant. Send a few payments through your virtual account first, then ask me about your score, your cashflow, or how much you could safely borrow.`;
}

function buildSuggestions(score) {
  const generic = [
    'How can I improve my TradeScore?',
    'How much could I safely borrow?',
    'When should I restock?',
    'What are my biggest risks right now?',
  ];
  if (!score?.factors?.length) return generic;
  const weak = [...score.factors].sort((a, b) => a.value - b.value)[0];
  return [
    `Why is my ${weak.label} only ${weak.value}/100?`,
    'How much could I safely borrow?',
    'What would move my score the fastest?',
    'Forecast my revenue for next month',
  ];
}

// ── Chat bubble factory ─────────────────────────────────────────
function chatBubble(role, text) {
  const wrap = el('div', { class: 'flex gap-3 mt-4 fade-up' });
  if (role === 'ai') wrap.appendChild(avatar('ai'));
  const bubble = el('div', { class: 'chat-bubble ' + (role === 'user' ? 'chat-user' : 'chat-ai ai-text') });
  bubble.appendChild(el('div', { 'data-content': '1' }, text || ''));
  wrap.appendChild(bubble);
  if (role === 'user') wrap.appendChild(avatar('user'));
  if (role === 'user') wrap.style.flexDirection = 'row-reverse';
  return wrap;
}

function avatar(kind) {
  const isAi = kind === 'ai';
  return el('div', {
    class: 'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[13px] font-bold',
    style: {
      background: isAi
        ? 'linear-gradient(135deg, #0B6E4F, #27AE60)'
        : 'linear-gradient(135deg, #1F8A65, #022B23)',
    },
  }, isAi ? icon('stars') : 'F');
}

function dotPulse(delay) {
  return el('span', {
    class: 'inline-block w-2 h-2 rounded-full',
    style: {
      background: '#0B6E4F',
      animation: `pulse 1.2s ${delay}s ease-in-out infinite`,
    },
  });
}

function format(text) {
  return (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

async function typeOut(node, text) {
  node.classList.add('typing-caret');
  let raw = '';
  for await (const ch of streamReply(text, 10)) {
    raw += ch;
    node.innerHTML = format(raw);
    node.parentElement.parentElement?.scrollIntoView?.({ block: 'end' });
  }
  node.classList.remove('typing-caret');
}
