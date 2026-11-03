// Tela AGENDA: dia, semana e mês. Conflitos e horários livres.
import { esc, ICON } from '../ui.js';
import { ymd, parseYmd, addDays, startOfWeek, WEEKDAYS_SHORT, MONTHS, friendlyDate, fromMinutes, friendlyTime, longDate } from '../dates.js';
import { missionRow } from '../components.js';

export const agendaState = { view: 'dia', date: null };

export function renderAgenda(ctx) {
  const { store } = ctx;
  const today = ymd(store.now());
  if (!agendaState.date) agendaState.date = today;
  const sel = agendaState.date;
  const v = agendaState.view;
  const head = `<header class="topbar"><h1>Agenda</h1><div class="btn-row">
      <button class="icon-btn" data-action="export-ics" aria-label="Exportar para calendário">${ICON.download}</button>
      <button class="icon-btn" data-action="new-item" data-date="${sel}" aria-label="Novo item" style="background:var(--sun)">${ICON.plus}</button></div></header>
    <div class="seg" role="tablist">${['dia', 'semana', 'mês'].map((x) => `<button role="tab" class="${v === x ? 'on' : ''}" data-action="agenda-view" data-view="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>`;
  let body = '';
  if (v === 'dia') body = dayView(ctx, sel, today);
  else if (v === 'semana') body = weekView(ctx, sel, today);
  else body = monthView(ctx, sel, today);
  const inbox = store.inbox();
  const overdue = store.overdue();
  return `<main class="screen" aria-label="Agenda">${head}${body}
    ${overdue.length ? `<section class="card"><h2>Atrasadas <span class="count">${overdue.length}</span></h2>${overdue.map((i) => missionRow(store, i)).join('')}</section>` : ''}
    ${inbox.length ? `<section class="card"><h2>Sem data <span class="count">${inbox.length}</span></h2>${inbox.map((i) => missionRow(store, i)).join('')}</section>` : ''}
  </main>`;
}

function strip(ctx, sel, today) {
  const start = startOfWeek(parseYmd(sel));
  return `<div class="week-strip">${Array.from({ length: 7 }, (_, k) => {
    const d = addDays(start, k); const ds = ymd(d);
    const n = Math.min(3, ctx.store.itemsOn(ds).length);
    return `<button class="wday ${ds === today ? 'today' : ''} ${ds === sel ? 'sel' : ''}" data-action="agenda-date" data-date="${ds}" aria-label="${friendlyDate(ds)}">${WEEKDAYS_SHORT[d.getDay()]}<b>${d.getDate()}</b><span class="dots">${'<i></i>'.repeat(n)}</span></button>`;
  }).join('')}</div>`;
}

function nav(label, step) {
  return `<div class="date-nav"><button class="icon-btn" data-action="agenda-shift" data-step="-${step}" aria-label="Anterior">${ICON.back}</button><strong>${esc(label)}</strong><button class="icon-btn" data-action="agenda-shift" data-step="${step}" aria-label="Próximo">${ICON.next}</button></div>`;
}

function dayView(ctx, sel, today) {
  const { store } = ctx;
  const items = store.itemsOn(sel);
  const timed = items.filter((i) => i.time);
  const untimed = items.filter((i) => !i.time);
  // conflitos
  const conflicts = [];
  for (let a = 0; a < timed.length; a++) {
    const c = store.conflicts(sel, timed[a].time, timed[a].duration || (timed[a].kind === 'event' ? 60 : 30), timed[a].id).filter((x) => timed.indexOf(x) > a);
    for (const x of c) conflicts.push(`"${timed[a].title}" e "${x.title}"`);
  }
  const free = sel >= today ? store.freeSlots(sel, { minDuration: 30 }) : [];
  // intercala livres e ocupados por horário
  const rows = [];
  for (const i of timed) rows.push({ t: i.time, html: missionRow(store, i, sel) });
  for (const [s, e] of free) rows.push({ t: fromMinutes(s), html: `<button class="slot-free" data-action="new-item" data-date="${sel}" data-time="${fromMinutes(s)}">+ Livre ${friendlyTime(fromMinutes(s))}–${friendlyTime(fromMinutes(e))}</button>` });
  rows.sort((a, b) => a.t.localeCompare(b.t));
  return `${nav(sel === today ? `Hoje, ${parseYmd(sel).getDate()}` : longDate(parseYmd(sel)), 1)}${strip(ctx, sel, today)}
    ${conflicts.map((c) => `<div class="conflict">⚠ Conflito: ${esc(c)}</div>`).join('')}
    <section class="card"><h2>Com horário</h2>${rows.length ? rows.map((r) => r.html).join('') : '<p class="muted small">Nada com horário.</p>'}</section>
    <section class="card"><h2>Ao longo do dia <span class="count">${untimed.length}</span></h2>${untimed.length ? untimed.map((i) => missionRow(store, i, sel)).join('') : `<div class="empty"><p class="muted">Dia sem tarefas soltas.</p><button class="btn small sun" data-action="new-item" data-date="${sel}">${ICON.plus} Adicionar</button></div>`}</section>`;
}

function weekView(ctx, sel, today) {
  const { store } = ctx;
  const start = startOfWeek(parseYmd(sel));
  const end = addDays(start, 6);
  const label = `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
  const days = Array.from({ length: 7 }, (_, k) => ymd(addDays(start, k)));
  return `${nav(label, 7)}${days.map((d) => {
    const items = store.itemsOn(d);
    const load = store.dayLoad(d);
    return `<section class="card" style="${d === today ? 'background:var(--sky-soft)' : ''}"><div class="card-head"><h2 style="text-transform:capitalize">${esc(friendlyDate(d, store.now()))}</h2><span class="small muted">${load ? `~${Math.round(load / 6) / 10}h` : ''}</span></div>
      ${items.length ? items.map((i) => missionRow(store, i, d)).join('') : '<p class="muted small" style="margin:0">Livre.</p>'}</section>`;
  }).join('')}`;
}

function monthView(ctx, sel, today) {
  const { store } = ctx;
  const d = parseYmd(sel);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, k) => addDays(start, k));
  const items = store.itemsOn(sel);
  return `${nav(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`, 30)}
    <div class="card"><div class="month">${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((w) => `<div class="h">${w}</div>`).join('')}
    ${cells.map((c) => { const ds = ymd(c); const n = Math.min(3, store.itemsOn(ds).length); return `<button class="mday ${c.getMonth() !== d.getMonth() ? 'out' : ''} ${ds === today ? 'today' : ''} ${ds === sel ? 'sel' : ''}" data-action="agenda-date" data-date="${ds}">${c.getDate()}<span class="dots">${'<i></i>'.repeat(n)}</span></button>`; }).join('')}</div></div>
    <section class="card"><h2 style="text-transform:capitalize">${esc(friendlyDate(sel, store.now()))}</h2>${items.length ? items.map((i) => missionRow(store, i, sel)).join('') : '<p class="muted small" style="margin:0">Nada neste dia.</p>'}</section>`;
}

export function shiftAgenda(step) {
  const d = parseYmd(agendaState.date);
  if (Math.abs(step) === 30) agendaState.date = ymd(new Date(d.getFullYear(), d.getMonth() + Math.sign(step), 1));
  else agendaState.date = ymd(addDays(d, step));
}
