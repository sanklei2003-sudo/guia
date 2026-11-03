// Interpretador local de comandos em português brasileiro.
// Não usa IA: regras, expressões regulares e processamento de datas.

import { addDays, ymd, pad } from './dates.js';

// Normaliza mantendo o MESMO comprimento do texto original
// (necessário para recortar o título a partir do texto original).
export function normalize(text) {
  return [...text.toLowerCase()].map((c) => c.normalize('NFD')[0]).join('');
}

const WD = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const MONTHS = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7,
  agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const NUM_WORDS = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 };

const PERIODS = {
  manha: { start: '08:00', end: '12:00' },
  tarde: { start: '13:00', end: '18:00' },
  noite: { start: '19:00', end: '22:00' },
};

/**
 * Extrai data, horário, duração e período do texto.
 * Retorna também os trechos usados, para que sejam removidos do título.
 */
export function extractWhen(original, now = new Date()) {
  const text = normalize(original);
  const spans = [];
  const out = { date: null, time: null, duration: null, period: null, ambiguous: null };
  const take = (m, offset = 0) => spans.push([m.index + offset, m.index + offset + m[0].length - offset]);

  // ---------- Duração ----------
  let m = text.match(/\b(?:por |durante |de )?(\d+|meia|uma)\s*(?:horas?|hrs?)(?:\s*e\s*(\d+)\s*(?:minutos?|min))?\b/);
  if (m && !/\bas\s*$/.test(text.slice(0, m.index))) {
    const h = m[1] === 'meia' ? 0.5 : m[1] === 'uma' ? 1 : Number(m[1]);
    out.duration = Math.round(h * 60) + (m[2] ? Number(m[2]) : 0);
    take(m);
  }
  m = text.match(/\bmeia hora\b/);
  if (m && !out.duration) { out.duration = 30; take(m); }
  m = text.match(/\b(?:por |durante )?(\d+)\s*(?:minutos?|min)\b/);
  if (m && !out.duration) { out.duration = Number(m[1]); take(m); }

  // ---------- Período do dia ----------
  m = text.match(/\b(?:de |a |pela |na |no |durante a )?(manha|tarde|noite)\b/);
  if (m) { out.period = m[1]; take(m); }

  // ---------- Horário ----------
  const isTaken = (idx) => spans.some(([a, b]) => idx >= a && idx < b);
  let hour = null;
  let minute = 0;
  let explicit24 = false;
  m = text.match(/\b(?:as |a partir das |umas |la pelas |pelas |por volta das |ate as )?(\d{1,2})(?::|h)(\d{2})\b/);
  if (m && !isTaken(m.index)) {
    hour = Number(m[1]); minute = Number(m[2]); explicit24 = hour >= 13 || hour === 0; take(m);
  } else {
    m = text.match(/\b(?:as |a partir das |umas |la pelas |pelas |por volta das |ate as )?(\d{1,2})\s?h(?:oras?|rs?)?\b/);
    if (m && !isTaken(m.index)) {
      hour = Number(m[1]); explicit24 = hour >= 13; take(m);
    } else {
      m = text.match(/\b(?:as|umas|pelas|la pelas|por volta das|ate as)\s+(\d{1,2}|uma|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)(?:\s+e\s+(meia|\d{1,2}))?\b/);
      if (m && !isTaken(m.index)) {
        hour = /\d/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]];
        if (m[2]) minute = m[2] === 'meia' ? 30 : Number(m[2]);
        explicit24 = hour >= 13;
        take(m);
      }
    }
  }
  m = text.match(/\b(?:ao |as |ao )?meio[- ]dia(?: e meia)?\b/);
  if (m && hour === null) { hour = 12; minute = /meia$/.test(m[0]) ? 30 : 0; explicit24 = true; take(m); }
  m = text.match(/\b(?:a )?meia[- ]noite\b/);
  if (m && hour === null) { hour = 0; explicit24 = true; take(m); }

  if (hour !== null) {
    if (hour > 23 || minute > 59) {
      hour = null;
    } else if (!explicit24 && hour <= 12) {
      if (out.period === 'tarde' || out.period === 'noite') {
        if (hour < 12) hour += 12;
      } else if (out.period === 'manha') {
        if (hour === 12) hour = 0;
      } else if (hour >= 1 && hour <= 6) {
        // "às 3" sem período: pode ser 3h ou 15h
        out.ambiguous = { field: 'time', options: [`${pad(hour)}:${pad(minute)}`, `${pad(hour + 12)}:${pad(minute)}`] };
      }
    }
    if (hour !== null) out.time = `${pad(hour)}:${pad(minute)}`;
  }

  // ---------- Data ----------
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const setDate = (d) => { out.date = ymd(d); };

  if ((m = text.match(/\bdepois de amanha\b/))) { setDate(addDays(today, 2)); take(m); }
  else if ((m = text.match(/\bamanha\b/))) { setDate(addDays(today, 1)); take(m); }
  else if ((m = text.match(/\bhoje\b|\bagora\b|\bmais tarde\b|\bhj\b/))) { setDate(today); take(m); }
  else if ((m = text.match(/\bem (\d+|um|uma|dois|duas|tres) (dias?|semanas?)\b/))) {
    const n = /\d/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]];
    setDate(addDays(today, /semana/.test(m[2]) ? n * 7 : n)); take(m);
  }
  else if ((m = text.match(/\b(?:(?:na|no|nessa|nesta|essa|esta|proxima|proximo|na proxima|no proximo)\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira| feira)?(\s+que vem|\s+da semana que vem)?\b/))) {
    const wd = WD[m[1]];
    const forceNext = /proxim/.test(m[0]) || Boolean(m[2]);
    let diff = (wd - today.getDay() + 7) % 7;
    if (diff === 0) {
      if (forceNext) diff = 7;
      else out.ambiguous = out.ambiguous || { field: 'date', options: [ymd(today), ymd(addDays(today, 7))] };
    } else if (/da semana que vem/.test(m[0]) && diff < 7) {
      // "quarta da semana que vem": sempre na semana seguinte
      const nextMonday = addDays(today, ((1 - today.getDay() + 7) % 7) || 7);
      diff = (wd === 0 ? 6 : wd - 1) + Math.round((nextMonday - today) / 86400000);
    }
    setDate(addDays(today, diff)); take(m);
  }
  else if ((m = text.match(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    let y = m[3] ? Number(m[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && d < today) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
    if (d.getDate() === Number(m[1])) { setDate(d); take(m); }
  }
  else if ((m = text.match(/\b(?:dia\s+)?(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/))) {
    let d = new Date(today.getFullYear(), MONTHS[m[2]] - 1, Number(m[1]));
    if (d < today) d = new Date(today.getFullYear() + 1, MONTHS[m[2]] - 1, Number(m[1]));
    setDate(d); take(m);
  }
  else if ((m = text.match(/\b(?:no |pro |para o )?dia (\d{1,2})\b/))) {
    const n = Number(m[1]);
    let d = new Date(today.getFullYear(), today.getMonth(), n);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, n);
    if (n >= 1 && n <= 31) { setDate(d); take(m); }
  }
  else if ((m = text.match(/\b(semana que vem|proxima semana|fim de semana|final de semana)\b/))) {
    // Período sem dia definido: pedir esclarecimento
    out.ambiguous = out.ambiguous || { field: 'date', vague: m[1] };
    take(m);
  }

  return { ...out, spans };
}

// ---------- Intenções ----------

const INTENTS = [
  ['help', /^(ajuda|help|o que (voce|tu) (faz|sabe fazer)|comandos|como (te uso|funciona))\b/],
  ['greeting', /^(oi|ola|e ai|eai|bom dia|boa tarde|boa noite|fala|salve|opa)\b[!.,\s]*$/],
  ['thanks', /^(valeu|obrigad[oa]|vlw|brigad[oa]|show|top|massa)\b/],
  ['save_me', /\b(me salva|socorro|to sobrecarregad|estou sobrecarregad|sobrecarga|nao sei por onde comecar|muita coisa pra fazer|to perdid|estou perdid)/],
  ['struggle', /\b(nao (to|estou) conseguindo|nao consigo cumprir|nao consigo fazer|nao to dando conta|procrastin|desanimad|sem motivacao)/],
  ['summary', /\b(resumo do dia|como foi (meu|o) dia|fechamento|balanco do dia)\b/],
  ['plan_week', /\b(organiza|organizar|planeja|planejar) (a |minha )?semana\b/],
  ['complete', /^(conclui|concluir|terminei|terminar|finalizei|fiz|feito|marca(r)? como (feito|concluid[oa])|completei|acabei)\b/],
  ['reschedule', /^(remarca|remarcar|adia|adiar|muda|mudar|passa|passar|move|mover|joga|jogar)\b/],
  ['delete', /^(apaga|apagar|exclui|excluir|deleta|deletar|remove|remover|cancela|cancelar|tira|tirar)\b/],
  ['goal', /\b(novo objetivo|criar objetivo|cria (um )?objetivo|quero (aprender|melhorar|conseguir|alcancar|desenvolver)|meu objetivo e|nova jornada)\b/],
  ['breakdown', /\b(me ajuda a organizar|divide|dividir|quebra|quebrar|organiza (esse|este|o|um) (trabalho|projeto)|trabalho (enorme|grande)|projeto (enorme|grande))\b/],
  ['event', /^(coloca|bota|poe|põe|adiciona) (isso )?na (minha )?agenda|^(marca|agenda|agendar|marcar) (uma|um|o|a)?\s*(reuniao|consulta|aula|encontro|compromisso|evento|sessao|tatuagem|horario)/],
  ['find_slot', /\b(marca|reserva|bloqueia|separa)\s+(\d+|meia|uma)\s*(minutos?|min|horas?|hora)\b/],
  ['list', /\b(o que (eu )?(tenho|tem)|o que (eu )?preciso|minhas tarefas|minha agenda|pendencias|pendente|lista|quais (sao )?(as )?(minhas )?(tarefas|missoes)|o que falta|agenda de|tenho algo)\b/],
  ['advice', /\b(como (posso|eu posso|faco pra|faco para) melhorar|estrategia|dica|conselho|como melhorar)\b/],
  ['event', /\b(coloca na (minha )?agenda|marca (uma |um )?|agenda (uma |um )|reuniao|consulta|aula|encontro|compromisso|evento|sessao)\b/],
  ['task', /\b(me lembra|me lembre|lembra(r)? de|lembrete|cria(r)? (uma )?tarefa|adiciona(r)?|anota|anotar|preciso|tenho que|tarefa|nao deixa eu esquecer)\b/],
];

const PREFIXES = [
  /^(guia|ei guia|oi guia)[,!:\s]+/,
  /^(por favor|pfv|pf)[,\s]+/,
  /^(me lembra(r)?|me lembre|lembra(r)?|lembrete)( de| que| da| do)?\s+/,
  /^(eu )?(preciso|tenho que|tenho de|devo)( de)?\s+/,
  /^(cria(r)?|adiciona(r)?|anota(r)?|coloca(r)?|marca(r)?|agenda(r)?|bota(r)?|poe|põe)( uma| um)?( nova| novo)?( tarefa| lembrete| evento| compromisso)?( de| para| pra)?\s+/,
  /^(na (minha )?agenda|no calendario)\s+/,
  /^(que|de|para|pra|um|uma|a|o)\s+/,
];

/** Recorta o título a partir do texto original, removendo datas e comandos. */
export function extractTitle(original, spans, extraPrefixes = []) {
  let chars = [...original];
  for (const [a, b] of spans) for (let i = a; i < b && i < chars.length; i++) chars[i] = ' ';
  let t = chars.join('').replace(/\s+/g, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of [...extraPrefixes, ...PREFIXES]) {
      const n = normalize(t);
      const mm = n.match(re);
      if (mm && mm[0].length) { t = t.slice(mm[0].length).trim(); changed = true; }
    }
  }
  t = t.replace(/[\s,.;:!?]+(e|de|da|do|para|pra|no|na|as|às|em|que)?[\s,.;:!?]*$/i, '').trim();
  t = t.replace(/\s+(de|da|do|para|pra|no|na|em|as|às)$/i, '').trim();
  t = t.replace(/[.!?]+$/, '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function detectIntent(text) {
  const n = normalize(text).replace(/^(guia|ei guia|oi guia)[,!:\s]+/, '').trim();
  for (const [name, re] of INTENTS) if (re.test(n)) return name;
  return 'unknown';
}

/** Interpreta uma frase completa. */
export function parse(text, now = new Date()) {
  const intent = detectIntent(text);
  const when = extractWhen(text, now);
  const result = { intent, ...when, title: '' };
  if (['task', 'event', 'find_slot', 'goal', 'breakdown', 'unknown'].includes(intent)) {
    const extra = [
      /^(novo objetivo|criar objetivo|cria( um)? objetivo|nova jornada|meu objetivo e)[:\s]*/,
      /^(quero)\s+/,
      /^(me ajuda a organizar|divide|dividir|quebra|quebrar)\s+/,
      /^(tenho )?(um |uma )?(trabalho|projeto) (enorme|grande)( da| de| do)?\s*/,
      /^(marca|reserva|bloqueia|separa)\s+/,
    ];
    result.title = extractTitle(text, when.spans, extra);
  }
  if (['complete', 'reschedule', 'delete'].includes(intent)) {
    result.target = extractTitle(text, when.spans, [
      /^(conclui|concluir|terminei|terminar|finalizei|fiz|feito|completei|acabei|marca(r)? como (feito|concluid[oa]))( a| o| de)?[:\s]*/,
      /^(remarca|remarcar|adia|adiar|muda|mudar|passa|passar|move|mover|joga|jogar)( a| o)?\s*/,
      /^(apaga|apagar|exclui|excluir|deleta|deletar|remove|remover|cancela|cancelar|tira|tirar)( a| o)?\s*/,
      /^(tarefa|evento|compromisso|lembrete)( de)?\s+/,
    ]);
  }
  if (intent === 'breakdown') {
    const t = normalize(text);
    const cut = t.search(/[.?!]\s*me ajuda|\s*me ajuda a organizar/);
    let base = cut > 0 ? text.slice(0, cut) : text;
    base = base.replace(/^(guia[,\s]+)?(tenho|to com|estou com)\s+(um|uma)\s+/i, '').replace(/\s+(enorme|gigante|grande|imenso)\b/i, '')
      .replace(/^(me ajuda a organizar|divide|dividir|quebra|quebrar)\s+/i, '').replace(/[.?!]+$/, '').trim();
    result.title = base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
  }
  if (intent === 'list') {
    const n = normalize(text);
    result.range = /semana/.test(n) ? 'week' : /amanha/.test(n) ? 'tomorrow' : 'today';
    if (/pendenc|atrasad|pendente/.test(n)) result.range = 'pending';
  }
  return result;
}

/** Interpreta só um horário/data em respostas curtas ("umas 15h", "de tarde"). */
export function parseAnswer(text, now = new Date()) {
  const n = normalize(text).trim();
  const when = extractWhen(`as ${n.replace(/^(as|umas|pelas|la pelas)\s+/, '')}`, now);
  const plain = extractWhen(text, now);
  const yes = /^(sim|s|isso|pode|claro|bora|ok|beleza|blz|quero|pode ser|uhum|aham|manda|fechou|vamos)\b/.test(n);
  const no = /^(nao|n|nem|deixa|cancela|esquece|negativo)\b/.test(n);
  const bareHour = n.match(/^(\d{1,2})$/);
  return {
    yes, no,
    time: plain.time || (bareHour || /^(as|umas|pelas)/.test(n) ? when.time : null),
    timeAmbiguous: (plain.time ? plain.ambiguous : when.ambiguous)?.field === 'time' ? (plain.time ? plain.ambiguous : when.ambiguous) : null,
    date: plain.date,
    period: plain.period,
    duration: plain.duration,
    noTime: /\b(sem horario|qualquer hora|tanto faz|nao tem horario|sem hora|o dia todo|dia todo)\b/.test(n),
    raw: n,
  };
}

export { PERIODS };
