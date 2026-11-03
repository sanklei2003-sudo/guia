// Componentes compartilhados entre telas.
import { esc, ICON } from './ui.js';
import { friendlyDate, friendlyTime, formatDuration, ymd } from './dates.js';

export function missionRow(store, item, date, { showDate = false } = {}) {
  const day = date || item.date || ymd(store.now());
  const done = store.isDone(item, item.recurrence ? day : undefined);
  const today = ymd(store.now());
  const late = !done && item.kind === 'task' && item.date && item.date < today && !item.recurrence;
  const goal = item.goalId ? store.getGoal(item.goalId) : null;
  const meta = [];
  if (item.kind === 'event') meta.push('<span class="tag event">compromisso</span>');
  if (late) meta.push(`<span class="tag late">atrasada · ${esc(friendlyDate(item.date, store.now()))}</span>`);
  else if (showDate && item.date) meta.push(`<span>${esc(friendlyDate(item.date, store.now()))}</span>`);
  if (item.time) meta.push(`<span>${esc(friendlyTime(item.time))}${item.duration ? ` · ${esc(formatDuration(item.duration))}` : ''}</span>`);
  else if (item.duration) meta.push(`<span>${esc(formatDuration(item.duration))}</span>`);
  if (item.priority === 1) meta.push('<span class="tag prio">importante</span>');
  if (goal) meta.push(`<span class="tag goal">⚑ ${esc(goal.title)}</span>`);
  if (item.recurrence) meta.push('<span>↻</span>');
  if (item.postponed >= 2 && !done) meta.push(`<span class="tag">adiada ${item.postponed}x</span>`);
  return `<div class="mission ${done ? 'done' : ''}" data-id="${item.id}">
    <button class="check" data-action="toggle" data-id="${item.id}" data-date="${day}" aria-label="${done ? 'Desmarcar' : 'Concluir'} ${esc(item.title)}">${ICON.check}</button>
    <button class="m-body" data-action="open-item" data-id="${item.id}">
      <span class="m-title">${esc(item.title)}</span>
      ${meta.length ? `<span class="m-meta">${meta.join('')}</span>` : ''}
    </button>
  </div>`;
}

export function levelChip(store) {
  return `<button class="chip-level" data-action="go" data-to="conquistas" aria-label="Nível e conquistas"><b>Nv ${store.level()}</b>${store.state.stats.xp} XP</button>`;
}
