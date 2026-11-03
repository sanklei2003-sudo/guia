// Tela HOJE: mascote, saudação, progresso e até três prioridades.
import { esc, ICON, mascot } from '../ui.js';
import { longDate, ymd, addDays, friendlyDate, friendlyTime } from '../dates.js';
import { say, missoes } from '../voice.js';
import { priorities } from '../planner.js';
import { missionRow, levelChip } from '../components.js';

export function renderHoje(ctx) {
  const { store } = ctx;
  const now = store.now();
  const today = ymd(now);
  const p = store.state.profile;
  const items = store.itemsOn(today);
  const doneN = items.filter((i) => store.isDone(i, today)).length;
  const pct = items.length ? Math.round((doneN / items.length) * 100) : 0;
  const pr = priorities(store, 3);
  const overdue = store.overdue();
  const S = p.strictness;
  const h = now.getHours();

  // Mensagem contextual (baseada em dados reais)
  let mood = 'happy';
  let msg;
  const greet = say(h < 12 ? 'greetMorning' : h < 18 ? 'greetAfternoon' : 'greetNight', S, { nome: p.name || 'criatura' });
  if (ctx.awayDays >= 3) { msg = say('comeback', S); mood = 'excited'; }
  else if (items.length && doneN === items.length) { msg = say('allDone', S); mood = 'celebrating'; }
  else if (!items.length && !overdue.length) { msg = `${greet} ${say('dayEmpty', S)}`; mood = h >= 22 ? 'sleepy' : 'resting'; }
  else {
    const stuck = store.insights().stuck[0];
    if (stuck && p.chargeMode) { msg = say('stuck', S, { n: stuck.postponed }).replace(/^Essa/, `"${stuck.title}"`); mood = S === 'exigente' ? 'angry' : 'thinking'; }
    else if (store.dayLoad(today) > 480) { msg = `${greet} ${say('overload', S)}`; mood = 'worried'; }
    else { msg = `${greet} ${say('dayIntro', S, { n: missoes(items.length - doneN + overdue.length) })}`; mood = h >= 22 ? 'sleepy' : 'happy'; }
  }
  if (overdue.length && p.chargeMode && mood === 'happy') {
    msg += ` E tem ${overdue.length} atrasada${overdue.length > 1 ? 's' : ''} no meio.`;
    mood = S === 'exigente' ? 'angry' : 'worried';
  }

  // Próximos compromissos (3 dias)
  const upcoming = [];
  for (let k = 0; k < 4 && upcoming.length < 3; k++) {
    const d = ymd(addDays(now, k));
    for (const it of store.itemsOn(d)) {
      if (it.kind !== 'event' || store.isDone(it, d)) continue;
      if (k === 0 && it.time && it.time < `${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`) continue;
      upcoming.push({ it, d });
      if (upcoming.length >= 3) break;
    }
  }

  const evening = h >= 18 && p.dailySummary;

  return `<main class="screen" aria-label="Hoje">
    <header class="topbar">
      <button class="icon-btn" data-action="go" data-to="menu" aria-label="Menu">${ICON.menu}</button>
      ${levelChip(store)}
    </header>

    <section class="hero" aria-label="Guia">
      <span class="hero-date">${esc(longDate(now))}</span>
      <div class="hero-row">
        ${mascot(mood, '', 'hero-mascot')}
        <div class="bubble" id="hero-bubble">${esc(msg)}</div>
      </div>
      <div class="progress-row" aria-label="Progresso do dia: ${pct}%">
        <div class="bar"><i style="width: ${pct}%"></i></div><span>${doneN}/${items.length}</span>
      </div>
    </section>

    <div class="quick-actions">
      <button class="qa" data-action="go" data-to="conversa">${ICON.chat}Conversar</button>
      <button class="qa voice" data-action="voice">${ICON.mic}Falar</button>
      <button class="qa sos" data-action="go" data-to="mesalva">${ICON.sos}Me salva</button>
    </div>

    ${store.hasDemo() ? `<div class="notice warn">Tem dados de exemplo no app. <button class="link" data-action="remove-demo">Apagar exemplos</button></div>` : ''}

    <section class="card" aria-label="Missões prioritárias">
      <div class="card-head"><h2>Missões de hoje <span class="count">${pr.length}${items.length + overdue.length > 3 ? ` de ${items.length - doneN + overdue.length}` : ''}</span></h2>
        <button class="icon-btn" data-action="new-item" aria-label="Nova missão">${ICON.plus}</button></div>
      ${pr.length ? pr.map((i) => missionRow(store, i, i.recurrence ? today : undefined)).join('')
        : `<div class="empty"><p>${items.length ? 'Tudo feito por hoje.' : 'Nenhuma missão pra hoje.'}</p><button class="btn small sun" data-action="new-item">${ICON.plus} Criar missão</button></div>`}
      ${pr.length ? `<div class="btn-row" style="margin-top:10px"><button class="btn small sky" data-action="go" data-to="foco">${ICON.focus} Modo foco</button>${items.length + overdue.length > 3 ? '<button class="btn small ghost" data-action="go" data-to="agenda">Ver todas</button>' : ''}</div>` : ''}
    </section>

    ${doneN ? `<section class="card" aria-label="Concluídas hoje"><h2>Feitas hoje <span class="count">${doneN}</span></h2>${items.filter((i) => store.isDone(i, today)).slice(0, 5).map((i) => missionRow(store, i, today)).join('')}</section>` : ''}

    <section class="card" aria-label="Próximos compromissos">
      <h2>Próximos compromissos</h2>
      ${upcoming.length ? upcoming.map(({ it, d }) => `<button class="menu-item" data-action="open-item" data-id="${it.id}" style="margin-bottom:8px"><span>📍</span><div><div>${esc(it.title)}</div><div class="small muted">${esc(friendlyDate(d, now))}${it.time ? ` · ${esc(friendlyTime(it.time))}` : ''}</div></div></button>`).join('')
        : '<p class="muted small" style="margin:0">Nada marcado nos próximos dias.</p>'}
    </section>

    ${evening ? `<section class="card" style="background:var(--sun-soft)"><h2>🌙 Fechar o dia</h2><p class="small" style="margin:0 0 10px">Ver o que foi feito e o que fica pra amanhã.</p><button class="btn small" data-action="summary">Ver resumo do dia</button></section>` : ''}
  </main>`;
}
