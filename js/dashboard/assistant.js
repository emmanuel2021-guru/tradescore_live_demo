import { el, icon } from '../utils.js';
import { streamReply, chatRespond } from '../ai.js';
import { getUser, getScore } from '../store.js';
import { api } from '../api.js';

const DEFAULT_SUGGESTIONS = [
  'How can I improve my TradeScore?',
  'How much can I safely borrow?',
  'When should I restock?',
  'Forecast my revenue for next month',
  'What are my biggest risks right now?',
];

export function Assistant() {
  const TRADER = getUser();
  const liveScore = getScore();
  const root = el('div', { class: 'max-w-[960px] mx-auto h-[calc(100vh-120px)] flex flex-col' });

  // Conversation history that we pass to the backend each turn (stateless server).
  const history = [];

  // ── Header ────────────────────────────────────────────────
  const header = el('div', {
    class: 'card p-5 mb-4 flex items-center justify-between gap-3',
  });
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
  header.appendChild(el('button', {
    class: 'btn btn-ghost !py-2 !px-3 !text-[12px]',
    onClick: () => location.reload(),
  }, icon('arrow-clockwise'), 'New chat'));
  root.appendChild(header);

  // ── Chat scroll area ────────────────────────────────────
  const chat = el('div', { class: 'flex-1 overflow-y-auto pr-2' });
  root.appendChild(chat);

  // Initial greeting
  const greeting = chatBubble('ai', null);
  chat.appendChild(greeting);
  typeOut(greeting.querySelector('[data-content]'), buildGreeting(TRADER, liveScore));

  // Score-aware suggestions
  const suggestions = el('div', { class: 'flex flex-wrap gap-2 mt-3 mb-2' });
  buildSuggestions(liveScore).forEach(s => suggestions.appendChild(el('button', {
    class: 'chip px-3.5 py-2 cursor-pointer tap text-[12px] hover:bg-squad-pale',
    style: { background: '#fff', color: '#4A5C56', border: '1px solid #E2E8E4' },
    onClick: () => { input.value = s; submit(); },
  }, s)));
  chat.appendChild(suggestions);

  // ── Input bar ───────────────────────────────────────────
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
  async function submit(ev) {
    if (ev) ev.preventDefault();
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    suggestions.remove();

    // user bubble
    chat.appendChild(chatBubble('user', text));
    history.push({ role: 'user', content: text });
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    // typing indicator
    busy = true;
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

    // Real Claude on the backend — falls back to the local mock router on
    // network/auth failure so the chat never hard-stops in a demo.
    let reply;
    try {
      const resp = await api.chat({ message: text, history });
      // Backend returns { text, usage, model }. Older callers used .reply /
      // .message — kept as fallbacks in case the shape ever changes.
      reply = resp.text || resp.reply || resp.message || '';
      if (!reply) throw new Error('Empty reply');
    } catch (e) {
      console.warn('[assistant] api.chat failed, falling back to local:', e?.message);
      reply = await chatRespond(text, history);
    }
    history.push({ role: 'assistant', content: reply });

    typing.remove();
    const aiB = chatBubble('ai', null);
    chat.appendChild(aiB);
    await typeOut(aiB.querySelector('[data-content]'), reply);
    busy = false;
    chat.scrollTop = chat.scrollHeight;
  }
  inputBar.addEventListener('submit', submit);

  return root;
}

// ── Context line under the header ─────────────────────────────
function contextLine(trader, liveScore) {
  if (liveScore?.score != null) {
    const txN = liveScore.aggregates?.transactions ?? 0;
    return `Trained on ${txN} transaction${txN === 1 ? '' : 's'} · TradeScore ${liveScore.score}`;
  }
  return trader.business
    ? `Knows ${trader.business.toLowerCase()} inside out`
    : 'Ready to analyse your business';
}

function buildGreeting(trader, liveScore) {
  const first = trader.firstName || 'Hi';
  if (liveScore?.score != null) {
    const txN = liveScore.aggregates?.transactions ?? 0;
    const rev = liveScore.aggregates?.monthlyRevenue;
    const revLine = rev ? `, ₦${rev.toLocaleString('en-NG')} monthly` : '';
    return `Hello ${first}! I've reviewed your last ${txN} transaction${txN === 1 ? '' : 's'}${revLine}. Ask me anything about your score, loans, cashflow or risks.`;
  }
  return `Hello ${first}! I'm your TradeScore assistant. Once a few payments land in your virtual account I'll be able to ground my answers in your real data — but ask away anytime.`;
}

function buildSuggestions(liveScore) {
  if (liveScore?.score != null && liveScore.score < 700) {
    return [
      'How can I improve my TradeScore?',
      'What\'s holding my score back?',
      'How much can I safely borrow today?',
      'When should I restock?',
    ];
  }
  return DEFAULT_SUGGESTIONS;
}

// ── Chat bubble factory ─────────────────────────────────────
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
  const TRADER = getUser();
  const initial = TRADER.firstName?.[0]?.toUpperCase() || 'U';
  return el('div', {
    class: 'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[13px] font-bold',
    style: {
      background: isAi
        ? 'linear-gradient(135deg, #0B6E4F, #27AE60)'
        : 'linear-gradient(135deg, #1F8A65, #022B23)',
    },
  }, isAi ? icon('stars') : initial);
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

// Render markdown-ish bold/italic for AI responses.
function format(text) {
  return (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// Typewriter using the streaming generator.
async function typeOut(node, text) {
  node.classList.add('typing-caret');
  let raw = '';
  for await (const ch of streamReply(text, 12)) {
    raw += ch;
    node.innerHTML = format(raw);
    node.parentElement.parentElement?.scrollIntoView?.({ block: 'end' });
  }
  node.classList.remove('typing-caret');
}
