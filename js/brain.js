// Motor de conversa do Guia (Camada 1: local, sem IA externa).
// Recebe texto, entende a intenção, executa ações reais no banco e
// responde com honestidade: só confirma o que de fato foi gravado.

import { parse, parseAnswer, normalize, detectIntent } from './parser.js';
import { ymd, addDays, parseYmd, friendlyDate, friendlyTime, formatDuration, WEEKDAYS, diffDays } from './dates.js';
import { say, missoes } from './voice.js';
import * as planner from './planner.js';
import { askOllama, buildContext } from './llm.js';

const CANCEL = /^(cancela|cancelar|esquece|deixa pra la|deixa|para|nada|nao precisa|nao quero)\b/;
const STRONG = new Set(['task', 'event', 'list', 'complete', 'reschedule', 'delete', 'goal', 'breakdown', 'find_slot', 'save_me', 'plan_week', 'summary', 'help', 'struggle']);

export function describe(item) {
  const parts = [item.title];
  if (item.date) parts.push(friendlyDate(item.date));
  if (item.time) parts.push(`às ${friendlyTime(item.time)}`);
  if (item.duration) parts.push(`(${formatDuration(item.duration)})`);
  return parts.join(' ');
}

export function createBrain(store, { llm = { askOllama, buildContext } } = {}) {
  let pending = null;
  let lastQuick = [];
  const S = () => store.state.profile.strictness;
  const nome = () => store.state.profile.name || 'criatura';
  const r = (text, mood = 'happy', extra = {}) => ({ text, mood, quick: [], ...extra });
  const fail = (what) => r(`Não consegui ${what}. Nada foi alterado. Tenta de novo?`, 'worried');

  // ---------------- Criação de tarefas e eventos ----------------
  function draftFrom(p, text) {
    const n = normalize(text);
    let kind = p.intent === 'event' ? 'event' : 'task';
    if (p.intent === 'unknown' && p.time) kind = 'event';
    return {
      kind,
      title: p.title,
      date: p.date,
      time: p.time,
      duration: p.duration,
      period: p.period,
      remindIntent: /\b(lembra|lembre|lembrete|nao deixa eu esquecer)\b/.test(n),
      ambiguous: p.ambiguous,
      priority: /\b(urgente|importante|prioridade)\b/.test(n) ? 1 : 2,
      recurrence: /\btodo dia\b|\btodos os dias\b|\bdiariamente\b/.test(n) ? 'daily'
        : /\bdias uteis\b|\bseg(unda)? a sex(ta)?\b/.test(n) ? 'weekdays'
          : /\btoda (semana|segunda|terca|quarta|quinta|sexta)|\btodo (sabado|domingo)|\bsemanalmente\b/.test(n) ? 'weekly'
            : /\btodo mes\b|\bmensalmente\b/.test(n) ? 'monthly' : null,
    };
  }

  function continueDraft(d) {
    if (!d.title) { pending = { type: 'need_title', draft: d }; return r('Claro. O que eu anoto?', 'thinking'); }

    if (d.ambiguous?.field === 'time') {
      const [am, pm] = d.ambiguous.options;
      pending = { type: 'disambiguate_time', draft: d, options: d.ambiguous.options };
      return r(`${friendlyTime(am)} da manhã ou ${friendlyTime(pm)}?`, 'confused', { quick: [`${friendlyTime(pm)}`, `${friendlyTime(am)} da manhã`] });
    }
    if (d.ambiguous?.field === 'date') {
      if (d.ambiguous.vague) {
        pending = { type: 'need_date', draft: { ...d, ambiguous: null } };
        const base = /semana/.test(d.ambiguous.vague) ? ['Segunda', 'Quarta', 'Sexta'] : ['Sábado', 'Domingo'];
        return r(`"${d.ambiguous.vague}" é amplo demais pra mim. Qual dia?`, 'confused', { quick: base });
      }
      const [a, b] = d.ambiguous.options;
      pending = { type: 'disambiguate_date', draft: d, options: [a, b] };
      return r(`Hoje mesmo ou ${friendlyDate(b).replace(/ \(.*/, '')} da semana que vem (${parseYmd(b).getDate()}/${parseYmd(b).getMonth() + 1})?`, 'confused', { quick: ['Hoje', 'Semana que vem'] });
    }
    if (!d.date && !d.noDate && (d.kind === 'event' || d.remindIntent || d.time)) {
      if (d.time && d.kind === 'task') d.date = ymd(store.now()); // "às 18h" sem dia = hoje
      else {
        pending = { type: 'need_date', draft: d };
        return r('Pra quando?', 'thinking', { quick: ['Hoje', 'Amanhã', ...(d.kind === 'task' ? ['Sem data'] : [])] });
      }
    }
    if (d.date && !d.time && !d.noTime && (d.kind === 'event' || d.remindIntent)) {
      pending = { type: 'need_time', draft: d };
      return r('Que horas?', 'thinking', { quick: d.kind === 'event' ? ['9h', '14h', '19h'] : ['9h', '15h', 'Sem horário'] });
    }
    if (d.date && d.time && !d.conflictOk) {
      const c = store.conflicts(d.date, d.time, d.duration || 30);
      if (c.length) {
        pending = { type: 'confirm_conflict', draft: d };
        return r(`Isso bate com "${c[0].title}" às ${friendlyTime(c[0].time)}. Marco mesmo assim?`, 'surprised', { quick: ['Marca mesmo assim', 'Muda o horário'] });
      }
    }
    // Data no passado
    if (d.date && d.date < ymd(store.now()) && !d.pastOk) {
      pending = { type: 'confirm_past', draft: d };
      return r(`${friendlyDate(d.date)} já passou. Marco assim mesmo?`, 'confused', { quick: ['Sim', 'Não'] });
    }

    const res = store.addItem(d);
    if (!res.ok) return fail('salvar');
    const item = res.item;
    let text = `${say('created', S())} ${describe(item)}.`;
    if (item.recurrence) text += ` Repete ${({ daily: 'todo dia', weekdays: 'em dias úteis', weekly: 'toda semana', monthly: 'todo mês' })[item.recurrence]}.`;
    if (item.time && item.remind && !store.state.profile.notifications) text += ' (Aviso só aparece com notificações ativadas nos Ajustes.)';
    const extra = { cards: [{ type: 'items', ids: [item.id] }], effects: { created: item.id } };
    if (item.kind === 'task' && item.time && !item.duration) {
      pending = { type: 'confirm_duration', itemId: item.id };
      return r(`${text} Quer reservar um tempo pra isso?`, 'happy', { ...extra, quick: ['30 min', '1 hora', 'Não precisa'] });
    }
    pending = null;
    return r(text, 'happy', extra);
  }

  // ---------------- Escolha entre itens parecidos ----------------
  function withItem(target, action, extra, fallbackText) {
    const found = target ? store.findItems(target) : [];
    if (!target) {
      const pr = planner.priorities(store, 4);
      if (!pr.length) return r('Não tem nada pendente pra isso agora.', 'thinking');
      pending = { type: 'choose_item', action, candidates: pr.map((i) => i.id), extra };
      return r(fallbackText, 'thinking', { quick: pr.map((i) => i.title) });
    }
    if (!found.length) {
      return r(`Não achei nada parecido com "${target}" nas pendências.`, 'confused', { quick: ['O que eu tenho hoje?'] });
    }
    if (found.length > 1) {
      pending = { type: 'choose_item', action, candidates: found.slice(0, 4).map((i) => i.id), extra };
      return r('Achei mais de uma. Qual?', 'thinking', { quick: found.slice(0, 4).map((i) => describe(i)) });
    }
    return runAction(action, found[0], extra);
  }

  function runAction(action, item, extra = {}) {
    if (action === 'complete') {
      const day = item.recurrence ? ymd(store.now()) : undefined;
      if (store.isDone(item, day)) return r(`"${item.title}" já estava concluída.`, 'thinking');
      const res = store.toggleDone(item.id, day);
      if (!res.ok) return fail('marcar como concluída');
      return completionReply(res);
    }
    if (action === 'reschedule') {
      if (!extra.date && !extra.time) {
        pending = { type: 'need_resched', itemId: item.id };
        return r(`Pra quando eu passo "${item.title}"?`, 'thinking', { quick: ['Amanhã', 'Sexta', 'Semana que vem'] });
      }
      if (extra.ambiguous?.field === 'time') {
        pending = { type: 'need_resched', itemId: item.id };
        return r('Manhã ou tarde? Me diz o horário certinho.', 'confused');
      }
      const res = store.reschedule(item.id, { date: extra.date || item.date || ymd(store.now()), time: extra.time !== undefined && extra.time !== null ? extra.time : item.time });
      if (!res.ok) return fail('remarcar');
      const it = res.item;
      let text = `Remarcado: ${describe(it)}.`;
      let mood = 'happy';
      const quick = [];
      if (it.postponed >= 3) {
        text += ` ${say('stuck', S(), { n: it.postponed })}`;
        mood = 'disappointed';
        pending = { type: 'shrink', itemId: it.id };
        quick.push('Dividir em partes', 'Deixa assim');
      } else if (it.postponed >= 1 && S() !== 'suave' && store.state.profile.chargeMode) {
        text += ` ${say('postponed', S())}`;
        mood = 'thinking';
        pending = { type: 'shrink', itemId: it.id };
        quick.push('Diminuir', 'Vou encarar');
      } else pending = null;
      return r(text, mood, { quick, cards: [{ type: 'items', ids: [it.id] }] });
    }
    if (action === 'delete') {
      pending = { type: 'confirm_delete', itemId: item.id };
      return r(`Apago "${describe(item)}"? Não dá pra desfazer.`, 'worried', { quick: ['Sim, apaga', 'Não'] });
    }
    return r('Hmm, me perdi aqui.', 'confused');
  }

  function completionReply(res) {
    pending = null;
    const today = ymd(store.now());
    const left = store.itemsOn(today).filter((i) => !store.isDone(i, today)).length + store.overdue().length;
    let text = say('done', S());
    if (res.stepDone) text += ` Avançou uma etapa em "${res.stepDone.goal.title}".`;
    if (left === 0 && store.itemsOn(today).length) text = say('allDone', S());
    else if (left) text += ` Faltam ${left}.`;
    if (res.xp > 0) text += ` +${res.xp} XP`;
    for (const a of res.achievements || []) text += `\n🏅 Conquista: ${a.title}!`;
    return r(text, res.achievements?.length || left === 0 ? 'celebrating' : 'proud', { effects: { celebrate: true, achievements: res.achievements } });
  }

  // ---------------- Consultas ----------------
  function listReply(range) {
    const now = store.now();
    const today = ymd(now);
    if (range === 'week') {
      const days = Array.from({ length: 7 }, (_, k) => ymd(addDays(now, k)));
      const lines = days.map((d) => {
        const items = store.itemsOn(d).filter((i) => !store.isDone(i, d));
        return items.length ? `• ${friendlyDate(d)}: ${items.map((i) => i.title + (i.time ? ` ${friendlyTime(i.time)}` : '')).join(', ')}` : null;
      }).filter(Boolean);
      if (!lines.length) return r('Semana vazia na agenda. Quer planejar?', 'thinking', { quick: ['Organiza minha semana'] });
      return r(`Teus próximos 7 dias:\n${lines.join('\n')}`, 'focused');
    }
    if (range === 'pending') {
      const od = store.overdue();
      const inbox = store.inbox();
      if (!od.length && !inbox.length) return r('Nenhuma pendência atrasada ou sem data. Limpo!', 'proud');
      return r(`${od.length ? `Atrasadas (${od.length}): ${od.map((i) => i.title).join(', ')}.` : ''}${inbox.length ? `\nSem data (${inbox.length}): ${inbox.map((i) => i.title).join(', ')}.` : ''}`.trim(), od.length ? 'worried' : 'thinking', { cards: [{ type: 'items', ids: [...od, ...inbox].slice(0, 6).map((i) => i.id) }], quick: od.length ? ['Me salva'] : [] });
    }
    const date = range === 'tomorrow' ? ymd(addDays(now, 1)) : today;
    const items = store.itemsOn(date);
    const open = items.filter((i) => !store.isDone(i, date));
    const od = range === 'today' ? store.overdue() : [];
    if (!items.length && !od.length) {
      return r(range === 'tomorrow' ? 'Amanhã tá livre por enquanto.' : say('dayEmpty', S()), 'resting', { quick: ['Organiza minha semana'] });
    }
    let text = range === 'tomorrow' ? `Amanhã: ${open.length} pendente${open.length === 1 ? '' : 's'}.` : say('dayIntro', S(), { n: missoes(open.length) });
    if (open.length === 0) text = range === 'tomorrow' ? 'Amanhã já tá tudo feito. Como assim?' : say('allDone', S());
    if (od.length) text += ` E ${od.length} atrasada${od.length > 1 ? 's' : ''}.`;
    const load = store.dayLoad(date);
    if (load > 480) text += ` ${say('overload', S())}`;
    return r(text, open.length ? 'focused' : 'proud', { cards: [{ type: 'items', ids: [...od, ...items].map((i) => i.id), date }] });
  }

  // ---------------- Objetivos e divisão ----------------
  function goalReply(title) {
    if (!title) { pending = { type: 'need_goal_title' }; return r('Qual é o objetivo? Uma frase curta.', 'thinking'); }
    const { steps, icon, template } = planner.stepsFor(title);
    pending = { type: 'confirm_goal', title, steps, icon };
    return r(`Jornada "${title}". ${template ? 'Montei' : 'Não tenho um modelo específico pra isso, então montei'} estas etapas:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nCrio assim? Depois dá pra editar no mapa.`, 'excited', { quick: ['Cria', 'Cancela'] });
  }

  function breakdownReply(title) {
    const t = title || 'Projeto';
    pending = { type: 'breakdown_deadline', title: t };
    return r(`Bora fatiar "${t}". Qual é o prazo de entrega?`, 'focused', { quick: ['Sexta', 'Semana que vem', 'Sem prazo'] });
  }

  function proposeBreakdown(title, deadline) {
    const { steps, icon } = planner.stepsFor(title);
    const plan = planner.spreadSteps(steps, deadline, store.now());
    pending = { type: 'confirm_breakdown', title, plan, icon, deadline };
    const lines = plan.map((p, i) => `${i + 1}. ${p.title} — ${friendlyDate(p.date)}`).join('\n');
    const tight = deadline && diffDays(store.now(), parseYmd(deadline)) < 2;
    return r(`Plano até ${deadline ? friendlyDate(deadline) : 'as próximas semanas'}:\n${lines}${tight ? '\nPrazo apertado: várias etapas caem no mesmo dia.' : ''}\nCrio a jornada e as tarefas?`, 'excited', { quick: ['Cria', 'Cancela'] });
  }

  // ---------------- Me salva ----------------
  function saveMeReply() {
    const p = planner.saveMePlan(store);
    if (!p.pending.length) return r('Respira. Não tem nada pendente nos próximos dias. Tá mais tranquilo do que parece.', 'happy');
    let text = 'Respira. Vamos por partes.\n';
    text += `Primeiro, só isso:\n${p.first.map((i, k) => `${k + 1}. ${describe(i)}`).join('\n')}`;
    if (p.big.length) text += `\nGrande ou adiada demais: "${p.big[0].title}". Dá pra começar com 15 minutos.`;
    const rest = p.pending.length - p.first.length;
    if (rest > 0) text += `\nO resto (${rest}) pode esperar até essas estarem feitas.`;
    const quick = [];
    if (p.movable.length) {
      pending = { type: 'save_me_apply', ids: p.movable.map((i) => i.id) };
      text += `\nHoje tem mais coisa (${Math.round(p.load / 60)}h) que tempo livre (${Math.round(p.free / 60)}h). Posso passar ${p.movable.length} tarefa${p.movable.length > 1 ? 's' : ''} menos importante${p.movable.length > 1 ? 's' : ''} pra amanhã: ${p.movable.map((i) => i.title).join(', ')}. Posso?`;
      quick.push('Pode mover', 'Não mexe');
    }
    return r(text, 'worried', { quick, cards: [{ type: 'items', ids: p.first.map((i) => i.id) }] });
  }

  function struggleReply() {
    const ins = store.insights();
    const tips = [];
    if (ins.stuck.length) tips.push(`"${ins.stuck[0].title}" foi adiada ${ins.stuck[0].postponed} vezes. Ela provavelmente tá grande demais: divide em um pedaço de 15 minutos.`);
    const todayLoad = store.dayLoad(ymd(store.now()));
    if (todayLoad > 360) tips.push(`Hoje tem uns ${Math.round(todayLoad / 60)}h marcadas. Isso é muito; corta pra três prioridades.`);
    if (ins.activeDays7 <= 2) tips.push('Nos últimos 7 dias tu concluiu coisas em poucos dias. Meta mais realista: uma missão por dia, não dez.');
    if (ins.bestPeriod) tips.push(`Tu costuma concluir mais coisas de ${ins.bestPeriod === 'manha' ? 'manhã' : ins.bestPeriod}. Coloca o mais difícil nesse horário.`);
    tips.push('Define quando e onde: "às 15h, na mesa, abro o arquivo". Plano concreto funciona melhor que força de vontade.');
    const text = `${say('stuck', S(), { n: 'vários' }).split('.')[0]}. Algumas mudanças práticas:\n${tips.slice(0, 3).map((t) => `• ${t}`).join('\n')}`;
    if (ins.stuck.length) pending = { type: 'shrink', itemId: ins.stuck[0].id };
    return r(text, 'thinking', { quick: ins.stuck.length ? ['Dividir em partes', 'Me salva'] : ['Me salva'] });
  }

  function weekReply() {
    const w = planner.weekPlan(store);
    const lines = w.days.map((d) => `• ${friendlyDate(d.date)}: ${d.items.length} ite${d.items.length === 1 ? 'm' : 'ns'}${d.load ? ` (~${formatDuration(d.load)})` : ''}`);
    let text = `Tua semana:\n${lines.join('\n')}`;
    if (w.suggestions.length) {
      pending = { type: 'week_apply', moves: w.suggestions.map((s) => ({ id: s.item.id, date: s.date })) };
      text += `\nTem ${w.suggestions.length} pendência${w.suggestions.length > 1 ? 's' : ''} sem data ou atrasada${w.suggestions.length > 1 ? 's' : ''}. Sugiro:\n${w.suggestions.map((s) => `• ${s.item.title} → ${friendlyDate(s.date)}`).join('\n')}\nAplico?`;
      return r(text, 'focused', { quick: ['Aplica', 'Não'] });
    }
    return r(`${text}\nNada sem data pra distribuir. Se quiser, me diz o que precisa caber na semana.`, 'focused');
  }

  function summaryReply() {
    const s = planner.daySummary(store);
    let text = `Resumo de hoje:\n✓ Concluídas: ${s.done.length}${s.done.length ? ` (${s.done.slice(0, 5).map((i) => i.title).join(', ')})` : ''}`;
    text += `\n○ Pendentes: ${s.pending.length}${s.pending.length ? ` (${s.pending.slice(0, 5).map((i) => i.title).join(', ')})` : ''}`;
    if (s.goalsMoved.length) text += `\n⚑ Jornadas que avançaram: ${s.goalsMoved.map((g) => g.title).join(', ')}`;
    text += `\nPra amanhã: ${s.tips[0]}`;
    return r(text, s.done.length ? 'proud' : 'thinking', { quick: s.pending.length ? ['Passa as pendentes pra amanhã'] : [] });
  }

  function helpReply() {
    return r('Eu entendo coisas assim:\n• "me lembra de comprar tinta amanhã às 10h"\n• "reunião sexta às 14h"\n• "marca 40 minutos pra estudar quarta de tarde"\n• "o que eu tenho hoje?" / "e a semana?"\n• "terminei comprar tinta"\n• "remarca estudar pra sexta"\n• "apaga dentista"\n• "novo objetivo: aprender inglês"\n• "tenho um trabalho enorme, me ajuda a organizar"\n• "me salva" / "organiza minha semana" / "resumo do dia"\nConversa livre e estratégia só com a IA local ligada nos Ajustes.', 'happy');
  }

  async function openQuestion(text, kind) {
    const p = store.state.profile;
    if (p.llmEnabled && llm) {
      const history = store.state.messages.slice(-8).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
      const res = await llm.askOllama({ url: p.llmUrl, model: p.llmModel, question: text, context: p.llmContext !== false ? llm.buildContext(store, planner) : 'Sem acesso aos dados.', history });
      if (res.ok) return r(res.text, 'thinking', { source: 'ia-local' });
      return r(`Tentei a IA local, mas ${res.reason}. Sem ela, não consigo responder isso direito. Os comandos de agenda e tarefas continuam funcionando.`, 'worried');
    }
    if (kind === 'advice') {
      return r('Estratégia de verdade eu não sei montar sozinho: sem IA local, eu só entendo comandos. O que eu consigo: transformar isso num objetivo com etapas e te cobrar cada uma.', 'thinking', { quick: [`Novo objetivo: ${text.replace(/^como (posso|eu posso) /i, '').replace(/\?$/, '')}`, 'Ajuda'] });
    }
    return r(`${say('unknown', S())} Posso anotar como tarefa, ou tu pode ver o que eu sei fazer.`, 'confused', { quick: [`Anota: ${text.slice(0, 40)}`, 'Ajuda'] });
  }

  // ---------------- Respostas a perguntas pendentes ----------------
  function handlePending(text) {
    const pd = pending;
    const a = parseAnswer(text, store.now());
    const n = a.raw;

    switch (pd.type) {
      case 'need_title': return continueDraft({ ...pd.draft, title: text.trim().replace(/^./, (c) => c.toUpperCase()) });
      case 'need_goal_title': pending = null; return goalReply(text.trim());
      case 'need_date': {
        if (/sem data|nao sei|depois|qualquer dia/.test(n)) return continueDraft({ ...pd.draft, noDate: true, remindIntent: false });
        const date = a.date || weekdayOnly(n);
        if (!date) return r('Não entendi o dia. Tipo "amanhã", "sexta" ou "15/11".', 'confused', { quick: ['Hoje', 'Amanhã'] });
        return continueDraft({ ...pd.draft, date, time: pd.draft.time || a.time, ambiguous: a.timeAmbiguous && !pd.draft.time ? a.timeAmbiguous : null });
      }
      case 'need_time': {
        if (a.noTime) return continueDraft({ ...pd.draft, noTime: true });
        if (a.timeAmbiguous) return continueDraft({ ...pd.draft, ambiguous: a.timeAmbiguous, time: a.time });
        if (a.time) return continueDraft({ ...pd.draft, time: a.time, duration: pd.draft.duration || a.duration });
        if (a.period) {
          const s = planner.suggestSlot(store, { date: pd.draft.date, period: a.period, duration: pd.draft.duration || 30 })[0];
          if (s) return continueDraft({ ...pd.draft, time: s.time });
          return r(`Não tem horário livre de ${a.period === 'manha' ? 'manhã' : a.period} nesse dia. Qual hora então?`, 'worried');
        }
        return r('Não peguei o horário. Tipo "15h", "9h30" ou "sem horário".', 'confused', { quick: ['Sem horário'] });
      }
      case 'disambiguate_time': {
        const [am, pm] = pd.options;
        let time = null;
        if (/manha|madrugada|cedo/.test(n) || n.startsWith(am.slice(0, 2)) || a.time === am && /manha/.test(n)) time = am;
        if (/tarde|noite/.test(n) || a.time === pm || n.startsWith(String(Number(pm.slice(0, 2))))) time = pm;
        if (!time && a.time && !a.timeAmbiguous) time = a.time;
        if (!time) return r(`${friendlyTime(am)} ou ${friendlyTime(pm)}?`, 'confused', { quick: [friendlyTime(pm), `${friendlyTime(am)} da manhã`] });
        return continueDraft({ ...pd.draft, time, ambiguous: null });
      }
      case 'disambiguate_date': {
        const [a1, b1] = pd.options;
        let date = null;
        if (/hoje|essa|esta|agora/.test(n)) date = a1;
        else if (/que vem|proxim|outra|semana/.test(n)) date = b1;
        else if (a.date) date = a.date;
        if (!date) return r('Hoje ou semana que vem?', 'confused', { quick: ['Hoje', 'Semana que vem'] });
        return continueDraft({ ...pd.draft, date, ambiguous: null });
      }
      case 'confirm_conflict':
        if (a.yes || /mesmo assim|marca/.test(n)) return continueDraft({ ...pd.draft, conflictOk: true });
        if (a.time) return continueDraft({ ...pd.draft, time: a.time });
        pending = { type: 'need_time', draft: pd.draft };
        return r('Que horas então?', 'thinking');
      case 'confirm_past':
        if (a.yes) return continueDraft({ ...pd.draft, pastOk: true });
        pending = { type: 'need_date', draft: { ...pd.draft, date: null } };
        return r('Pra qual dia então?', 'thinking', { quick: ['Hoje', 'Amanhã'] });
      case 'confirm_duration': {
        pending = null;
        let dur = a.duration;
        if (!dur && a.yes) dur = 30;
        if (!dur) return r('Ok, sem tempo reservado.', 'happy');
        const it = store.getItem(pd.itemId);
        const c = it ? store.conflicts(it.date, it.time, dur, it.id) : [];
        const res = store.updateItem(pd.itemId, { duration: dur });
        if (!res.ok) return fail('reservar o tempo');
        return r(`Reservei ${formatDuration(dur)}.${c.length ? ` Atenção: encosta em "${c[0].title}".` : ''}`, 'happy');
      }
      case 'choose_item': {
        const items = pd.candidates.map((id) => store.getItem(id)).filter(Boolean);
        const num = n.match(/^(\d)\b/);
        let item = num ? items[Number(num[1]) - 1] : null;
        if (!item) item = items.find((i) => normalize(describe(i)) === n || normalize(i.title) === n) || items.find((i) => normalize(i.title).includes(n) || n.includes(normalize(i.title)));
        if (!item) return r('Não identifiquei qual. Toca numa das opções ou diz o nome.', 'confused', { quick: items.map((i) => i.title) });
        pending = null;
        return runAction(pd.action, item, pd.extra);
      }
      case 'need_resched': {
        const item = store.getItem(pd.itemId);
        if (!item) { pending = null; return r('Essa tarefa não existe mais.', 'confused'); }
        const date = a.date || weekdayOnly(n);
        if (!date && !a.time) return r('Pra quando? Tipo "amanhã", "sexta às 10h".', 'confused');
        pending = null;
        return runAction('reschedule', item, { date, time: a.time, ambiguous: a.timeAmbiguous });
      }
      case 'confirm_delete': {
        pending = null;
        if (!a.yes && !/apaga/.test(n)) return r('Beleza, não apaguei nada.', 'happy');
        const res = store.removeItem(pd.itemId);
        if (!res.ok) return fail('apagar');
        return r(`Apagado: "${res.item.title}".`, 'happy');
      }
      case 'confirm_goal': {
        pending = null;
        if (!a.yes && !/cria/.test(n)) return r('Ok, não criei a jornada.', 'happy');
        const res = store.addGoal({ title: pd.title, steps: pd.steps, icon: pd.icon });
        if (!res.ok) return fail('criar a jornada');
        return r(`Jornada criada com ${pd.steps.length} etapas. Ela já aparece no mapa. Primeira etapa: "${pd.steps[0]}". Quer marcar quando fazer?`, 'excited', { effects: { goal: res.goal.id }, quick: ['Abrir Jornada'] });
      }
      case 'breakdown_deadline': {
        if (/sem prazo|nao tem|nao sei/.test(n)) return proposeBreakdown(pd.title, null);
        const date = a.date || weekdayOnly(n);
        if (!date) {
          if (/semana que vem|proxima semana/.test(n)) return proposeBreakdown(pd.title, ymd(addDays(store.now(), 7)));
          return r('Qual a data? Tipo "sexta" ou "20/11".', 'confused', { quick: ['Sem prazo'] });
        }
        return proposeBreakdown(pd.title, date);
      }
      case 'confirm_breakdown': {
        pending = null;
        if (!a.yes && !/cria/.test(n)) return r('Ok, não criei nada.', 'happy');
        const g = store.addGoal({ title: pd.title, steps: pd.plan.map((p) => p.title), icon: pd.icon });
        if (!g.ok) return fail('criar a jornada');
        let created = 0;
        g.goal.steps.forEach((s, i) => { if (store.scheduleStep(g.goal.id, s.id, { date: pd.plan[i].date }).ok) created++; });
        if (created < pd.plan.length) return r(`Criei a jornada, mas só ${created} de ${pd.plan.length} tarefas foram salvas. Confere na Agenda.`, 'worried');
        return r(`Pronto: jornada "${pd.title}" com ${created} tarefas na agenda. Hoje é só: "${pd.plan[0].title}".`, 'excited', { effects: { goal: g.goal.id } });
      }
      case 'save_me_apply': {
        pending = null;
        if (!a.yes && !/pode|move/.test(n)) return r('Não mexi em nada. Foca nas três primeiras.', 'focused');
        const tomorrow = ymd(addDays(store.now(), 1));
        const moved = pd.ids.filter((id) => store.reschedule(id, { date: tomorrow }).ok).length;
        return r(`Movi ${moved} tarefa${moved > 1 ? 's' : ''} pra amanhã. Agora o dia cabe.`, 'happy');
      }
      case 'week_apply': {
        pending = null;
        if (!a.yes && !/aplica/.test(n)) return r('Ok, deixei como estava.', 'happy');
        const moved = pd.moves.filter((m) => store.reschedule(m.id, { date: m.date }).ok).length;
        return r(`Distribuí ${moved} pendência${moved > 1 ? 's' : ''} pela semana.`, 'proud');
      }
      case 'shrink': {
        pending = null;
        const item = store.getItem(pd.itemId);
        if (!item) return r('Essa tarefa não existe mais.', 'confused');
        if (/divid|diminu|menor|parte/.test(n) || a.yes) {
          const res = store.addItem({ title: `Primeiros 15 min: ${item.title}`, date: ymd(store.now()), duration: 15, priority: 1, goalId: item.goalId, parentId: item.id });
          if (!res.ok) return fail('criar a parte menor');
          return r(`Criei "${res.item.title}" pra hoje. Só 15 minutos. Depois disso, tu decide se continua.`, 'excited', { cards: [{ type: 'items', ids: [res.item.id] }] });
        }
        return r(S() === 'exigente' ? 'Então encara. Eu tô de olho.' : 'Fechado. Confio em ti.', 'focused');
      }
      case 'confirm_slot': {
        const idx = /^(2|segund)/.test(n) ? 1 : /^(3|terceir)/.test(n) ? 2 : 0;
        let opt = pd.options[idx];
        if (a.time) opt = { ...pd.options[0], time: a.time };
        if (!a.yes && !a.time && !/^\d|primeir|segund|terceir|esse|pode|marca/.test(n) && !pd.options.some((o) => n.includes(friendlyTime(o.time).toLowerCase()))) {
          pending = null; return r('Ok, não marquei.', 'happy');
        }
        const chosen = pd.options.find((o) => n.includes(friendlyTime(o.time).toLowerCase())) || opt;
        pending = null;
        return continueDraft({ ...pd.draft, date: chosen.date, time: chosen.time, duration: chosen.duration });
      }
      case 'slot_need_date': {
        const date = a.date || weekdayOnly(n);
        if (!date) return r('Qual dia?', 'confused', { quick: ['Hoje', 'Amanhã'] });
        pending = null;
        return slotReply({ ...pd.p, date, period: pd.p.period || a.period });
      }
      default:
        pending = null;
        return null;
    }
  }

  function weekdayOnly(n) {
    const m = n.match(/^(domingo|segunda|terca|quarta|quinta|sexta|sabado)/);
    if (!m) return null;
    return parse(`na ${m[1]} que vem`, store.now()).date && parse(`na ${m[1]}`, store.now()).date === ymd(store.now())
      ? parse(`na ${m[1]} que vem`, store.now()).date
      : parse(`na ${m[1]}`, store.now()).date;
  }

  function slotReply(p) {
    const duration = p.duration || 30;
    if (!p.date) { pending = { type: 'slot_need_date', p }; return r(`${formatDuration(duration)} de "${p.title || 'bloco'}". Em que dia?`, 'thinking', { quick: ['Hoje', 'Amanhã'] }); }
    const options = planner.suggestSlot(store, { date: p.date, period: p.period, duration });
    const draft = { kind: 'task', title: p.title || 'Bloco reservado', date: p.date, duration, priority: 2 };
    if (!options.length) {
      pending = { type: 'need_time', draft };
      return r(`Não achei ${formatDuration(duration)} livres ${p.period ? `de ${p.period === 'manha' ? 'manhã' : p.period} ` : ''}${friendlyDate(p.date)}. Que horas tu quer?`, 'worried');
    }
    pending = { type: 'confirm_slot', draft, options };
    const known = store.itemsOn(p.date).filter((i) => i.time).length;
    return r(`${known ? 'Olhando teus compromissos' : 'Não tem nada marcado nesse dia, então'}, sugiro ${friendlyDate(p.date)} às ${friendlyTime(options[0].time)}${options[1] ? ` (ou ${options.slice(1).map((o) => friendlyTime(o.time)).join(', ')})` : ''}. Marco?`, 'thinking', { quick: options.map((o) => friendlyTime(o.time)) });
  }

  // ---------------- Entrada principal ----------------
  async function handle(input) {
    const text = (input || '').trim();
    if (!text) return r('Fala comigo.', 'confused');
    const n = normalize(text);

    if (pending) {
      if (CANCEL.test(n)) { pending = null; return r('Cancelado. Nada foi salvo.', 'happy'); }
      const intent = detectIntent(text);
      const isQuick = lastQuick.some((q) => normalize(q) === n);
      const looksNew = !isQuick && STRONG.has(intent) && n.split(' ').length >= 3 && !/^(sim|nao|pode)/.test(n);
      if (!looksNew) {
        const res = handlePending(text);
        if (res) return res;
      }
      pending = null;
    }

    // "Anota: ..." vindo do botão de fallback
    if (/^anota[:\s]/.test(n)) return continueDraft({ kind: 'task', title: text.replace(/^anota[:\s]+/i, '').replace(/^./, (c) => c.toUpperCase()), noDate: true });
    if (/^abrir jornada$/.test(n)) return r('Abrindo o mapa.', 'excited', { effects: { navigate: 'jornada' } });
    if (/^passa as pendentes pra amanha$/.test(n)) {
      const today = ymd(store.now());
      const tomorrow = ymd(addDays(store.now(), 1));
      const ids = store.itemsOn(today).filter((i) => !store.isDone(i, today) && !i.recurrence && i.kind === 'task').map((i) => i.id);
      const moved = ids.filter((id) => store.reschedule(id, { date: tomorrow }).ok).length;
      return r(moved ? `Passei ${moved} pra amanhã.` : 'Não tinha tarefa pendente pra passar.', 'happy');
    }

    const p = parse(text, store.now());
    switch (p.intent) {
      case 'greeting': {
        const h = store.now().getHours();
        const key = h < 12 ? 'greetMorning' : h < 18 ? 'greetAfternoon' : 'greetNight';
        const list = listReply('today');
        return r(`${say(key, S(), { nome: nome() })} ${list.text}`, h >= 22 ? 'sleepy' : 'happy', { cards: list.cards });
      }
      case 'thanks': return r(S() === 'exigente' ? 'De nada. Agora volta pro trabalho.' : 'De nada! Tô por aqui.', 'happy');
      case 'help': return helpReply();
      case 'list': return listReply(p.range);
      case 'complete': return withItem(p.target, 'complete', {}, 'Qual tu terminou?');
      case 'reschedule': return withItem(p.target, 'reschedule', { date: p.date, time: p.time, ambiguous: p.ambiguous }, 'Qual eu remarco?');
      case 'delete': return withItem(p.target, 'delete', {}, 'Qual eu apago?');
      case 'goal': return goalReply(p.title);
      case 'breakdown': return breakdownReply(p.title);
      case 'find_slot': return slotReply(p);
      case 'save_me': return saveMeReply();
      case 'struggle': return struggleReply();
      case 'plan_week': return weekReply();
      case 'summary': return summaryReply();
      case 'advice': return openQuestion(text, 'advice');
      case 'task':
      case 'event': return continueDraft(draftFrom(p, text));
      default:
        if (p.title && (p.date || p.time)) return continueDraft(draftFrom(p, text));
        return openQuestion(text, 'unknown');
    }
  }

  async function handleAndTrack(input) {
    const res = await handle(input);
    lastQuick = res?.quick || [];
    return res;
  }

  return {
    handle: handleAndTrack,
    get pending() { return pending; },
    reset() { pending = null; },
  };
}
