// Tela CONVERSA: mensageiro com o Guia. Cada ação passa pelo motor local.
import { esc, ICON, mascot, setMood, celebrate } from '../ui.js';
import { missionRow } from '../components.js';
import { ymd } from '../dates.js';

export function renderConversa(ctx) {
  const { store } = ctx;
  const msgs = store.state.messages;
  const last = [...msgs].reverse().find((m) => m.from === 'guia');
  const mood = last?.mood || 'happy';
  const p = store.state.profile;
  const status = p.llmEnabled ? 'Comandos locais + IA local (opcional)' : 'Comandos locais · funciona offline';
  return `<main class="screen chat-screen" aria-label="Conversa">
    <header class="chat-head">
      ${mascot(mood, '', 'chat-mascot')}
      <div style="flex:1"><h1>Guia</h1><div class="status">${esc(status)}</div></div>
      <button class="icon-btn" data-action="chat-options" aria-label="Opções da conversa">${ICON.menu}</button>
    </header>
    <div class="chat-log" id="chat-log" aria-live="polite">
      ${msgs.length ? msgs.map((m, i) => msgHTML(ctx, m, i === msgs.length - 1)).join('') : intro(ctx)}
    </div>
    <form class="composer" id="composer" autocomplete="off">
      <button type="button" class="icon-btn mic" data-action="voice" aria-label="Falar">${ICON.mic}</button>
      <label class="sr-only" for="chat-input">Mensagem para o Guia</label>
      <textarea id="chat-input" rows="1" placeholder="Fala com o Guia…" enterkeyhint="send"></textarea>
      <button type="submit" class="icon-btn send" aria-label="Enviar">${ICON.send}</button>
    </form>
  </main>`;
}

function intro(ctx) {
  const n = ctx.store.state.profile.name;
  return `<div class="msg guia">E aí${n ? `, ${esc(n)}` : ''}! Me pede as coisas do jeito que tu falaria. Tipo:</div>
  <div class="quick">${['O que eu tenho hoje?', 'Me lembra de estudar amanhã', 'Organiza minha semana', 'Ajuda'].map((q) => `<button data-action="quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
}

export function msgHTML(ctx, m, isLast) {
  const { store } = ctx;
  let html = `<div class="msg ${m.from === 'user' ? 'user' : 'guia'}">${esc(m.text)}${m.source === 'ia-local' ? '<span class="src">IA local (Ollama)</span>' : ''}</div>`;
  if (m.cards?.length) {
    for (const c of m.cards) {
      if (c.type !== 'items') continue;
      const items = c.ids.map((id) => store.getItem(id)).filter(Boolean).slice(0, 8);
      if (items.length) html += `<div class="msg-cards"><div class="card">${items.map((i) => missionRow(store, i, i.recurrence ? (c.date || ymd(store.now())) : undefined, { showDate: true })).join('')}</div></div>`;
    }
  }
  if (isLast && m.quick?.length) {
    html += `<div class="quick">${m.quick.map((q) => `<button data-action="quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  }
  return html;
}

/** Liga o formulário. Envia, mostra "digitando", aplica efeitos da resposta. */
export function bindConversa(ctx, root) {
  const form = root.querySelector('#composer');
  const input = root.querySelector('#chat-input');
  const log = root.querySelector('#chat-log');
  log.scrollTop = log.scrollHeight;
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(120, input.scrollHeight)}px`; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; input.style.height = 'auto'; sendMessage(ctx, t); });
  if (ctx.pendingSend) { const t = ctx.pendingSend; ctx.pendingSend = null; sendMessage(ctx, t); }
}

let busy = false;
export async function sendMessage(ctx, text) {
  if (busy) return;
  busy = true;
  const { store, brain } = ctx;
  store.addMessage('user', text);
  const log = document.querySelector('#chat-log');
  const redraw = () => {
    if (!log) return;
    const msgs = store.state.messages;
    log.innerHTML = msgs.map((m, i) => msgHTML(ctx, m, i === msgs.length - 1)).join('');
    log.scrollTop = log.scrollHeight;
  };
  redraw();
  const mEl = document.querySelector('#chat-mascot');
  setMood(mEl, 'thinking');
  log?.insertAdjacentHTML('beforeend', '<div class="msg guia" id="typing"><span class="typing"><i></i><i></i><i></i></span></div>');
  if (log) log.scrollTop = log.scrollHeight;
  let res;
  try {
    const started = Date.now();
    res = await brain.handle(text);
    const wait = 350 - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  } catch (e) {
    console.error(e);
    res = { text: 'Deu um erro aqui dentro e eu não fiz nada. Tenta de novo?', mood: 'worried', quick: [] };
  }
  document.querySelector('#typing')?.remove();
  store.addMessage('guia', res.text, { mood: res.mood, quick: res.quick, cards: res.cards, source: res.source });
  redraw();
  setMood(document.querySelector('#chat-mascot'), res.mood);
  busy = false;
  if (res.effects?.celebrate) {
    const r = document.querySelector('#chat-mascot')?.getBoundingClientRect();
    if (r) celebrate(r.left + r.width / 2, r.top + r.height / 2, null);
  }
  if (res.effects?.navigate) setTimeout(() => ctx.go(res.effects.navigate), 500);
  ctx.speak?.(res.text);
}
