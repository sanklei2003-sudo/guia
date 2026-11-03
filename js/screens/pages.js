// Telas secundárias: Modo Foco, Me Salva, Ajustes, Menu, Conquistas, Visual do Guia, Onboarding.
import { esc, ICON, mascot } from '../ui.js';
import { mascotSVG, MOODS, MOOD_LABEL } from '../mascot.js';
import { ymd, addDays, friendlyDate, WEEKDAYS_SHORT, formatDuration } from '../dates.js';
import { priorities, saveMePlan } from '../planner.js';
import { missionRow, levelChip } from '../components.js';
import { ACHIEVEMENTS, LEVEL_XP } from '../store.js';
import { UNLOCK_LABEL } from '../sheets.js';
import { notifSupport } from '../notify.js';

const back = (to = 'hoje') => `<button class="icon-btn" data-action="go" data-to="${to}" aria-label="Voltar">${ICON.back}</button>`;

// ---------------- Modo Foco ----------------
export const focus = { endAt: null, remaining: 25 * 60, total: 25 * 60, running: false, finished: false, itemId: null };

export function renderFoco(ctx) {
  const { store } = ctx;
  if (ctx.focusId) { focus.itemId = ctx.focusId; ctx.focusId = null; focus.finished = false; }
  let item = focus.itemId ? store.getItem(focus.itemId) : null;
  if (!item || store.isDone(item, ymd(store.now()))) { item = priorities(store, 1)[0] || null; focus.itemId = item?.id || null; }
  const rem = focus.running ? Math.max(0, Math.round((focus.endAt - Date.now()) / 1000)) : focus.remaining;
  const mm = String(Math.floor(rem / 60)).padStart(2, '0');
  const ss = String(rem % 60).padStart(2, '0');
  const mood = focus.finished ? 'proud' : focus.running ? 'focused' : 'happy';
  if (focus.finished) {
    return `<main class="focus-screen" aria-label="Modo foco">
      ${mascot('proud')}
      <div class="focus-task">${esc(item?.title || 'Sessão de foco')}</div>
      <p style="font-weight:800;color:#fff;text-shadow:0 2px 0 var(--ink);font-size:20px">Sessão de ${Math.round(focus.total / 60)} min feita. E aí?</p>
      <div class="btn-row" style="justify-content:center">
        ${item ? '<button class="btn primary" data-action="focus-feedback" data-r="done">Concluí a tarefa</button>' : ''}
        <button class="btn sun" data-action="focus-feedback" data-r="progress">Avancei</button>
        <button class="btn" data-action="focus-feedback" data-r="stuck">Não rolou</button>
      </div></main>`;
  }
  return `<main class="focus-screen" aria-label="Modo foco">
    <div style="position:absolute;top:calc(var(--safe-t) + 12px);left:16px">${back()}</div>
    ${mascot(mood, '', 'focus-mascot')}
    <div class="focus-task">${item ? esc(item.title) : 'Sem tarefa: foco livre'}</div>
    <div class="timer" id="timer" role="timer" aria-live="off">${mm}:${ss}</div>
    ${focus.running ? '' : `<div class="focus-presets">${[15, 25, 45, 60].map((m) => `<button class="btn small ${focus.total === m * 60 ? 'sun' : ''}" data-action="focus-preset" data-min="${m}">${m} min</button>`).join('')}</div>`}
    <div class="btn-row" style="justify-content:center">
      <button class="btn ${focus.running ? '' : 'primary'}" data-action="focus-toggle">${focus.running ? ICON.pause + ' Pausar' : ICON.play + ' Começar'}</button>
      ${focus.running || focus.remaining !== focus.total ? '<button class="btn ghost" data-action="focus-stop" style="color:#fff">Encerrar</button>' : ''}
    </div>
    ${!focus.running && priorities(store, 4).length > 1 ? `<div style="margin-top:22px;width:100%;max-width:420px"><p style="color:#fff;font-weight:800;text-shadow:0 2px 0 var(--ink)">Trocar tarefa:</p>${priorities(store, 4).filter((i) => i.id !== item?.id).map((i) => `<button class="menu-item" style="margin-bottom:6px" data-action="focus-pick" data-id="${i.id}">${esc(i.title)}</button>`).join('')}</div>` : ''}
  </main>`;
}

// ---------------- Me salva ----------------
export function renderMeSalva(ctx) {
  const { store } = ctx;
  const p = saveMePlan(store);
  const labels = { 'fazer-agora': ['Fazer agora', 'Urgente e importante'], agendar: ['Agendar', 'Importante, sem pressa'], rapido: ['Resolver rápido', 'Tem prazo, mas pesa pouco'], depois: ['Pode esperar', 'Nem urgente nem importante'] };
  return `<main class="screen" aria-label="Me salva">
    <header class="topbar">${back()}<h1>Me salva</h1><span></span></header>
    <section class="hero" style="padding-bottom:0"><div class="hero-row">${mascot(p.pending.length ? 'worried' : 'happy')}<div class="bubble">${p.pending.length ? 'Respira. Olhei tuas pendências dos próximos 3 dias. Faz só essas três primeiro.' : 'Não tem nada pendente nos próximos dias. Tá mais tranquilo do que parece.'}</div></div></section>
    ${p.first.length ? `<section class="card"><h2>1. Primeiro, só isso</h2>${p.first.map((i) => missionRow(store, i, i.recurrence ? ymd(store.now()) : undefined, { showDate: true })).join('')}
      <button class="btn small sky" data-action="go" data-to="foco" style="margin-top:10px">${ICON.focus} Começar pela primeira</button></section>` : ''}
    ${p.big.length ? `<section class="card"><h2>2. Grande demais?</h2><p class="small muted" style="margin-top:0">Essas são longas ou já foram adiadas. Começar com 15 minutos destrava.</p>${p.big.slice(0, 3).map((i) => `<div class="mission"><div class="m-body"><span class="m-title">${esc(i.title)}</span></div><button class="btn small sun" data-action="split" data-id="${i.id}">15 min</button></div>`).join('')}</section>` : ''}
    ${p.overloaded ? `<section class="card" style="background:var(--sun-soft)"><h2>3. Hoje não cabe</h2><p class="small" style="margin-top:0">Tem uns ${formatDuration(p.load)} de coisas e ${formatDuration(p.free)} livres.${p.movable.length ? ` Dá pra passar pra amanhã: ${p.movable.map((i) => esc(i.title)).join(', ')}.` : ''}</p>${p.movable.length ? `<button class="btn small" data-action="move-tomorrow" data-ids="${p.movable.map((i) => i.id).join(',')}">Mover pra amanhã (pergunto antes)</button>` : ''}</section>` : ''}
    ${p.pending.length ? `<section class="card"><h2>Mapa das pendências</h2>${Object.entries(p.groups).filter(([, l]) => l.length).map(([k, l]) => `<h3 style="font-size:16px;margin:12px 0 2px">${labels[k][0]} <span class="small muted" style="font-family:var(--font-body)">· ${labels[k][1]}</span></h3>${l.map((i) => missionRow(store, i, undefined, { showDate: true })).join('')}`).join('')}</section>` : ''}
  </main>`;
}

// ---------------- Menu ----------------
export function renderMenu(ctx) {
  return `<main class="screen" aria-label="Menu"><header class="topbar">${back()}<h1>Menu</h1>${levelChip(ctx.store)}</header>
    <div class="menu-list">
      ${[['ajustes', '⚙️', 'Ajustes'], ['conquistas', '🏅', 'Conquistas e histórico'], ['mascote', '🍄', 'Visual do Guia'], ['mesalva', '🆘', 'Me salva'], ['foco', '🎯', 'Modo foco']]
        .map(([to, e, l]) => `<button class="menu-item" data-action="go" data-to="${to}"><span>${e}</span>${l}</button>`).join('')}
      <button class="menu-item" data-action="summary"><span>🌙</span>Resumo do dia</button>
      <button class="menu-item" data-action="install-help"><span>📲</span>Instalar no iPhone e no Mac</button>
      <button class="menu-item" data-action="go" data-to="sobre"><span>📜</span>O que funciona e o que não funciona</button>
    </div></main>`;
}

// ---------------- Ajustes ----------------
export function renderAjustes(ctx) {
  const { store } = ctx;
  const p = store.state.profile;
  const ns = notifSupport();
  const sw = (name, checked, label, help = '') => `<div class="toggle"><div>${label}${help ? `<small>${help}</small>` : ''}</div><label class="switch"><input type="checkbox" data-setting="${name}" ${checked ? 'checked' : ''} aria-label="${esc(label)}"><i></i></label></div>`;
  const ins = store.insights();
  const notifText = !ns.hasAPI ? (ns.needsInstall ? 'No iPhone, notificações só existem com o app instalado na Tela de Início (iOS 16.4+).' : 'Este navegador não suporta notificações.')
    : ns.permission === 'denied' ? 'Permissão negada. Libere em Ajustes do sistema → Notificações.' : 'Disparam só com o app aberto ou recém-aberto. Push com app fechado precisa de servidor (não incluído). Para aviso garantido, use Calendário.';
  return `<main class="screen" aria-label="Ajustes"><header class="topbar">${back('menu')}<h1>Ajustes</h1><span></span></header>
    <section class="card"><h2>Você</h2>
      <label class="field"><span>Como te chamo</span><input data-setting="name" value="${esc(p.name)}" maxlength="30"></label>
      <div class="row2"><label class="field"><span>Dia começa</span><input type="time" data-setting="dayStart" value="${esc(p.dayStart)}"></label>
      <label class="field"><span>Dia termina</span><input type="time" data-setting="dayEnd" value="${esc(p.dayEnd)}"></label></div>
      <h3 style="font-size:16px;margin:4px 0 6px">Horários ocupados fixos</h3>
      ${(p.busyBlocks || []).map((b, i) => `<div class="mission"><div class="m-body"><span class="m-title">${esc(b.label)}</span><span class="m-meta">${b.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')} · ${esc(b.start)}–${esc(b.end)}</span></div><button class="icon-btn" data-action="del-block" data-i="${i}" aria-label="Remover">${ICON.trash}</button></div>`).join('') || '<p class="small muted">Nenhum. Ex.: aulas, trabalho fixo. O Guia evita sugerir horários aí.</p>'}
      <button class="btn small" data-action="add-block">${ICON.plus} Adicionar horário fixo</button>
    </section>
    <section class="card"><h2>Nível de cobrança</h2><div class="radio-cards">
      ${[['suave', 'Suave', 'Lembra sem pressionar.'], ['equilibrado', 'Equilibrado', 'Humor e cobrança na medida.'], ['exigente', 'Exigente', 'Teatralmente bravo, nunca ofensivo.']].map(([v, l, d]) => `<label class="radio-card"><input type="radio" name="strict" data-setting="strictness" value="${v}" ${p.strictness === v ? 'checked' : ''}><div>${l}<small>${d}</small></div></label>`).join('')}
    </div>
      ${sw('chargeMode', p.chargeMode, 'Modo cobrança', 'O Guia comenta pendências e adiamentos.')}
      ${sw('dailySummary', p.dailySummary, 'Resumo do dia', 'Mostra o fechamento à noite.')}
      <label class="field" style="margin-top:8px"><span>Horário do resumo</span><input type="time" data-setting="summaryTime" value="${esc(p.summaryTime)}"></label>
    </section>
    <section class="card"><h2>Notificações</h2>
      ${sw('notifications', p.notifications && ns.permission === 'granted', 'Notificações locais', notifText)}
      ${p.notifications && ns.permission === 'granted' ? '<button class="btn small" data-action="test-notif">Testar notificação</button>' : ''}
      <button class="btn small sun" data-action="export-ics" style="margin-top:8px">${ICON.download} Mandar agenda pro Calendário (.ics)</button>
    </section>
    <section class="card"><h2>Voz e conversa</h2>
      ${sw('voice', p.voice, 'Comando por voz', 'Usa o reconhecimento de fala do navegador quando existe. Senão, use o microfone do teclado do iPhone.')}
      ${sw('speak', p.speak, 'Guia fala as respostas', 'Voz do sistema, em português.')}
      ${sw('saveChat', p.saveChat, 'Guardar histórico da conversa', 'Fica só neste aparelho.')}
      <button class="btn small ghost" data-action="clear-chat" style="color:var(--wine)">${ICON.trash} Apagar conversa</button>
    </section>
    <section class="card"><h2>IA local (opcional)</h2>
      <p class="small" style="margin-top:0">Para conversa livre e estratégia, o Guia pode usar um modelo rodando no seu Mac via <b>Ollama</b> (grátis). Sem isso, todos os comandos continuam funcionando.</p>
      ${sw('llmEnabled', p.llmEnabled, 'Usar IA local')}
      <label class="field"><span>Endereço do Ollama</span><input data-setting="llmUrl" value="${esc(p.llmUrl)}" inputmode="url" autocapitalize="off"></label>
      <label class="field"><span>Modelo</span><input data-setting="llmModel" value="${esc(p.llmModel)}" autocapitalize="off"></label>
      ${sw('llmContext', p.llmContext, 'Enviar tarefas e objetivos como contexto', 'Os dados vão só para o seu próprio computador.')}
      <button class="btn small" data-action="test-llm">Testar conexão</button><div id="llm-status"></div>
      <div class="notice warn">No iPhone, a IA local não roda. No Mac, o app precisa estar aberto pelo endereço local (veja o LEIA-ME), porque o navegador bloqueia acesso de um site HTTPS ao localhost.</div>
    </section>
    <section class="card"><h2>O que o Guia aprendeu</h2>
      <p class="small" style="margin-top:0">Regras e contagens simples, sem IA:</p>
      <ul class="small" style="padding-left:18px;margin:0 0 10px">
        <li>Concluídas registradas: ${ins.total}</li>
        <li>Período em que mais conclui: ${ins.bestPeriod ? (ins.bestPeriod === 'manha' ? 'manhã' : ins.bestPeriod) : 'ainda sem dados suficientes (mín. 5)'}</li>
        <li>Dias ativos nos últimos 7: ${ins.activeDays7}</li>
        <li>Tarefas adiadas 3+ vezes: ${ins.stuck.length ? ins.stuck.map((i) => esc(i.title)).join(', ') : 'nenhuma'}</li>
      </ul>
      <button class="btn small ghost" data-action="reset-learning" style="color:var(--wine)">Zerar contagem de adiamentos e horários</button>
    </section>
    <section class="card"><h2>Dados</h2>
      <p class="small" style="margin-top:0">Tudo fica salvo neste aparelho. Para levar ao outro (iPhone ↔ Mac), exporte aqui e importe lá.</p>
      <div class="btn-row"><button class="btn small" data-action="export-json">${ICON.download} Exportar backup</button>
      <label class="btn small" style="cursor:pointer">Importar backup<input type="file" accept="application/json,.json" data-action-change="import-json" hidden></label></div>
      <div class="btn-row" style="margin-top:10px">${store.hasDemo() ? '<button class="btn small" data-action="remove-demo">Apagar exemplos</button>' : '<button class="btn small" data-action="load-demo">Carregar exemplos (marcados)</button>'}
      <button class="btn small ghost" data-action="reset-all" style="color:var(--wine)">${ICON.trash} Apagar tudo</button></div>
    </section>
  </main>`;
}

// ---------------- Sobre (lista honesta) ----------------
export function renderSobre() {
  const ok = ['Tarefas, compromissos, recorrências e agenda dia/semana/mês', 'Comandos em português sem internet e sem IA paga', 'Detecção de conflitos e sugestão de horário livre', 'Jornadas com mapa, etapas e mascote que anda', 'Me salva, Modo foco, resumo do dia, cobrança ajustável', 'Funciona offline depois da primeira abertura', 'Exportação para Calendário (.ics) com alarme'];
  const no = ['Sincronização automática entre iPhone e Mac (use exportar/importar)', 'Notificação com o app fechado (precisa servidor de push; use o .ics)', 'Conversa livre sem a IA local ligada', 'Integração direta com Google Agenda (use o .ics, que o Google Agenda importa)', 'Reconhecimento de voz em todos os aparelhos (depende do navegador)'];
  return `<main class="screen"><header class="topbar">${back('menu')}<h1>Limites</h1><span></span></header>
    <section class="card"><h2>✓ Funciona</h2>${ok.map((t) => `<p class="small" style="margin:4px 0">• ${t}</p>`).join('')}</section>
    <section class="card"><h2>✗ Não funciona (ainda)</h2>${no.map((t) => `<p class="small" style="margin:4px 0">• ${t}</p>`).join('')}</section></main>`;
}

// ---------------- Conquistas ----------------
export function renderConquistas(ctx) {
  const { store } = ctx;
  const st = store.state.stats;
  const days = Array.from({ length: 14 }, (_, k) => ymd(addDays(store.now(), k - 13)));
  const max = Math.max(1, ...days.map((d) => st.history[d] || 0));
  return `<main class="screen" aria-label="Conquistas"><header class="topbar">${back('menu')}<h1>Conquistas</h1><span></span></header>
    <section class="card"><h2>Nível ${store.level()}</h2><div class="bar"><i style="width:${Math.round(store.levelProgress() * 100)}%"></i></div><p class="small muted">${st.xp % LEVEL_XP}/${LEVEL_XP} XP para o próximo nível. XP vem de missões, etapas e sessões de foco.</p></section>
    <section class="card"><h2>Últimos 14 dias</h2>
      <div style="display:flex;align-items:flex-end;gap:4px;height:90px;margin-top:6px" aria-label="Missões concluídas por dia">${days.map((d) => { const n = st.history[d] || 0; return `<div title="${friendlyDate(d)}: ${n}" style="flex:1;height:${Math.max(4, (n / max) * 100)}%;background:${n ? 'var(--sky)' : 'var(--sand)'};border:2px solid var(--ink);border-radius:6px 6px 2px 2px"></div>`; }).join('')}</div>
      <p class="small muted">Retomadas depois de dias fora: ${st.returns}. Sessões de foco: ${st.focusSessions} (${st.focusMinutes} min). Pausas fazem parte: o que conta é voltar.</p></section>
    <section class="card"><h2>Conquistas</h2>${ACHIEVEMENTS.map((a) => { const got = st.achievements.includes(a.id); return `<div class="mission" style="${got ? '' : 'opacity:.55'}"><span style="font-size:24px">${got ? '🏅' : '🔒'}</span><div class="m-body"><span class="m-title">${esc(a.title)}</span><span class="m-meta">${esc(a.desc)}${a.unlock ? ` · libera ${esc(UNLOCK_LABEL[a.unlock])}` : ''}</span></div></div>`; }).join('')}</section></main>`;
}

// ---------------- Visual do Guia ----------------
export const mascotPreview = { mood: 'happy' };
export function renderMascote(ctx) {
  const { store } = ctx;
  const m = store.state.mascot;
  const un = store.state.stats.unlocked;
  const opt = (field, key, label) => { const locked = !un.includes(key) && key !== 'nenhum' && key !== 'classico' && key !== 'amarelo'; const on = m[field] === key; return `<button class="pick ${on ? 'on' : ''}" ${locked ? 'disabled style="opacity:.45"' : ''} data-action="mascot-set" data-field="${field}" data-key="${key}">${locked ? '🔒 ' : ''}${label}</button>`; };
  return `<main class="screen" aria-label="Visual do Guia"><header class="topbar">${back('menu')}<h1>Visual</h1><span></span></header>
    <section class="hero"><div style="display:flex;justify-content:center;position:relative;z-index:1">${mascot(mascotPreview.mood, '', 'preview-mascot').replace('class="mascot ', 'style="width:190px;margin-bottom:-6px" class="mascot ')}</div><div class="progress-row"></div></section>
    <section class="card"><h2>Expressões</h2><div class="pick-grid">${MOODS.map((md) => `<button class="pick ${mascotPreview.mood === md ? 'on' : ''}" data-action="mascot-mood" data-mood="${md}">${MOOD_LABEL[md]}</button>`).join('')}</div></section>
    <section class="card"><h2>Chapéu</h2><div class="pick-grid">${opt('hat', 'classico', 'Só os óculos')}${opt('hat', 'chapeu-explorador', 'Explorador')}${opt('hat', 'coroa', 'Coroa')}${opt('hat', 'chapeu-pirata', 'Pirata')}${opt('hat', 'festa', 'Festa')}</div></section>
    <section class="card"><h2>Acessório</h2><div class="pick-grid">${opt('accessory', 'nenhum', 'Nenhum')}${opt('accessory', 'flor', 'Flor')}${opt('accessory', 'bussola', 'Bússola')}${opt('accessory', 'lanterna', 'Lanterna')}</div></section>
    <section class="card"><h2>Tênis</h2><div class="pick-grid">${opt('scarf', 'amarelo', 'Amarelo')}${opt('scarf', 'azul', 'Azul')}${opt('scarf', 'vinho', 'Vinho')}</div><p class="small muted">Itens 🔒 são liberados por conquistas reais.</p></section>
  </main>`;
}

// ---------------- Onboarding ----------------
export const onb = { step: 0, name: '', goals: [], custom: '', strictness: 'equilibrado', period: 'tarde', notif: false };
const GOAL_PICKS = ['Melhorar minha organização', 'Melhorar minha divulgação', 'Finalizar trabalhos da faculdade', 'Aprender uma habilidade', 'Desenvolver um projeto'];

export function renderOnboarding() {
  const steps = 5;
  const dots = `<div class="onb-dots">${Array.from({ length: steps + 1 }, (_, i) => `<i class="${i === onb.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const next = (label = 'Próximo', extra = '') => `<div class="spacer"></div><div class="btn-row" style="justify-content:space-between">${onb.step ? '<button class="btn ghost" data-action="onb-back">Voltar</button>' : '<span></span>'}<button class="btn primary" data-action="onb-next" ${extra}>${label}</button></div>`;
  let body = '';
  switch (onb.step) {
    case 0: body = `${mascot('excited', 'waving')}<div class="bubble">Opa! Eu sou o Guia, um cogumelo explorador. Tu me fala o que precisa e eu anoto, organizo e te cobro. Sem formulário chato. Cinco perguntas rápidas e a gente começa.</div>${next('Bora')}`; break;
    case 1: body = `${mascot('happy')}<div class="bubble">Como eu te chamo?</div><label class="field"><span class="sr-only">Seu nome</span><input id="onb-name" value="${esc(onb.name)}" maxlength="30" placeholder="Seu nome ou apelido" autocomplete="given-name"></label>${next()}`; break;
    case 2: body = `${mascot('thinking')}<div class="bubble">Quais são teus principais objetivos agora? Cada um vira um mapa.</div><div class="pick-grid">${GOAL_PICKS.map((g) => `<button class="pick ${onb.goals.includes(g) ? 'on' : ''}" data-action="onb-goal" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div><label class="field" style="margin-top:12px"><span>Outro objetivo</span><input id="onb-custom" value="${esc(onb.custom)}" maxlength="80" placeholder="Ex.: 1.000 seguidores no Instagram"></label>${next()}`; break;
    case 3: body = `${mascot(onb.strictness === 'exigente' ? 'angry' : onb.strictness === 'suave' ? 'resting' : 'wink')}<div class="bubble">Quanto eu posso te cobrar?</div><div class="radio-cards">${[['suave', 'Suave', 'Lembro sem pressionar.'], ['equilibrado', 'Equilibrado', 'Humor e cobrança na medida.'], ['exigente', 'Exigente', 'Fico teatralmente bravo. Nunca ofensivo.']].map(([v, l, d]) => `<label class="radio-card"><input type="radio" name="onb-strict" value="${v}" ${onb.strictness === v ? 'checked' : ''} data-action-change="onb-strict"><div>${l}<small>${d}</small></div></label>`).join('')}</div>${next()}`; break;
    case 4: body = `${mascot('focused')}<div class="bubble">Quando tu costuma fazer as coisas?</div><div class="radio-cards">${[['manha', 'De manhã', '7h às 13h'], ['tarde', 'À tarde', '13h às 19h'], ['noite', 'À noite', '18h às 23h'], ['dia', 'O dia todo', '8h às 22h']].map(([v, l, d]) => `<label class="radio-card"><input type="radio" name="onb-period" value="${v}" ${onb.period === v ? 'checked' : ''} data-action-change="onb-period"><div>${l}<small>${d}</small></div></label>`).join('')}</div>${next()}`; break;
    default: body = `${mascot('surprised')}<div class="bubble">Quer que eu mande notificações? No iPhone, só funcionam com o app instalado na Tela de Início, e enquanto ele está aberto. Pra aviso garantido, dá pra mandar compromissos pro Calendário.</div><div class="btn-row"><button class="btn sun" data-action="onb-notif">Ativar notificações</button></div>${next('Começar', 'data-final="1"')}`;
  }
  return `<main class="onb" aria-label="Boas-vindas">${dots}${body}</main>`;
}

export { MOODS, mascotSVG };
