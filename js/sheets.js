// Folhas de criação/edição: tarefa ou compromisso, objetivo, etapa, resumo do dia.
import { esc, ICON, openSheet, closeSheet, toast, confirmSheet, mascot } from './ui.js';
import { ymd, friendlyDate, friendlyTime, addDays } from './dates.js';
import { stepsFor, daySummary } from './planner.js';
import { buildICS, deliverFile } from './ics.js';
import { describe } from './brain.js';
import { ACHIEVEMENTS } from './store.js';

const val = (sh, name) => sh.querySelector(`[name="${name}"]`)?.value?.trim() ?? '';

// ---------------- Tarefa / compromisso ----------------
export function itemSheet(ctx, id = null, defaults = {}) {
  const { store } = ctx;
  const it = id ? store.getItem(id) : null;
  if (id && !it) { toast('Esse item não existe mais.', 'confused'); return; }
  const d = it || { title: '', kind: 'task', date: defaults.date || ymd(store.now()), time: defaults.time || '', duration: '', recurrence: '', priority: 2, notes: '', goalId: '', remind: true };
  const goals = store.state.goals;
  const sh = openSheet(`
    <h2>${it ? 'Editar' : 'Nova missão'}</h2>
    <form id="item-form">
      <label class="field"><span>O quê?</span><input name="title" required maxlength="140" value="${esc(d.title)}" placeholder="Ex.: Comprar tinta"></label>
      <div class="seg" role="radiogroup" style="grid-template-columns:1fr 1fr">
        <button type="button" data-kind="task" class="${d.kind === 'task' ? 'on' : ''}">Tarefa</button>
        <button type="button" data-kind="event" class="${d.kind === 'event' ? 'on' : ''}">Compromisso</button>
      </div>
      <input type="hidden" name="kind" value="${d.kind}">
      <div class="row2">
        <label class="field"><span>Dia</span><input type="date" name="date" value="${esc(d.date || '')}"></label>
        <label class="field"><span>Horário</span><input type="time" name="time" value="${esc(d.time || '')}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Duração (min)</span><input type="number" name="duration" min="5" max="720" step="5" inputmode="numeric" value="${esc(d.duration || '')}"></label>
        <label class="field"><span>Repetir</span><select name="recurrence">
          ${[['', 'Não repete'], ['daily', 'Todo dia'], ['weekdays', 'Dias úteis'], ['weekly', 'Toda semana'], ['monthly', 'Todo mês']].map(([v, l]) => `<option value="${v}" ${d.recurrence === v || (!d.recurrence && !v) ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <div class="row2">
        <label class="field"><span>Importância</span><select name="priority">
          ${[[1, 'Alta'], [2, 'Normal'], [3, 'Baixa']].map(([v, l]) => `<option value="${v}" ${d.priority === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        <label class="field"><span>Jornada</span><select name="goalId"><option value="">Nenhuma</option>
          ${goals.map((g) => `<option value="${g.id}" ${d.goalId === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}
        </select></label>
      </div>
      <label class="field"><span>Notas</span><textarea name="notes" maxlength="1000">${esc(d.notes || '')}</textarea></label>
      <div class="toggle"><div>Lembrar no horário<small>Aviso dentro do app. Com o app fechado, use "Calendário".</small></div><label class="switch"><input type="checkbox" name="remind" ${d.remind ? 'checked' : ''}><i></i></label></div>
      <div id="item-warn"></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" type="submit">${ICON.check} Salvar</button>
        ${it ? `<button class="btn small" type="button" data-act="ics">${ICON.download} Calendário</button><button class="btn small" type="button" data-act="focus">${ICON.focus} Focar</button><button class="btn small ghost" type="button" data-act="delete" style="color:var(--wine)">${ICON.trash} Apagar</button>` : ''}
      </div>
      ${it?.postponed ? `<p class="small muted">Adiada ${it.postponed} vez${it.postponed > 1 ? 'es' : ''}.</p>` : ''}
    </form>`);
  sh.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    sh.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
    sh.querySelector('[name=kind]').value = b.dataset.kind;
  }));
  let conflictOk = false;
  sh.querySelector('#item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: val(sh, 'title'), kind: val(sh, 'kind'), date: val(sh, 'date') || null, time: val(sh, 'time') || null,
      duration: Number(val(sh, 'duration')) || null, recurrence: val(sh, 'recurrence') || null, priority: Number(val(sh, 'priority')),
      goalId: val(sh, 'goalId') || null, notes: val(sh, 'notes'), remind: sh.querySelector('[name=remind]').checked,
    };
    if (!data.title) return;
    if (data.kind === 'event' && !data.date) { sh.querySelector('#item-warn').innerHTML = '<div class="notice warn">Compromisso precisa de um dia.</div>'; return; }
    const c = store.conflicts(data.date, data.time, data.duration || 30, it?.id);
    if (c.length && !conflictOk) {
      conflictOk = true;
      sh.querySelector('#item-warn').innerHTML = `<div class="conflict">⚠ Bate com "${esc(c[0].title)}" às ${esc(friendlyTime(c[0].time))}. Toca em Salvar de novo pra manter mesmo assim.</div>`;
      return;
    }
    let res;
    if (it) {
      const moved = data.date !== it.date || data.time !== it.time;
      if (moved) res = store.reschedule(it.id, { date: data.date, time: data.time });
      if (!moved || res.ok) res = store.updateItem(it.id, { ...data, date: data.date, time: data.time });
    } else res = store.addItem(data);
    if (!res.ok) { toast('Não consegui salvar. Nada foi alterado.', 'worried'); return; }
    closeSheet();
    toast(it ? 'Atualizado.' : `Anotado: ${describe(res.item)}`, 'happy');
    ctx.render();
  });
  sh.querySelector('[data-act=delete]')?.addEventListener('click', async () => {
    if (!(await confirmSheet(`Apagar "${it.title}"?`, 'Apagar', true))) return;
    const r = store.removeItem(it.id);
    toast(r.ok ? 'Apagado.' : 'Não consegui apagar.', r.ok ? 'happy' : 'worried');
    ctx.render();
  });
  sh.querySelector('[data-act=ics]')?.addEventListener('click', async () => {
    if (!it.date) { toast('Coloca um dia antes de mandar pro calendário.', 'confused'); return; }
    const how = await deliverFile(`${it.title.slice(0, 40)}.ics`, buildICS([it]), 'text/calendar');
    if (how !== 'cancelled') toast('Arquivo do calendário gerado. Abre ele pra adicionar com alarme.', 'happy', 3500);
  });
  sh.querySelector('[data-act=focus]')?.addEventListener('click', () => { closeSheet(); ctx.focusId = it.id; ctx.go('foco'); });
}

// ---------------- Objetivo / jornada ----------------
export function goalSheet(ctx, id = null) {
  const { store } = ctx;
  const g = id ? store.getGoal(id) : null;
  const sh = openSheet(`
    <h2>${g ? 'Editar jornada' : 'Nova jornada'}</h2>
    <form id="goal-form">
      <label class="field"><span>Objetivo</span><input name="title" required maxlength="100" value="${esc(g?.title || '')}" placeholder="Ex.: Melhorar minha divulgação"></label>
      <label class="field"><span>Etapas (uma por linha)</span><textarea name="steps" rows="7" placeholder="Cada linha vira um ponto no mapa">${esc((g?.steps || []).map((s) => s.title).join('\n'))}</textarea></label>
      ${g ? '<p class="small muted">Etapas já concluídas mantêm o progresso se o texto não mudar.</p>' : '<button type="button" class="btn small sky" data-act="suggest">Sugerir etapas</button>'}
      <div class="btn-row" style="margin-top:14px"><button class="btn primary" type="submit">${ICON.flag} Salvar</button>
      ${g ? `<button class="btn small ghost" type="button" data-act="delete" style="color:var(--wine)">${ICON.trash} Apagar jornada</button>` : ''}</div>
    </form>`);
  sh.querySelector('[data-act=suggest]')?.addEventListener('click', () => {
    const t = val(sh, 'title');
    if (!t) { sh.querySelector('[name=title]').focus(); return; }
    const { steps, template } = stepsFor(t);
    sh.querySelector('[name=steps]').value = steps.join('\n');
    if (!template) toast('Não tenho modelo específico pra isso. Coloquei etapas genéricas, ajusta à vontade.', 'thinking', 3500);
  });
  sh.querySelector('#goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = val(sh, 'title');
    const lines = val(sh, 'steps').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20);
    if (!title) return;
    let res;
    if (!g) {
      res = store.addGoal({ title, steps: lines.length ? lines : stepsFor(title).steps, icon: stepsFor(title).icon });
    } else {
      const old = g.steps;
      const steps = lines.map((t) => old.find((s) => s.title === t) || { id: Math.random().toString(36).slice(2, 9), title: t, done: false, doneAt: null, taskId: null });
      res = store.updateGoal(g.id, { title, steps });
    }
    if (!res.ok) { toast('Não consegui salvar.', 'worried'); return; }
    closeSheet();
    ctx.selectGoal?.((res.goal || g).id);
    toast(g ? 'Jornada atualizada.' : 'Jornada criada! Olha o mapa.', 'excited');
    ctx.render();
  });
  sh.querySelector('[data-act=delete]')?.addEventListener('click', async () => {
    if (!(await confirmSheet(`Apagar a jornada "${g.title}"? As tarefas continuam na agenda.`, 'Apagar', true))) return;
    store.removeGoal(g.id);
    ctx.render();
  });
}

export function stepSheet(ctx, goalId, stepId) {
  const { store } = ctx;
  const g = store.getGoal(goalId);
  const s = g?.steps.find((x) => x.id === stepId);
  if (!s) return;
  const task = s.taskId ? store.getItem(s.taskId) : null;
  const sh = openSheet(`
    <h2>${esc(s.title)}</h2>
    <p class="small muted" style="margin-top:-6px">Etapa ${g.steps.indexOf(s) + 1} de ${g.steps.length} · ${esc(g.title)}</p>
    ${task ? `<div class="notice">Na agenda: ${esc(describe(task))}</div>` : ''}
    <form id="step-form">
      <div class="row2"><label class="field"><span>Quando fazer</span><input type="date" name="date" value="${esc(task?.date || ymd(store.now()))}"></label>
      <label class="field"><span>Horário</span><input type="time" name="time" value="${esc(task?.time || '')}"></label></div>
      <div class="btn-row"><button class="btn sun" type="submit">${ICON.agenda} ${task ? 'Remarcar' : 'Colocar na agenda'}</button>
      <button class="btn ${s.done ? '' : 'primary'}" type="button" data-act="toggle">${ICON.check} ${s.done ? 'Desmarcar' : 'Concluir etapa'}</button></div>
      <div class="btn-row" style="margin-top:10px"><button class="btn small" type="button" data-act="focus">${ICON.focus} Focar nisso</button>
      <button class="btn small ghost" type="button" data-act="delete" style="color:var(--wine)">${ICON.trash} Remover etapa</button></div>
    </form>`);
  sh.querySelector('#step-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = store.scheduleStep(goalId, stepId, { date: val(sh, 'date') || null, time: val(sh, 'time') || null });
    toast(r.ok ? 'Etapa na agenda.' : 'Não consegui agendar.', r.ok ? 'happy' : 'worried');
    closeSheet(); ctx.render();
  });
  sh.querySelector('[data-act=toggle]').addEventListener('click', () => { closeSheet(); ctx.toggleStep(goalId, stepId); });
  sh.querySelector('[data-act=focus]').addEventListener('click', () => {
    let tid = s.taskId;
    if (!tid || !store.getItem(tid)) { const r = store.scheduleStep(goalId, stepId, { date: ymd(store.now()) }); tid = r.item?.id; }
    closeSheet(); ctx.focusId = tid; ctx.go('foco');
  });
  sh.querySelector('[data-act=delete]').addEventListener('click', async () => {
    if (!(await confirmSheet('Remover essa etapa?', 'Remover', true))) return;
    store.removeStep(goalId, stepId); ctx.render();
  });
}

export function addStepSheet(ctx, goalId) {
  const sh = openSheet(`<h2>Nova etapa</h2><form id="f"><label class="field"><span>Etapa</span><input name="t" required maxlength="120" placeholder="Ex.: Fazer o esboço"></label><button class="btn primary">${ICON.plus} Adicionar</button></form>`);
  sh.querySelector('#f').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = ctx.store.addStep(goalId, val(sh, 't'));
    closeSheet(); toast(r.ok ? 'Etapa adicionada ao mapa.' : 'Não consegui adicionar.', r.ok ? 'happy' : 'worried'); ctx.render();
  });
}

// ---------------- Resumo do dia ----------------
export function summarySheet(ctx) {
  const { store } = ctx;
  const s = daySummary(store);
  const today = ymd(store.now());
  const sh = openSheet(`
    <div style="display:flex;gap:10px;align-items:center">${mascot(s.done.length ? 'proud' : 'resting', '', '')}<h2 style="margin:0">Resumo do dia</h2></div>
    <section class="card"><h2>✓ Concluídas <span class="count">${s.done.length}</span></h2>${s.done.length ? s.done.map((i) => `<div class="small">• ${esc(i.title)}</div>`).join('') : '<p class="small muted" style="margin:0">Nada concluído hoje. Amanhã é outro mapa.</p>'}</section>
    <section class="card"><h2>○ Pendentes <span class="count">${s.pending.length}</span></h2>${s.pending.length ? s.pending.map((i) => `<div class="small">• ${esc(i.title)}</div>`).join('') : '<p class="small muted" style="margin:0">Nenhuma.</p>'}</section>
    ${s.goalsMoved.length ? `<section class="card"><h2>⚑ Jornadas que avançaram</h2>${s.goalsMoved.map((g) => `<div class="small">• ${esc(g.title)}</div>`).join('')}</section>` : ''}
    <section class="card" style="background:var(--sun-soft)"><h2>Pra amanhã</h2>${s.tips.map((t) => `<p class="small" style="margin:0 0 6px">${esc(t)}</p>`).join('')}</section>
    <div class="btn-row">${s.pending.some((i) => i.kind === 'task' && !i.recurrence) ? '<button class="btn sun" data-act="move">Passar pendentes pra amanhã</button>' : ''}
    <button class="btn ghost" data-act="pause">Pausar resumos</button></div>`);
  sh.querySelector('.mascot').style.width = '64px';
  sh.querySelector('[data-act=move]')?.addEventListener('click', async () => {
    const ids = s.pending.filter((i) => i.kind === 'task' && !i.recurrence).map((i) => i.id);
    if (!(await confirmSheet(`Mover ${ids.length} tarefa${ids.length > 1 ? 's' : ''} para amanhã?`, 'Mover'))) return;
    const t = ymd(addDays(store.now(), 1));
    const n = ids.filter((id) => store.reschedule(id, { date: t }).ok).length;
    toast(`${n} tarefa${n > 1 ? 's' : ''} pra amanhã.`, 'happy'); ctx.render();
  });
  sh.querySelector('[data-act=pause]').addEventListener('click', () => { store.updateProfile({ dailySummary: false }); closeSheet(); toast('Resumos pausados. Dá pra religar nos Ajustes.', 'resting'); ctx.render(); });
  void today;
}

export function achievementSheet(ctx, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  const got = ctx.store.state.stats.achievements.includes(id);
  openSheet(`<h2>${got ? '🏅' : '🔒'} ${esc(a.title)}</h2><p>${esc(a.desc)}</p>${a.unlock ? `<p class="small muted">Recompensa: ${esc(UNLOCK_LABEL[a.unlock] || a.unlock)} para o Guia.</p>` : ''}<button class="btn" onclick="document.querySelector('.sheet-bg').click()">Fechar</button>`);
}

export const UNLOCK_LABEL = {
  flor: 'flor no chapéu', bussola: 'bússola', 'chapeu-explorador': 'chapéu de explorador', azul: 'tênis azul', coroa: 'coroa',
  vinho: 'tênis vinho', lanterna: 'lanterna', 'chapeu-pirata': 'chapéu de pirata', festa: 'chapéu de festa',
};

export function installSheet() {
  openSheet(`<h2>Instalar no iPhone</h2>
    <ol style="padding-left:20px;line-height:1.6;font-weight:600">
      <li>Abra o endereço do GUIA no <b>Safari</b>.</li>
      <li>Toque em <b>Compartilhar</b> (quadrado com seta para cima).</li>
      <li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li>
      <li>Abra pelo ícone. Ele roda em tela cheia, sem barra do navegador, e funciona offline.</li>
    </ol>
    <h2 style="font-size:20px;margin-top:14px">No MacBook</h2>
    <p class="small">Safari 17+ (macOS Sonoma): menu Arquivo → <b>Adicionar ao Dock</b>. Chrome: ícone de instalar na barra de endereço. No macOS Monterey, use pelo Chrome ou como aba fixa no Safari.</p>
    <div class="notice warn">Os dados ficam no aparelho. iPhone e Mac não sincronizam sozinhos: use Ajustes → Exportar/Importar para levar os dados de um para o outro.</div>
    <button class="btn" onclick="document.querySelector('.sheet-bg').click()">Entendi</button>`);
}
