// GUIA — inicialização, navegação e ações.
import { createStore } from './store.js';
import { createBrain } from './brain.js';
import { ymd, addDays } from './dates.js';
import { stepsFor } from './planner.js';
import { esc, ICON, mascot, setMascotLook, setMood, poke, toast, celebrate, confirmSheet, openSheet, closeSheet } from './ui.js';
import { renderHoje } from './screens/hoje.js';
import { renderConversa, bindConversa, sendMessage } from './screens/conversa.js';
import { renderAgenda, agendaState, shiftAgenda } from './screens/agenda.js';
import { renderJornada, jornadaState, animateWalker } from './screens/jornada.js';
import { renderFoco, renderMeSalva, renderMenu, renderAjustes, renderSobre, renderConquistas, renderMascote, renderOnboarding, focus, onb, mascotPreview } from './screens/pages.js';
import { itemSheet, goalSheet, stepSheet, addStepSheet, summarySheet, achievementSheet, installSheet, UNLOCK_LABEL } from './sheets.js';
import { buildICS, deliverFile } from './ics.js';
import { requestPermission, showLocal, startReminderLoop, notifSupport } from './notify.js';
import { ollamaStatus } from './llm.js';

const root = document.getElementById('app');
let store;
try {
  store = createStore();
} catch (e) {
  root.innerHTML = `<main class="screen"><div class="card"><h2>Algo deu errado</h2><p>Não consegui abrir os dados deste aparelho (${esc(e.message)}). Seus dados não foram apagados. Tenta recarregar.</p><button class="btn" onclick="location.reload()">Recarregar</button></div></main>`;
  throw e;
}
const brain = createBrain(store);

const TABS = [['hoje', 'Hoje'], ['conversa', 'Conversa'], ['agenda', 'Agenda'], ['jornada', 'Jornada']];
const SCREENS = {
  hoje: renderHoje, conversa: renderConversa, agenda: renderAgenda, jornada: renderJornada,
  foco: renderFoco, mesalva: renderMeSalva, menu: renderMenu, ajustes: renderAjustes, sobre: renderSobre,
  conquistas: renderConquistas, mascote: renderMascote,
};

const ctx = {
  store, brain, awayDays: 0, focusId: null, pendingSend: null,
  go(route) { if (location.hash !== `#/${route}`) location.hash = `#/${route}`; else render(); },
  render: () => render(),
  selectGoal(id) { jornadaState.goalId = id; },
  toggleStep: (g, s) => toggleStep(g, s),
  speak(text) {
    if (!store.state.profile.speak || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(text.replace(/[•✓○⚑🏅]/g, '')); u.lang = 'pt-BR'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* sem voz */ }
  },
};

function route() { return (location.hash.replace(/^#\/?/, '') || 'hoje').split('?')[0]; }

// ---------------- Renderização ----------------
let lastRoute = null;
function render() {
  setMascotLook(store.state.mascot);
  if (!store.state.profile.onboarded) {
    root.innerHTML = renderOnboarding();
    return;
  }
  const r = SCREENS[route()] ? route() : 'hoje';
  const scroll = r === lastRoute ? window.scrollY : 0;
  let html;
  try {
    html = SCREENS[r](ctx);
  } catch (e) {
    console.error(e);
    html = `<main class="screen"><div class="card"><h2>Ops</h2>${mascot('confused')}<p>Essa tela deu erro (${esc(e.message)}). Teus dados estão salvos.</p><button class="btn" data-action="go" data-to="hoje">Voltar pro Hoje</button></div></main>`;
  }
  const showTabs = !['foco'].includes(r);
  const showFab = showTabs && !['hoje', 'conversa'].includes(r);
  root.innerHTML = html
    + (showFab ? `<button class="fab" data-action="go" data-to="conversa" aria-label="Falar com o Guia">${mascot('happy')}</button>` : '')
    + (showTabs ? `<nav class="tabbar" aria-label="Navegação">${TABS.map(([k, l]) => `<button class="tab ${r === k || (k === 'hoje' && ['menu', 'ajustes', 'conquistas', 'mascote', 'sobre', 'mesalva'].includes(r)) ? 'active' : ''}" data-action="go" data-to="${k}" aria-current="${r === k ? 'page' : 'false'}"><span class="tab-ic">${ICON[k]}</span>${l}</button>`).join('')}</nav>` : '');
  if (r === 'conversa') bindConversa(ctx, root);
  if (r === 'jornada') animateWalker(root);
  if (r === 'foco') tickFocus();
  if (!navigator.onLine) root.insertAdjacentHTML('beforeend', '<div class="offline-pill">offline · dados locais</div>');
  window.scrollTo(0, scroll);
  lastRoute = r;
}

window.addEventListener('hashchange', () => { closeSheet(); render(); });
window.addEventListener('online', render);
window.addEventListener('offline', render);

// ---------------- Conclusão com recompensa ----------------
function rewardFeedback(res, anchor) {
  if (!res.ok) { toast('Não consegui salvar. Nada mudou.', 'worried'); return; }
  if (!res.done) { render(); return; }
  const r = anchor?.getBoundingClientRect();
  celebrate(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2, res.xp);
  const row = anchor?.closest('.mission');
  row?.classList.add('done', 'pop');
  setMood(document.querySelector('#hero-mascot'), 'celebrating');
  for (const a of res.achievements || []) setTimeout(() => toast(`Conquista: ${a.title}!${a.unlock ? ` Liberou ${UNLOCK_LABEL[a.unlock]}.` : ''}`, 'celebrating', 4000), 700);
  if (res.stepDone) setTimeout(() => toast(`Etapa concluída em "${res.stepDone.goal.title}". O Guia andou no mapa!`, 'proud', 3200), 300);
  setTimeout(render, 650);
}

function toggleStep(goalId, stepId) {
  const res = store.toggleStep(goalId, stepId);
  if (!res.ok) { toast('Não consegui salvar.', 'worried'); return; }
  if (res.done) {
    celebrate(innerWidth / 2, innerHeight / 3, res.xp);
    for (const a of res.achievements || []) setTimeout(() => toast(`Conquista: ${a.title}!`, 'celebrating', 4000), 600);
    const g = store.getGoal(goalId);
    if (g && g.steps.every((s) => s.done)) setTimeout(() => toast('Jornada completa! O castelo é teu.', 'celebrating', 4000), 300);
  }
  render();
}

// ---------------- Voz ----------------
let recognizing = null;
function startVoice(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!store.state.profile.voice || !SR) {
    if (route() !== 'conversa') ctx.go('conversa');
    setTimeout(() => {
      const inp = document.querySelector('#chat-input');
      inp?.focus();
      toast(SR ? 'Voz desligada nos Ajustes. Digita aqui.' : 'Reconhecimento de voz não disponível aqui. Toca no microfone do teclado pra ditar.', 'thinking', 4000);
    }, 200);
    return;
  }
  if (recognizing) { recognizing.stop(); return; }
  const rec = new SR();
  rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;
  recognizing = rec;
  document.querySelectorAll('[data-action=voice]').forEach((b) => b.classList.add('rec'));
  toast('Tô ouvindo…', 'focused', 2000);
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    if (route() !== 'conversa') { ctx.pendingSend = text; ctx.go('conversa'); } else sendMessage(ctx, text);
  };
  rec.onerror = (e) => {
    const msg = e.error === 'not-allowed' ? 'Sem permissão pro microfone. Libere nos ajustes do navegador ou use o ditado do teclado.' : 'Não consegui ouvir. Tenta de novo ou usa o ditado do teclado.';
    toast(msg, 'confused', 4000);
  };
  rec.onend = () => { recognizing = null; document.querySelectorAll('[data-action=voice]').forEach((b) => b.classList.remove('rec')); };
  try { rec.start(); } catch (e) { recognizing = null; toast('Não consegui ligar o microfone.', 'worried'); }
  void btn;
}

// ---------------- Foco ----------------
let focusTimer = null;
function tickFocus() {
  clearInterval(focusTimer);
  if (!focus.running) return;
  focusTimer = setInterval(() => {
    const rem = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
    const el = document.querySelector('#timer');
    if (el) el.textContent = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`;
    if (rem <= 0) {
      clearInterval(focusTimer);
      focus.running = false; focus.finished = true; focus.remaining = focus.total;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (document.visibilityState !== 'visible' && store.state.profile.notifications) showLocal('Sessão de foco concluída', 'Volta lá e me conta como foi.');
      if (route() === 'foco') render();
    }
  }, 500);
}

// ---------------- Dados de exemplo (claramente marcados) ----------------
function loadDemo() {
  const t = ymd(store.now());
  const add = (o) => store.addItem({ ...o, demo: true });
  add({ title: '[Exemplo] Responder clientes no direct', date: t, time: '10:00', duration: 30, priority: 1 });
  add({ title: '[Exemplo] Desenhar flash novo', date: t, duration: 90 });
  add({ title: '[Exemplo] Sessão de tatuagem', kind: 'event', date: ymd(addDays(store.now(), 1)), time: '14:00', duration: 180 });
  add({ title: '[Exemplo] Beber água', date: t, recurrence: 'daily', priority: 3 });
  store.addGoal({ title: '[Exemplo] Melhorar minha divulgação', steps: stepsFor('divulgação').steps, icon: 'megafone', demo: true });
}

// ---------------- Ações (delegação de eventos) ----------------
const ACTIONS = {
  go: (el) => ctx.go(el.dataset.to),
  'poke-mascot': (el) => { poke(el); if (el.id === 'hero-mascot' || el.id === 'chat-mascot') { const moods = ['excited', 'wink', 'surprised', 'love', 'happy']; setTimeout(() => setMood(el, moods[Math.floor(Math.random() * moods.length)]), 120); } },
  toggle: (el) => { const res = store.toggleDone(el.dataset.id, el.dataset.date || undefined); rewardFeedback(res, el); },
  'open-item': (el) => itemSheet(ctx, el.dataset.id),
  'new-item': (el) => itemSheet(ctx, null, { date: el.dataset.date, time: el.dataset.time }),
  voice: (el) => startVoice(el),
  quick: (el) => sendMessage(ctx, el.dataset.text),
  summary: () => summarySheet(ctx),
  'install-help': () => installSheet(),
  'remove-demo': async () => { if (await confirmSheet('Apagar todos os itens marcados como [Exemplo]?', 'Apagar', true)) { store.removeDemo(); render(); } },
  'load-demo': () => { loadDemo(); toast('Exemplos carregados. Todos começam com [Exemplo].', 'happy'); render(); },
  'chat-options': () => {
    const sh = openSheet(`<h2>Conversa</h2><div class="menu-list"><button class="menu-item" data-x="help"><span>❓</span>O que eu sei fazer</button><button class="menu-item" data-x="clear"><span>🗑️</span>Apagar histórico</button><button class="menu-item" data-x="settings"><span>⚙️</span>Privacidade e IA local</button></div>`);
    sh.querySelector('[data-x=help]').onclick = () => { closeSheet(); sendMessage(ctx, 'ajuda'); };
    sh.querySelector('[data-x=clear]').onclick = async () => { closeSheet(); if (await confirmSheet('Apagar toda a conversa?', 'Apagar', true)) { store.clearMessages(); brain.reset(); render(); } };
    sh.querySelector('[data-x=settings]').onclick = () => { closeSheet(); ctx.go('ajustes'); };
  },
  // Agenda
  'agenda-view': (el) => { agendaState.view = el.dataset.view; render(); },
  'agenda-date': (el) => { agendaState.date = el.dataset.date; if (agendaState.view === 'mês') { /* fica no mês */ } render(); },
  'agenda-shift': (el) => { shiftAgenda(Number(el.dataset.step)); render(); },
  'export-ics': async () => {
    const t = ymd(store.now());
    const items = store.state.items.filter((i) => i.date && (i.recurrence || i.date >= t) && !i.done);
    if (!items.length) { toast('Nada futuro pra exportar.', 'thinking'); return; }
    const how = await deliverFile('guia-agenda.ics', buildICS(items), 'text/calendar');
    if (how !== 'cancelled') toast(`${items.length} itens no arquivo. Abre ele no Calendário (ou importa no Google Agenda). Os alarmes são do sistema.`, 'happy', 5000);
  },
  // Jornada
  'select-goal': (el) => { jornadaState.goalId = el.dataset.id; render(); },
  'new-goal': () => goalSheet(ctx),
  'edit-goal': (el) => goalSheet(ctx, el.dataset.id),
  'step-sheet': (el) => stepSheet(ctx, el.dataset.goal, el.dataset.step),
  'toggle-step': (el) => toggleStep(el.dataset.goal, el.dataset.step),
  'add-step': (el) => addStepSheet(ctx, el.dataset.goal),
  achievement: (el) => achievementSheet(ctx, el.dataset.id),
  // Foco
  'focus-preset': (el) => { focus.total = focus.remaining = Number(el.dataset.min) * 60; render(); },
  'focus-toggle': () => {
    if (focus.running) { focus.remaining = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000)); focus.running = false; }
    else { focus.endAt = Date.now() + focus.remaining * 1000; focus.running = true; }
    render();
  },
  'focus-stop': () => { focus.running = false; const done = focus.total - (focus.running ? 0 : focus.remaining); focus.remaining = focus.total; if (done >= 300) { focus.finished = true; focus.total = done; } render(); },
  'focus-pick': (el) => { focus.itemId = el.dataset.id; render(); },
  'focus-feedback': (el) => {
    const mins = Math.round(focus.total / 60);
    const ach = store.recordFocus(mins);
    focus.finished = false; focus.total = focus.remaining = 25 * 60;
    if (el.dataset.r === 'done' && focus.itemId) { const res = store.toggleDone(focus.itemId); if (res.ok && res.done) celebrate(innerWidth / 2, innerHeight / 2, res.xp); }
    const msg = { done: 'Isso! Missão cumprida.', progress: 'Avançar já conta. Quer outra sessão depois de uma pausa?', stuck: 'Acontece. Talvez a tarefa esteja grande: tenta dividir em algo de 15 minutos.' }[el.dataset.r];
    toast(msg, el.dataset.r === 'stuck' ? 'thinking' : 'proud', 3500);
    for (const a of ach) setTimeout(() => toast(`Conquista: ${a.title}!`, 'celebrating', 4000), 800);
    ctx.go('hoje');
  },
  // Me salva
  split: (el) => {
    const it = store.getItem(el.dataset.id);
    if (!it) return;
    const r = store.addItem({ title: `Primeiros 15 min: ${it.title}`, date: ymd(store.now()), duration: 15, priority: 1, goalId: it.goalId, parentId: it.id });
    toast(r.ok ? 'Criei a versão de 15 minutos pra hoje.' : 'Não consegui criar.', r.ok ? 'excited' : 'worried'); render();
  },
  'move-tomorrow': async (el) => {
    const ids = el.dataset.ids.split(',');
    if (!(await confirmSheet(`Posso mover ${ids.length} tarefa${ids.length > 1 ? 's' : ''} pra amanhã?`, 'Pode mover'))) return;
    const t = ymd(addDays(store.now(), 1));
    const n = ids.filter((id) => store.reschedule(id, { date: t }).ok).length;
    toast(`Movi ${n}. Agora o dia cabe.`, 'happy'); render();
  },
  // Ajustes
  'add-block': () => {
    const sh = openSheet(`<h2>Horário fixo</h2><form id="bf"><label class="field"><span>Nome</span><input name="label" required maxlength="40" placeholder="Ex.: Aula na PUC"></label>
      <div class="pick-grid" style="margin-bottom:12px">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d, i) => `<label class="pick"><input type="checkbox" name="d" value="${i}" ${i >= 1 && i <= 5 ? 'checked' : ''}> ${d}</label>`).join('')}</div>
      <div class="row2"><label class="field"><span>Início</span><input type="time" name="start" value="08:00" required></label><label class="field"><span>Fim</span><input type="time" name="end" value="12:00" required></label></div>
      <button class="btn primary">Salvar</button></form>`);
    sh.querySelector('#bf').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const days = f.getAll('d').map(Number);
      if (!days.length || f.get('start') >= f.get('end')) { toast('Confere os dias e horários.', 'confused'); return; }
      store.updateProfile({ busyBlocks: [...(store.state.profile.busyBlocks || []), { label: f.get('label'), days, start: f.get('start'), end: f.get('end') }] });
      closeSheet(); render();
    });
  },
  'del-block': (el) => { const b = [...store.state.profile.busyBlocks]; b.splice(Number(el.dataset.i), 1); store.updateProfile({ busyBlocks: b }); render(); },
  'test-notif': async () => { const ok = await showLocal('Teste do Guia', 'Se tu tá lendo isso, as notificações funcionam.'); toast(ok ? 'Notificação enviada.' : 'O sistema não deixou mostrar a notificação.', ok ? 'happy' : 'worried'); },
  'test-llm': async () => {
    const box = document.querySelector('#llm-status');
    box.innerHTML = '<div class="skeleton"></div>';
    const r = await ollamaStatus(store.state.profile.llmUrl);
    const has = r.ok && r.models.some((m) => m.startsWith(store.state.profile.llmModel.split(':')[0]));
    box.innerHTML = r.ok
      ? `<div class="notice ${has ? '' : 'warn'}">Conectado. Modelos: ${esc(r.models.join(', ') || 'nenhum')}.${has ? '' : ` O modelo "${esc(store.state.profile.llmModel)}" não está instalado: rode <code>ollama pull ${esc(store.state.profile.llmModel)}</code>.`}</div>`
      : `<div class="notice bad">Indisponível (${esc(r.reason)}). Os comandos básicos seguem funcionando.</div>`;
  },
  'clear-chat': async () => { if (await confirmSheet('Apagar toda a conversa?', 'Apagar', true)) { store.clearMessages(); brain.reset(); toast('Conversa apagada.', 'happy'); } },
  'reset-learning': async () => {
    if (!(await confirmSheet('Zerar adiamentos e horários de conclusão usados na personalização?', 'Zerar', true))) return;
    store.state.items.forEach((i) => { i.postponed = 0; });
    store.updateProfile({}); toast('Zerado.', 'happy'); render();
  },
  'export-json': async () => { const how = await deliverFile(`guia-backup-${ymd(store.now())}.json`, store.exportJSON(), 'application/json'); if (how !== 'cancelled') toast('Backup gerado. Guarde no Arquivos/iCloud pra importar no outro aparelho.', 'happy', 4000); },
  'reset-all': async () => {
    if (!(await confirmSheet('Apagar TUDO deste aparelho? Exporte um backup antes.', 'Apagar tudo', true))) return;
    store.resetAll(); brain.reset(); onb.step = 0; render();
  },
  // Visual do Guia
  'mascot-mood': (el) => { mascotPreview.mood = el.dataset.mood; render(); },
  'mascot-set': (el) => { store.updateMascot({ [el.dataset.field]: el.dataset.key }); render(); },
  // Onboarding
  'onb-next': (el) => onbNext(el),
  'onb-back': () => { onb.step = Math.max(0, onb.step - 1); render(); },
  'onb-goal': (el) => { const g = el.dataset.g; onb.goals = onb.goals.includes(g) ? onb.goals.filter((x) => x !== g) : [...onb.goals, g]; saveOnbInputs(); render(); },
  'onb-notif': async () => { const r = await requestPermission(); onb.notif = r.ok; toast(r.ok ? 'Notificações ativadas.' : r.reason === 'install' ? 'No iPhone, instala na Tela de Início primeiro. Dá pra ativar depois nos Ajustes.' : 'Sem permissão. Tudo bem, dá pra ativar depois.', r.ok ? 'happy' : 'thinking', 4000); },
};

function saveOnbInputs() {
  const n = document.querySelector('#onb-name'); if (n) onb.name = n.value.trim();
  const c = document.querySelector('#onb-custom'); if (c) onb.custom = c.value.trim();
}

function onbNext(el) {
  saveOnbInputs();
  if (!el.dataset.final) { onb.step += 1; render(); return; }
  const periods = { manha: ['07:00', '13:00'], tarde: ['13:00', '19:00'], noite: ['18:00', '23:00'], dia: ['08:00', '22:00'] };
  const [dayStart, dayEnd] = periods[onb.period];
  store.updateProfile({ name: onb.name, strictness: onb.strictness, dayStart, dayEnd, notifications: onb.notif, onboarded: true });
  const goals = [...onb.goals, ...(onb.custom ? [onb.custom] : [])];
  const created = goals.map((t) => store.addGoal({ title: t, steps: stepsFor(t).steps, icon: stepsFor(t).icon })).filter((r) => r.ok);
  // Primeira missão simples e real
  const today = ymd(store.now());
  if (created.length) {
    const g = created[0].goal;
    store.scheduleStep(g.id, g.steps[0].id, { date: today });
    store.addMessage('guia', `Pronto${onb.name ? `, ${onb.name}` : ''}! Tua primeira missão: "${g.steps[0].title}" (jornada "${g.title}"). Conclui ela e eu ando no mapa.`, { mood: 'excited', quick: ['O que eu tenho hoje?', 'Ajuda'] });
  } else {
    store.addItem({ title: 'Anotar 3 coisas que precisam acontecer esta semana', date: today, duration: 10, priority: 1 });
    store.addMessage('guia', `Pronto${onb.name ? `, ${onb.name}` : ''}! Primeira missão: anotar 3 coisas que precisam acontecer esta semana. Pode me mandar aqui mesmo.`, { mood: 'excited', quick: ['Ajuda'] });
  }
  location.hash = '#/hoje';
  render();
  setTimeout(() => toast('Primeira missão no mapa!', 'excited'), 400);
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !root.contains(el)) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
root.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-action]')) { e.preventDefault(); ACTIONS[e.target.dataset.action]?.(e.target, e); }
});

// Campos de ajustes salvam ao mudar
root.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.actionChange === 'onb-strict') { onb.strictness = el.value; saveOnbInputs(); render(); return; }
  if (el.dataset.actionChange === 'onb-period') { onb.period = el.value; return; }
  if (el.dataset.actionChange === 'import-json') {
    const f = el.files?.[0]; if (!f) return;
    if (!(await confirmSheet('Importar substitui os dados deste aparelho pelos do arquivo. Continuar?', 'Importar', true))) return;
    const r = store.importJSON(await f.text());
    toast(r.ok ? 'Dados importados.' : 'Arquivo inválido. Nada foi alterado.', r.ok ? 'happy' : 'worried');
    render(); return;
  }
  const key = el.dataset.setting;
  if (!key) return;
  let value = el.type === 'checkbox' ? el.checked : el.value;
  if (key === 'notifications' && value) {
    const r = await requestPermission();
    if (!r.ok) { value = false; toast(r.reason === 'install' ? 'No iPhone, instala o app na Tela de Início primeiro (Compartilhar → Adicionar à Tela de Início).' : 'Sem permissão de notificação.', 'thinking', 5000); }
  }
  if (key === 'name') value = value.trim();
  const res = store.updateProfile({ [key]: value });
  if (!res.ok) toast('Não consegui salvar esse ajuste.', 'worried');
  if (el.type === 'checkbox' || el.type === 'radio') render();
});

// ---------------- Início ----------------
ctx.awayDays = store.registerOpen();
render();

startReminderLoop(store, (it, sentAsNotif) => {
  if (it.summary) { if (store.state.profile.onboarded) toast('Hora de fechar o dia. Toca em "Ver resumo" no Hoje.', 'sleepy', 5000); return; }
  if (!sentAsNotif) toast(`${it.kind === 'event' ? 'Daqui a pouco' : 'Agora'}: ${it.title}`, 'surprised', 6000);
  if (route() === 'hoje') render();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Versão nova do GUIA pronta. Fecha e abre o app pra atualizar.', 'excited', 5000); });
    });
  }).catch((e) => console.warn('Service worker não registrado', e));
}

// Exposto para testes no navegador
window.__guia = { store, brain, ctx, notifSupport };
