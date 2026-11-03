// Falas do Guia. Variações por nível de cobrança, evitando repetição.
// Regra: humor sim, humilhação e culpa não.

const recent = [];
export function pick(list) {
  const fresh = list.filter((l) => !recent.includes(l));
  const pool = fresh.length ? fresh : list;
  const line = pool[Math.floor(Math.random() * pool.length)];
  recent.push(line);
  if (recent.length > 12) recent.shift();
  return line;
}

const L = {
  greetMorning: {
    suave: ['Bom dia, {nome}. Vamos com calma hoje.', 'Bom dia! Café primeiro, missões depois.'],
    equilibrado: ['Bom dia, {nome}. Bora ver o que tem pra hoje.', 'Bom dia, criatura. O mapa tá aberto.', 'Acordou! Ótimo, eu já tava de mochila pronta.'],
    exigente: ['Bom dia, {nome}. O dia começou e as missões não vão se fazer sozinhas.', 'Bom dia. Mochila nas costas, que hoje tem trabalho.'],
  },
  greetAfternoon: {
    suave: ['Boa tarde, {nome}. Como tá indo?'],
    equilibrado: ['Boa tarde, {nome}. Ainda dá tempo de muita coisa.', 'Boa tarde! Metade do dia, metade da trilha.'],
    exigente: ['Boa tarde. Metade do dia já foi. Bora acelerar.'],
  },
  greetNight: {
    suave: ['Boa noite, {nome}. Hora de desacelerar.'],
    equilibrado: ['Boa noite, {nome}. Vamos fechar o dia?', 'Boa noite! Eu já tô meio sonolento, mas sigo aqui.'],
    exigente: ['Boa noite. Antes de dormir: o que ficou pendente?'],
  },
  dayIntro: {
    suave: ['Temos {n} hoje. Uma de cada vez.'],
    equilibrado: ['Temos {n} hoje. E antes que tu invente mais quinze, vamos terminar essas.', '{n} no mapa de hoje. Dá pra encarar.'],
    exigente: ['{n} hoje. Nada de inventar desculpa nova.', '{n}. Eu vou cobrar uma por uma.'],
  },
  dayEmpty: {
    suave: ['Nada marcado pra hoje. Dia livre também é bom.'],
    equilibrado: ['Mapa vazio hoje. Quer que eu ajude a escolher uma missão?', 'Nenhuma missão hoje. Suspeito, mas aceito.'],
    exigente: ['Nada marcado hoje? Escolhe pelo menos uma coisa que te leve pra frente.'],
  },
  done: {
    suave: ['Feito! Muito bem.', 'Uma a menos. Bom trabalho.'],
    equilibrado: ['FINALMENTE! Uma a menos. Tá vendo? Nem precisou sofrer tanto.', 'Riscada do mapa!', 'Isso! Mais uma pra conta.', 'Feito. Próxima?'],
    exigente: ['Feito. Viu como era possível? Próxima.', 'Uma a menos. Não para agora.'],
  },
  allDone: {
    suave: ['Tudo concluído hoje. Pode descansar sem culpa.'],
    equilibrado: ['Zerou o dia! Isso aqui mereceu até uma estrelinha nova no mapa.', 'Todas as missões de hoje feitas. Eu tô orgulhoso, de verdade.'],
    exigente: ['Dia zerado. Assim que eu gosto.'],
  },
  postponed: {
    suave: ['Tudo bem remarcar. Quer que eu deixe ela menor?'],
    equilibrado: ['Olha só quem voltou: a tarefa de ontem. Quer que eu diminua ela ou tu vai encarar?'],
    exigente: ['De novo essa? Ou a gente divide ela em pedaços ou tu encara agora.'],
  },
  stuck: {
    suave: ['Essa já foi adiada {n} vezes. Talvez ela esteja grande demais. Vamos dividir?'],
    equilibrado: ['Tá, isso aqui não tá funcionando: {n} adiamentos. Vamos mudar a estratégia em vez de repetir a mesma coisa.'],
    exigente: ['{n} adiamentos. Chega de empurrar: ou divide, ou marca um horário fixo, ou apaga.'],
  },
  comeback: {
    suave: ['Que bom te ver de volta! Vamos recomeçar com uma coisa só.'],
    equilibrado: ['Olha quem voltou! Sem sermão: vamos escolher uma missão pequena pra retomar.', 'Senti tua falta. O mapa continua aqui. Uma missão pequena pra começar?'],
    exigente: ['Voltou! Ótimo. Nada de compensar tudo hoje: uma missão e a gente retoma o ritmo.'],
  },
  created: {
    suave: ['Anotado.', 'Pronto, tá no mapa.'],
    equilibrado: ['Feito.', 'Anotado.', 'Pronto.', 'Tá na mochila.'],
    exigente: ['Anotado. Agora não esquece.', 'Feito. Vou cobrar.'],
  },
  overload: {
    suave: ['Hoje tá cheio. Que tal escolher só três coisas?'],
    equilibrado: ['O dia tá lotado. Vou mostrar só as três que importam mais.'],
    exigente: ['Dia lotado. Foco nas três primeiras, o resto espera.'],
  },
  unknown: {
    suave: ['Hmm, essa eu não entendi.'],
    equilibrado: ['Essa eu não peguei.', 'Hmm, não entendi essa. Meu cérebro de cogumelo tem limites.'],
    exigente: ['Não entendi. Fala de outro jeito.'],
  },
};

export const missoes = (n) => `${n} ${n === 1 ? 'missão' : 'missões'}`;

export function say(key, strictness = 'equilibrado', vars = {}) {
  const group = L[key];
  if (!group) return '';
  const list = group[strictness] || group.equilibrado;
  let s = pick(list);
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s.replace(/,?\s*\{nome\}/g, '').replace(/\s+\./g, '.');
}
