// Banco de dados local do GUIA.
// Persiste no localStorage do aparelho (funciona offline, sem conta).
// O armazenamento é injetável para permitir testes automatizados no Node.

import { ymd, parseYmd, addDays, diffDays, toMinutes } from './dates.js';

const KEY = 'guia.v1';
export const SCHEMA_VERSION = 1;

export const LEVEL_XP = 100; // XP por nível

export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    profile: {
      name: '',
      onboarded: false,
      strictness: 'equilibrado', // suave | equilibrado | exigente
      chargeMode: true,          // modo cobrança ligado
      dailySummary: true,        // resumo do dia
      dayStart: '08:00',
      dayEnd: '22:00',
      busyBlocks: [],            // [{days:[1..5], start:'08:00', end:'12:00', label:'Aula'}]
      notifications: false,
      summaryTime: '21:00',
      voice: true,
      speak: false,
      saveChat: true,
      llmEnabled: false,
      llmUrl: 'http://localhost:11434',
      llmModel: 'llama3.2:3b',
      llmContext: true,
    },
    mascot: { hat: 'classico', accessory: 'nenhum', scarf: 'amarelo' },
    items: [],    // tarefas e eventos
    goals: [],    // jornadas
    messages: [], // histórico da conversa
    stats: {
      xp: 0,
      unlocked: ['classico', 'nenhum', 'amarelo'],
      achievements: [],
      history: {},      // { 'YYYY-MM-DD': nº de concluídas }
      lastOpen: null,
      returns: 0,       // retomadas após ausência
      focusSessions: 0,
      focusMinutes: 0,
    },
    notified: {},       // lembretes já disparados { itemId@data: true }
  };
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

export function createStore(storage = (typeof localStorage !== 'undefined' ? localStorage : memoryStorage()), clock = () => new Date()) {
  let state;
  const listeners = new Set();

  function load() {
    try {
      const raw = storage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const base = defaultState();
      state = parsed
        ? { ...base, ...parsed, profile: { ...base.profile, ...parsed.profile }, mascot: { ...base.mascot, ...parsed.mascot }, stats: { ...base.stats, ...parsed.stats } }
        : base;
    } catch (e) {
      console.error('Falha ao ler dados, iniciando vazio', e);
      state = defaultState();
    }
  }

  /** Grava e confirma. Retorna false se o aparelho recusar (ex.: espaço cheio). */
  function save() {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      listeners.forEach((fn) => fn(state));
      return true;
    } catch (e) {
      console.error('Falha ao salvar', e);
      return false;
    }
  }

  function fail(msg) { return { ok: false, error: msg }; }

  load();

  const api = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reload: load,
    now: clock,

    // ---------- Perfil ----------
    updateProfile(patch) { Object.assign(state.profile, patch); return save() ? { ok: true } : fail('save'); },
    updateMascot(patch) { Object.assign(state.mascot, patch); return save() ? { ok: true } : fail('save'); },

    // ---------- Itens (tarefas e eventos) ----------
    addItem(data) {
      const title = (data.title || '').trim();
      if (!title) return fail('Título vazio');
      const item = {
        id: uid(),
        title,
        kind: data.kind || 'task',           // task | event
        date: data.date || null,
        time: data.time || null,
        duration: data.duration || null,
        recurrence: data.recurrence || null, // null | daily | weekdays | weekly | monthly
        priority: data.priority || 2,        // 1 alta, 2 normal, 3 baixa
        notes: data.notes || '',
        goalId: data.goalId || null,
        stepId: data.stepId || null,
        parentId: data.parentId || null,
        remind: data.remind !== undefined ? data.remind : Boolean(data.time),
        done: false,
        doneAt: null,
        doneDates: [],
        postponed: 0,
        createdAt: clock().toISOString(),
        demo: Boolean(data.demo),
      };
      state.items.push(item);
      return save() ? { ok: true, item } : (state.items.pop(), fail('save'));
    },

    getItem(id) { return state.items.find((i) => i.id === id) || null; },

    updateItem(id, patch) {
      const item = api.getItem(id);
      if (!item) return fail('Item não encontrado');
      const before = { ...item };
      Object.assign(item, patch);
      if (!save()) { Object.assign(item, before); return fail('save'); }
      return { ok: true, item };
    },

    /** Remarca sem duplicar: altera o próprio item e conta o adiamento. */
    reschedule(id, { date, time }) {
      const item = api.getItem(id);
      if (!item) return fail('Item não encontrado');
      const later = date && item.date && date > item.date;
      const patch = { date: date !== undefined ? date : item.date };
      if (time !== undefined) patch.time = time;
      if (later) patch.postponed = (item.postponed || 0) + 1;
      if (patch.date !== item.date || patch.time !== item.time) {
        // novo horário = novo lembrete
        Object.keys(state.notified).filter((k) => k.startsWith(id)).forEach((k) => delete state.notified[k]);
      }
      return api.updateItem(id, patch);
    },

    removeItem(id) {
      const idx = state.items.findIndex((i) => i.id === id);
      if (idx < 0) return fail('Item não encontrado');
      const [removed] = state.items.splice(idx, 1);
      // desvincula etapa de objetivo
      for (const g of state.goals) for (const s of g.steps) if (s.taskId === id) s.taskId = null;
      if (!save()) { state.items.splice(idx, 0, removed); return fail('save'); }
      return { ok: true, item: removed };
    },

    isDone(item, date) {
      if (item.recurrence) return item.doneDates.includes(date || ymd(clock()));
      return item.done;
    },

    /** Conclui (ou desfaz). Para recorrentes, marca só a ocorrência do dia. */
    toggleDone(id, date) {
      const item = api.getItem(id);
      if (!item) return fail('Item não encontrado');
      const day = date || item.date || ymd(clock());
      const today = ymd(clock());
      let nowDone;
      if (item.recurrence) {
        const i = item.doneDates.indexOf(day);
        if (i >= 0) item.doneDates.splice(i, 1); else item.doneDates.push(day);
        nowDone = i < 0;
      } else {
        item.done = !item.done;
        item.doneAt = item.done ? clock().toISOString() : null;
        nowDone = item.done;
      }
      const delta = nowDone ? 1 : -1;
      state.stats.history[today] = Math.max(0, (state.stats.history[today] || 0) + delta);
      const xp = item.kind === 'event' ? 5 : item.priority === 1 ? 15 : 10;
      state.stats.xp = Math.max(0, state.stats.xp + delta * xp);
      let stepDone = null;
      if (item.stepId) {
        const g = state.goals.find((x) => x.id === item.goalId);
        const s = g?.steps.find((x) => x.id === item.stepId);
        if (s && s.done !== nowDone) {
          s.done = nowDone; s.doneAt = nowDone ? clock().toISOString() : null;
          state.stats.xp = Math.max(0, state.stats.xp + delta * 20);
          stepDone = nowDone ? { goal: g, step: s } : null;
        }
      }
      const newAchievements = nowDone ? checkAchievements() : [];
      if (!save()) return fail('save');
      return { ok: true, item, done: nowDone, xp: delta * xp, stepDone, achievements: newAchievements };
    },

    /** Ocorrências de um dia (expande recorrências). */
    itemsOn(dateStr) {
      const d = parseYmd(dateStr);
      return state.items.filter((it) => {
        if (!it.date) return false;
        if (!it.recurrence) return it.date === dateStr;
        if (dateStr < it.date) return false;
        const start = parseYmd(it.date);
        switch (it.recurrence) {
          case 'daily': return true;
          case 'weekdays': return d.getDay() >= 1 && d.getDay() <= 5;
          case 'weekly': return d.getDay() === start.getDay();
          case 'monthly': return d.getDate() === start.getDate();
          default: return false;
        }
      }).sort(byTime);
    },

    /** Tarefas sem data e não concluídas. */
    inbox() { return state.items.filter((i) => !i.date && !i.done && i.kind === 'task'); },

    /** Tarefas atrasadas (data passada, não concluídas, não recorrentes). */
    overdue() {
      const today = ymd(clock());
      return state.items.filter((i) => i.kind === 'task' && !i.recurrence && !i.done && i.date && i.date < today).sort(byDate);
    },

    /** Itens pendentes de hoje + atrasados, ordenados por prioridade. */
    todayAgenda() {
      const today = ymd(clock());
      return { today: api.itemsOn(today), overdue: api.overdue(), inbox: api.inbox() };
    },

    /** Busca por título aproximado (para "terminei X", "apaga X"). */
    findItems(query, { includeDone = false } = {}) {
      const q = norm(query);
      if (!q) return [];
      const words = q.split(' ').filter((w) => w.length > 2);
      const scored = state.items
        .filter((i) => includeDone || !api.isDone(i, i.recurrence ? ymd(clock()) : undefined))
        .map((i) => {
          const t = norm(i.title);
          let score = 0;
          if (t === q) score = 100;
          else if (t.includes(q) || q.includes(t)) score = 60;
          else score = words.filter((w) => t.includes(w)).length * 15;
          return { i, score };
        })
        .filter((x) => x.score >= 15)
        .sort((a, b) => b.score - a.score || (a.i.date || '9').localeCompare(b.i.date || '9'));
      if (!scored.length) return [];
      const top = scored[0].score;
      return scored.filter((x) => x.score === top).map((x) => x.i);
    },

    /** Conflitos de horário com um intervalo proposto. */
    conflicts(date, time, duration = 60, ignoreId = null) {
      if (!date || !time) return [];
      const a = toMinutes(time);
      const b = a + (duration || 60);
      return api.itemsOn(date).filter((i) => i.id !== ignoreId && i.time && !api.isDone(i, date)).filter((i) => {
        const s = toMinutes(i.time);
        const e = s + (i.duration || (i.kind === 'event' ? 60 : 30));
        return a < e && s < b;
      });
    },

    /** Intervalos livres de um dia, considerando compromissos e blocos fixos. */
    freeSlots(date, { from, to, minDuration = 15 } = {}) {
      const p = state.profile;
      let start = toMinutes(from || p.dayStart);
      const end = toMinutes(to || p.dayEnd);
      const d = parseYmd(date);
      if (date === ymd(clock())) {
        const n = clock();
        const nowMin = Math.ceil((n.getHours() * 60 + n.getMinutes()) / 15) * 15;
        start = Math.max(start, nowMin);
      }
      const busy = api.itemsOn(date).filter((i) => i.time && !api.isDone(i, date)).map((i) => [toMinutes(i.time), toMinutes(i.time) + (i.duration || (i.kind === 'event' ? 60 : 30))]);
      for (const b of p.busyBlocks || []) if (b.days.includes(d.getDay())) busy.push([toMinutes(b.start), toMinutes(b.end)]);
      busy.sort((x, y) => x[0] - y[0]);
      const slots = [];
      let cur = start;
      for (const [s, e] of busy) {
        if (s > cur && Math.min(s, end) - cur >= minDuration) slots.push([cur, Math.min(s, end)]);
        cur = Math.max(cur, e);
        if (cur >= end) break;
      }
      if (end - cur >= minDuration) slots.push([cur, end]);
      return slots;
    },

    /** Carga do dia em minutos (estimativa: tarefas sem duração = 30 min). */
    dayLoad(date) {
      return api.itemsOn(date).filter((i) => !api.isDone(i, date)).reduce((s, i) => s + (i.duration || (i.kind === 'event' ? 60 : 30)), 0);
    },

    // ---------- Objetivos / Jornadas ----------
    addGoal({ title, steps = [], icon = 'bandeira', demo = false }) {
      if (!title?.trim()) return fail('Título vazio');
      const goal = {
        id: uid(), title: title.trim(), icon, createdAt: clock().toISOString(), archived: false, demo,
        steps: steps.map((s) => ({ id: uid(), title: s, done: false, doneAt: null, taskId: null })),
      };
      state.goals.push(goal);
      return save() ? { ok: true, goal } : (state.goals.pop(), fail('save'));
    },
    getGoal(id) { return state.goals.find((g) => g.id === id) || null; },
    updateGoal(id, patch) {
      const g = api.getGoal(id);
      if (!g) return fail('Objetivo não encontrado');
      Object.assign(g, patch);
      return save() ? { ok: true, goal: g } : fail('save');
    },
    removeGoal(id) {
      const idx = state.goals.findIndex((g) => g.id === id);
      if (idx < 0) return fail('Objetivo não encontrado');
      const [g] = state.goals.splice(idx, 1);
      state.items.forEach((i) => { if (i.goalId === id) { i.goalId = null; i.stepId = null; } });
      return save() ? { ok: true, goal: g } : fail('save');
    },
    addStep(goalId, title) {
      const g = api.getGoal(goalId);
      if (!g || !title?.trim()) return fail('Dados inválidos');
      const step = { id: uid(), title: title.trim(), done: false, doneAt: null, taskId: null };
      g.steps.push(step);
      return save() ? { ok: true, step } : fail('save');
    },
    removeStep(goalId, stepId) {
      const g = api.getGoal(goalId);
      if (!g) return fail('Objetivo não encontrado');
      g.steps = g.steps.filter((s) => s.id !== stepId);
      state.items.forEach((i) => { if (i.stepId === stepId) i.stepId = null; });
      return save() ? { ok: true } : fail('save');
    },
    /** Conclui etapa diretamente (e a tarefa vinculada, se houver). */
    toggleStep(goalId, stepId) {
      const g = api.getGoal(goalId);
      const s = g?.steps.find((x) => x.id === stepId);
      if (!s) return fail('Etapa não encontrada');
      const linked = s.taskId && api.getItem(s.taskId);
      if (linked && !linked.recurrence) return api.toggleDone(linked.id);
      s.done = !s.done;
      s.doneAt = s.done ? clock().toISOString() : null;
      state.stats.xp = Math.max(0, state.stats.xp + (s.done ? 20 : -20));
      const today = ymd(clock());
      state.stats.history[today] = Math.max(0, (state.stats.history[today] || 0) + (s.done ? 1 : -1));
      const achievements = s.done ? checkAchievements() : [];
      return save() ? { ok: true, done: s.done, xp: s.done ? 20 : -20, stepDone: s.done ? { goal: g, step: s } : null, achievements } : fail('save');
    },
    /** Transforma etapa em tarefa agendada. */
    scheduleStep(goalId, stepId, { date, time, duration }) {
      const g = api.getGoal(goalId);
      const s = g?.steps.find((x) => x.id === stepId);
      if (!s) return fail('Etapa não encontrada');
      if (s.taskId && api.getItem(s.taskId)) return api.reschedule(s.taskId, { date, time });
      const r = api.addItem({ title: s.title, date, time, duration, goalId, stepId });
      if (r.ok) { s.taskId = r.item.id; save(); }
      return r;
    },
    goalProgress(g) {
      if (!g.steps.length) return 0;
      return g.steps.filter((s) => s.done).length / g.steps.length;
    },

    // ---------- Conversa ----------
    addMessage(from, text, extra = {}) {
      const msg = { id: uid(), from, text, at: clock().toISOString(), ...extra };
      state.messages.push(msg);
      if (state.messages.length > 300) state.messages = state.messages.slice(-300);
      if (state.profile.saveChat) save(); else listeners.forEach((fn) => fn(state));
      return msg;
    },
    clearMessages() { state.messages = []; return save() ? { ok: true } : fail('save'); },

    // ---------- Progresso ----------
    level() { return Math.floor(state.stats.xp / LEVEL_XP) + 1; },
    levelProgress() { return (state.stats.xp % LEVEL_XP) / LEVEL_XP; },

    /** Registra abertura do app. Retorna quantos dias ficou ausente. */
    registerOpen() {
      const today = ymd(clock());
      const last = state.stats.lastOpen;
      const away = last ? diffDays(parseYmd(last), parseYmd(today)) : 0;
      if (last !== today) {
        if (away >= 3) state.stats.returns += 1;
        state.stats.lastOpen = today;
        if (away >= 3) checkAchievements();
        save();
      }
      return away;
    },

    unlock(key) {
      if (!state.stats.unlocked.includes(key)) { state.stats.unlocked.push(key); save(); }
    },

    recordFocus(minutes) {
      state.stats.focusSessions += 1;
      state.stats.focusMinutes += minutes;
      state.stats.xp += Math.min(30, Math.round(minutes / 2));
      const ach = checkAchievements();
      save();
      return ach;
    },

    /** Estatísticas para personalização (regras explícitas, não "IA"). */
    insights() {
      const done = state.items.filter((i) => i.doneAt);
      const byPeriod = { manha: 0, tarde: 0, noite: 0 };
      for (const i of done) {
        const h = new Date(i.doneAt).getHours();
        if (h < 12) byPeriod.manha++; else if (h < 18) byPeriod.tarde++; else byPeriod.noite++;
      }
      const total = done.length;
      const best = total >= 5 ? Object.entries(byPeriod).sort((a, b) => b[1] - a[1])[0][0] : null;
      const stuck = state.items.filter((i) => !i.done && (i.postponed || 0) >= 3);
      const last7 = Array.from({ length: 7 }, (_, k) => state.stats.history[ymd(addDays(clock(), -k))] || 0);
      return { total, byPeriod, bestPeriod: best, stuck, last7, activeDays7: last7.filter(Boolean).length };
    },

    // ---------- Dados ----------
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(json) {
      try {
        const data = JSON.parse(json);
        if (!data || !Array.isArray(data.items) || !Array.isArray(data.goals)) return fail('Arquivo inválido');
        storage.setItem(KEY, JSON.stringify(data));
        load();
        save();
        return { ok: true };
      } catch (e) { return fail('Arquivo inválido'); }
    },
    removeDemo() {
      state.items = state.items.filter((i) => !i.demo);
      state.goals = state.goals.filter((g) => !g.demo);
      return save() ? { ok: true } : fail('save');
    },
    hasDemo() { return state.items.some((i) => i.demo) || state.goals.some((g) => g.demo); },
    resetAll() { state = defaultState(); return save() ? { ok: true } : fail('save'); },
    markNotified(key) { state.notified[key] = true; save(); },
    wasNotified(key) { return Boolean(state.notified[key]); },
  };

  // ---------- Conquistas ----------
  function checkAchievements() {
    const st = state.stats;
    const got = [];
    const totalDone = Object.values(st.history).reduce((a, b) => a + b, 0);
    const goalsDone = state.goals.filter((g) => g.steps.length && g.steps.every((s) => s.done)).length;
    const stepsDone = state.goals.reduce((a, g) => a + g.steps.filter((s) => s.done).length, 0);
    const level = Math.floor(st.xp / LEVEL_XP) + 1;
    for (const a of ACHIEVEMENTS) {
      if (st.achievements.includes(a.id)) continue;
      const ok = a.test({ totalDone, goalsDone, stepsDone, level, stats: st, state });
      if (ok) {
        st.achievements.push(a.id);
        if (a.unlock && !st.unlocked.includes(a.unlock)) st.unlocked.push(a.unlock);
        got.push(a);
      }
    }
    return got;
  }
  api.checkAchievements = () => { const r = checkAchievements(); save(); return r; };

  return api;
}

// Conquistas ligadas a ações reais. Valorizam retomada e avanço, não só sequência.
export const ACHIEVEMENTS = [
  { id: 'primeira', title: 'Primeiro passo', desc: 'Concluiu a primeira missão.', unlock: 'flor', test: (c) => c.totalDone >= 1 },
  { id: 'dez', title: 'Mochila cheia', desc: '10 missões concluídas.', unlock: 'bussola', test: (c) => c.totalDone >= 10 },
  { id: 'cinquenta', title: 'Andarilho', desc: '50 missões concluídas.', unlock: 'chapeu-explorador', test: (c) => c.totalDone >= 50 },
  { id: 'etapa', title: 'Bandeira fincada', desc: 'Concluiu a primeira etapa de uma jornada.', unlock: 'azul', test: (c) => c.stepsDone >= 1 },
  { id: 'jornada', title: 'Jornada completa', desc: 'Terminou todas as etapas de um objetivo.', unlock: 'coroa', test: (c) => c.goalsDone >= 1 },
  { id: 'retomada', title: 'De volta à trilha', desc: 'Voltou depois de alguns dias fora. Isso conta.', unlock: 'vinho', test: (c) => c.stats.returns >= 1 },
  { id: 'foco', title: 'Cabeça no lugar', desc: 'Completou 3 sessões de foco.', unlock: 'lanterna', test: (c) => c.stats.focusSessions >= 3 },
  { id: 'nivel3', title: 'Festa no mapa', desc: 'Chegou ao nível 3.', unlock: 'festa', test: (c) => c.level >= 3 },
  { id: 'nivel5', title: 'Explorador nível 5', desc: 'Chegou ao nível 5.', unlock: 'chapeu-pirata', test: (c) => c.level >= 5 },
];

function byTime(a, b) { return (a.time || '99:99').localeCompare(b.time || '99:99') || a.priority - b.priority; }
function byDate(a, b) { return (a.date || '').localeCompare(b.date || ''); }
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
