// Planejamento por regras: modelos de etapas, priorização, "Me salva",
// plano da semana e resumo do dia. Tudo calculado com dados locais.

import { ymd, parseYmd, addDays, diffDays, toMinutes, fromMinutes } from './dates.js';
import { normalize } from './parser.js';

// ---------- Modelos de etapas para objetivos ----------
const TEMPLATES = [
  { match: /trabalho|tcc|artigo|monografia|relatorio|seminario|apresentacao|faculdade|prova|entrega/, icon: 'livro', steps: [
    'Reler o enunciado e anotar o que é pedido', 'Juntar referências e materiais', 'Fazer um esboço da estrutura',
    'Escrever a primeira versão', 'Revisar e ajustar formatação', 'Entregar'] },
  { match: /divulga|instagram|tiktok|redes|marketing|seguidores|cliente|portfolio|marca/, icon: 'megafone', steps: [
    'Definir o público e o que quer comunicar', 'Revisar perfil: bio, destaques e link', 'Listar 10 ideias de conteúdo',
    'Planejar posts da semana', 'Publicar e responder comentários', 'Ver números da semana e ajustar'] },
  { match: /aprender|curso|estudar|idioma|ingles|habilidade|desenhar|tocar/, icon: 'bussola', steps: [
    'Escolher um material ou curso', 'Definir horário fixo de prática', 'Fazer a primeira sessão de 30 min',
    'Praticar 3 vezes na semana', 'Fazer um pequeno projeto com o que aprendeu', 'Revisar o que ficou difícil'] },
  { match: /organiza|rotina|habito|produtiv|agenda|bagunca/, icon: 'mapa', steps: [
    'Anotar tudo que está pendente', 'Escolher 3 prioridades da semana', 'Montar uma rotina simples de manhã',
    'Revisar a agenda todo domingo', 'Fazer o fechamento do dia por uma semana'] },
  { match: /exercicio|academia|correr|saude|treino|caminhar|alimenta/, icon: 'montanha', steps: [
    'Escolher a atividade e o horário', 'Fazer a primeira sessão curta', 'Repetir 3 vezes na semana',
    'Aumentar um pouco a duração', 'Manter por 4 semanas'] },
  { match: /dinheiro|financ|economizar|guardar|orcamento|divida/, icon: 'bau', steps: [
    'Anotar gastos de uma semana', 'Separar gastos fixos e variáveis', 'Definir um valor para guardar',
    'Cortar um gasto que não faz falta', 'Revisar o mês'] },
  { match: /projeto|app|site|criar|lancar|produto|loja|evento/, icon: 'castelo', steps: [
    'Definir o resultado final em uma frase', 'Listar tudo que precisa ser feito', 'Fazer a primeira parte pequena',
    'Mostrar pra alguém e pegar opinião', 'Ajustar e finalizar', 'Lançar'] },
];

const DEFAULT_STEPS = ['Definir o que significa "concluído"', 'Dar o primeiro passo pequeno', 'Avançar metade do caminho', 'Revisar e ajustar', 'Concluir'];

export function stepsFor(title) {
  const n = normalize(title);
  const t = TEMPLATES.find((x) => x.match.test(n));
  return t ? { steps: [...t.steps], icon: t.icon, template: true } : { steps: [...DEFAULT_STEPS], icon: 'bandeira', template: false };
}

/** Distribui etapas em dias úteis até o prazo (inclusive). */
export function spreadSteps(steps, deadline, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = deadline ? parseYmd(deadline) : addDays(today, steps.length * 2);
  const days = Math.max(0, diffDays(today, end));
  return steps.map((s, i) => {
    const offset = steps.length === 1 ? days : Math.round((days * i) / (steps.length - 1));
    return { title: s, date: ymd(addDays(today, offset)) };
  });
}

// ---------- Priorização ----------
/** Pontuação: urgência (prazo) + importância (prioridade, objetivo) + atraso. */
export function score(item, store) {
  const today = parseYmd(ymd(store.now()));
  let s = 0;
  if (item.date) {
    const d = diffDays(today, parseYmd(item.date));
    if (d < 0) s += 50 + Math.min(20, -d * 3); // atrasada
    else if (d === 0) s += 40;
    else if (d === 1) s += 25;
    else if (d <= 3) s += 12;
  }
  if (item.priority === 1) s += 30;
  if (item.priority === 3) s -= 10;
  if (item.goalId) s += 10;
  if (item.kind === 'event') s += 15;
  return s;
}

export function quadrant(item, store) {
  const today = parseYmd(ymd(store.now()));
  const urgent = item.date && diffDays(today, parseYmd(item.date)) <= 1;
  const important = item.priority === 1 || Boolean(item.goalId) || item.kind === 'event';
  if (urgent && important) return 'fazer-agora';
  if (!urgent && important) return 'agendar';
  if (urgent && !important) return 'rapido';
  return 'depois';
}

/** Missões prioritárias do dia (no máximo `limit`). */
export function priorities(store, limit = 3) {
  const today = ymd(store.now());
  const { today: list, overdue } = store.todayAgenda();
  const pending = [...overdue, ...list.filter((i) => !store.isDone(i, today))];
  return pending.sort((a, b) => score(b, store) - score(a, store)).slice(0, limit);
}

// ---------- Modo Me Salva ----------
export function saveMePlan(store) {
  const now = store.now();
  const today = ymd(now);
  const horizon = ymd(addDays(now, 3));
  const pending = store.state.items.filter((i) => {
    if (store.isDone(i, today)) return false;
    if (i.recurrence) return store.itemsOn(today).includes(i);
    return i.kind === 'task' ? (!i.date || i.date <= horizon) : i.date === today;
  });
  const groups = { 'fazer-agora': [], agendar: [], rapido: [], depois: [] };
  for (const i of pending) groups[quadrant(i, store)].push(i);
  for (const k of Object.keys(groups)) groups[k].sort((a, b) => score(b, store) - score(a, store));

  const first = [...groups['fazer-agora'], ...groups.rapido, ...groups.agendar].slice(0, 3);
  const big = pending.filter((i) => (i.duration && i.duration >= 90) || (i.postponed || 0) >= 2);
  const load = store.dayLoad(today);
  const free = store.freeSlots(today).reduce((a, [s, e]) => a + (e - s), 0);
  // Itens de hoje com baixa importância que podem ir para amanhã (só com autorização)
  const movable = load > free
    ? store.itemsOn(today).filter((i) => i.kind === 'task' && !i.recurrence && !store.isDone(i, today) && !first.includes(i) && i.priority !== 1)
    : [];
  return { pending, groups, first, big, load, free, movable, overloaded: load > free };
}

// ---------- Plano da semana ----------
export function weekPlan(store) {
  const now = store.now();
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = ymd(addDays(now, k));
    return { date: d, load: store.dayLoad(d), items: store.itemsOn(d) };
  });
  const inbox = store.inbox().sort((a, b) => a.priority - b.priority);
  const overdue = store.overdue();
  // Sugestão: distribuir pendências sem data e atrasadas nos dias mais leves
  const loads = days.map((d) => ({ ...d }));
  const suggestions = [];
  for (const it of [...overdue, ...inbox].slice(0, 10)) {
    loads.sort((a, b) => a.load - b.load || a.date.localeCompare(b.date));
    const target = loads[0];
    suggestions.push({ item: it, date: target.date });
    target.load += it.duration || 30;
  }
  return { days, inbox, overdue, suggestions };
}

// ---------- Encontrar horário ----------
export function suggestSlot(store, { date, period, duration = 30 }) {
  const ranges = { manha: ['08:00', '12:00'], tarde: ['13:00', '18:00'], noite: ['19:00', '22:00'] };
  const [from, to] = period ? ranges[period] : [store.state.profile.dayStart, store.state.profile.dayEnd];
  const slots = store.freeSlots(date, { from, to, minDuration: duration });
  const insights = store.insights();
  return slots.slice(0, 3).map(([s]) => ({ date, time: fromMinutes(s), duration, preferred: insights.bestPeriod === period }));
}

// ---------- Resumo do dia ----------
export function daySummary(store, dateStr) {
  const date = dateStr || ymd(store.now());
  const items = store.itemsOn(date);
  const done = items.filter((i) => store.isDone(i, date));
  const doneElsewhere = store.state.items.filter((i) => !i.recurrence && i.done && i.doneAt && ymd(new Date(i.doneAt)) === date && i.date !== date);
  const pending = items.filter((i) => !store.isDone(i, date));
  const goalsMoved = store.state.goals.filter((g) => g.steps.some((s) => s.doneAt && ymd(new Date(s.doneAt)) === date));
  const tomorrow = ymd(addDays(parseYmd(date), 1));
  const tips = [];
  if (pending.length > 3) tips.push('Amanhã, escolhe só três prioridades. O resto é bônus.');
  const stuck = store.insights().stuck;
  if (stuck.length) tips.push(`"${stuck[0].title}" já foi adiada ${stuck[0].postponed} vezes. Vale dividir em partes menores.`);
  const tLoad = store.dayLoad(tomorrow);
  if (tLoad > 360) tips.push(`Amanhã tem cerca de ${Math.round(tLoad / 60)}h de coisas marcadas. Talvez mover algo.`);
  if (!tips.length && done.length) tips.push('Bom ritmo. Mantém a mesma quantidade amanhã.');
  if (!tips.length) tips.push('Amanhã, começa pela missão mais curta pra pegar embalo.');
  return { date, done: [...done, ...doneElsewhere], pending, goalsMoved, tips };
}

export { toMinutes };
