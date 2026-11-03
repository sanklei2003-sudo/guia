// Testes de aceitação dos fluxos críticos. Rodar com: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { createBrain } from '../js/brain.js';
import { parse } from '../js/parser.js';

// Terça, 03/11/2026, 10h
const NOW = new Date(2026, 10, 3, 10, 0);
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
function setup(storage = memStorage()) {
  const store = createStore(storage, () => NOW);
  const brain = createBrain(store, { llm: null });
  return { store, brain, storage };
}

test('cria tarefa e encontra depois de "fechar e reabrir"', () => {
  const storage = memStorage();
  const a = setup(storage);
  assert.ok(a.store.addItem({ title: 'Comprar tinta', date: '2026-11-04' }).ok);
  const b = setup(storage); // nova instância, mesmo armazenamento
  assert.equal(b.store.state.items.length, 1);
  assert.equal(b.store.state.items[0].title, 'Comprar tinta');
});

test('"me lembra de estudar amanhã às 15h" gera registro correto', async () => {
  const { store, brain } = setup();
  const r = await brain.handle('me lembra de estudar amanhã às 15h');
  const it = store.state.items[0];
  assert.equal(it.title, 'Estudar');
  assert.equal(it.date, '2026-11-04');
  assert.equal(it.time, '15:00');
  assert.match(r.text, /Estudar amanhã às 15h/);
});

test('fluxo de pergunta: "me lembra de estudar amanhã" → "umas 15h" → "sim"', async () => {
  const { store, brain } = setup();
  const r1 = await brain.handle('Me lembra de estudar amanhã.');
  assert.match(r1.text, /Que horas/);
  assert.equal(store.state.items.length, 0, 'não cria antes de ter o horário');
  const r2 = await brain.handle('Umas 15h.');
  assert.match(r2.text, /Estudar amanhã às 15h/);
  await brain.handle('sim');
  assert.equal(store.state.items[0].duration, 30);
});

test('data ambígua pede esclarecimento', async () => {
  const { store, brain } = setup();
  const r = await brain.handle('dentista terça às 16h'); // hoje é terça
  assert.match(r.text, /Hoje mesmo ou/);
  assert.equal(store.state.items.length, 0);
  await brain.handle('semana que vem');
  assert.equal(store.state.items[0].date, '2026-11-10');
});

test('horário ambíguo ("às 3") pede esclarecimento', async () => {
  const { store, brain } = setup();
  const r = await brain.handle('me lembra de ligar pro cliente amanhã às 3');
  assert.match(r.text, /manhã ou/);
  await brain.handle('da tarde');
  assert.equal(store.state.items[0].time, '15:00');
});

test('"semana que vem" sem dia pede o dia', async () => {
  const { store, brain } = setup();
  const r = await brain.handle('reunião com a turma semana que vem');
  assert.match(r.text, /Qual dia/);
  assert.equal(store.state.items.length, 0);
});

test('concluir tarefa atualiza progresso e XP', async () => {
  const { store, brain } = setup();
  store.addItem({ title: 'Comprar tinta', date: '2026-11-03' });
  const r = await brain.handle('terminei comprar tinta');
  assert.equal(store.state.items[0].done, true);
  assert.equal(store.state.stats.history['2026-11-03'], 1);
  assert.ok(store.state.stats.xp > 0);
  assert.ok(r.effects.celebrate);
});

test('remarcar não duplica e conta adiamento', async () => {
  const { store, brain } = setup();
  store.addItem({ title: 'Estudar', date: '2026-11-03' });
  await brain.handle('remarca estudar para sexta');
  assert.equal(store.state.items.length, 1);
  assert.equal(store.state.items[0].date, '2026-11-06');
  assert.equal(store.state.items[0].postponed, 1);
});

test('três adiamentos sugerem mudar a estratégia', async () => {
  const { store, brain } = setup();
  const { item } = store.addItem({ title: 'Lavar a louça', date: '2026-11-03' });
  store.reschedule(item.id, { date: '2026-11-04' });
  store.reschedule(item.id, { date: '2026-11-05' });
  const r = await brain.handle('adia lavar a louça para sexta');
  assert.match(r.text, /3/);
  await brain.handle('dividir em partes');
  assert.ok(store.state.items.some((i) => i.title.startsWith('Primeiros 15 min')));
});

test('criar objetivo mostra etapas e cria jornada', async () => {
  const { store, brain } = setup();
  const r = await brain.handle('novo objetivo: melhorar minha divulgação no instagram');
  assert.match(r.text, /etapas/);
  await brain.handle('cria');
  assert.equal(store.state.goals.length, 1);
  assert.ok(store.state.goals[0].steps.length >= 5);
});

test('concluir etapa avança progresso da jornada', () => {
  const { store } = setup();
  const { goal } = store.addGoal({ title: 'Aprender inglês', steps: ['A', 'B'] });
  store.toggleStep(goal.id, goal.steps[0].id);
  assert.equal(store.goalProgress(store.getGoal(goal.id)), 0.5);
});

test('tarefa vinculada a etapa conclui a etapa', () => {
  const { store } = setup();
  const { goal } = store.addGoal({ title: 'Projeto', steps: ['Esboço'] });
  const r = store.scheduleStep(goal.id, goal.steps[0].id, { date: '2026-11-03' });
  store.toggleDone(r.item.id);
  assert.equal(store.getGoal(goal.id).steps[0].done, true);
});

test('trabalho grande vira jornada com tarefas até o prazo', async () => {
  const { store, brain } = setup();
  await brain.handle('Tenho um trabalho enorme da faculdade. Me ajuda a organizar?');
  const r = await brain.handle('sexta');
  assert.match(r.text, /Plano até/);
  await brain.handle('cria');
  assert.equal(store.state.goals.length, 1);
  const tasks = store.state.items.filter((i) => i.goalId);
  assert.equal(tasks.length, store.state.goals[0].steps.length);
  assert.ok(tasks.every((t) => t.date >= '2026-11-03' && t.date <= '2026-11-06'));
});

test('sugere horário livre respeitando compromissos', async () => {
  const { store, brain } = setup();
  store.addItem({ title: 'Reunião', kind: 'event', date: '2026-11-04', time: '13:00', duration: 120 });
  const r = await brain.handle('marca 40 minutos para estudar na quarta de tarde');
  assert.match(r.text, /15h/);
  await brain.handle('sim');
  const it = store.state.items.find((i) => i.title === 'Estudar');
  assert.equal(it.time, '15:00');
  assert.equal(it.duration, 40);
});

test('detecta conflito de horário', async () => {
  const { store, brain } = setup();
  store.addItem({ title: 'Aula', kind: 'event', date: '2026-11-06', time: '14:00', duration: 60 });
  const r = await brain.handle('coloca na minha agenda uma reunião na sexta às 14h');
  assert.match(r.text, /bate com "Aula"/);
  assert.equal(store.state.items.length, 1);
});

test('não confirma ação que falhou', async () => {
  const storage = memStorage();
  const { store, brain } = setup(storage);
  storage.setItem = () => { throw new Error('cheio'); };
  const r = await brain.handle('me lembra de pagar conta amanhã às 10h');
  assert.match(r.text, /Não consegui/);
  assert.equal(store.state.items.length, 0);
});

test('apagar pede confirmação', async () => {
  const { store, brain } = setup();
  store.addItem({ title: 'Dentista', date: '2026-11-05' });
  await brain.handle('apaga dentista');
  assert.equal(store.state.items.length, 1);
  await brain.handle('sim, apaga');
  assert.equal(store.state.items.length, 0);
});

test('comandos básicos funcionam sem IA local', async () => {
  const { brain } = setup();
  const r = await brain.handle('Como posso melhorar minha estratégia de divulgação?');
  assert.match(r.text, /sem IA local/);
});

test('Me salva não altera nada sem autorização', async () => {
  const { store, brain } = setup();
  for (let k = 0; k < 15; k++) store.addItem({ title: `Tarefa ${k}`, date: '2026-11-03', duration: 60, priority: k < 2 ? 1 : 3 });
  const r = await brain.handle('me salva');
  assert.match(r.text, /Posso\?/);
  assert.ok(store.state.items.every((i) => i.date === '2026-11-03'));
  await brain.handle('pode mover');
  assert.ok(store.state.items.some((i) => i.date === '2026-11-04'));
});

test('nível de cobrança suave não cobra ao adiar uma vez', async () => {
  const { store, brain } = setup();
  store.updateProfile({ strictness: 'suave' });
  store.addItem({ title: 'Estudar', date: '2026-11-03' });
  const r = await brain.handle('remarca estudar para amanhã');
  assert.equal(r.quick.length, 0);
});

test('recorrência diária aparece todos os dias e conclui por ocorrência', () => {
  const { store } = setup();
  const { item } = store.addItem({ title: 'Beber água', date: '2026-11-03', recurrence: 'daily' });
  assert.equal(store.itemsOn('2026-11-10').length, 1);
  store.toggleDone(item.id, '2026-11-03');
  assert.ok(store.isDone(item, '2026-11-03'));
  assert.ok(!store.isDone(item, '2026-11-04'));
});

test('parser entende formatos de data comuns', () => {
  assert.equal(parse('reunião dia 15/11 às 9h30', NOW).date, '2026-11-15');
  assert.equal(parse('reunião dia 15/11 às 9h30', NOW).time, '09:30');
  assert.equal(parse('prova em 3 dias', NOW).date, '2026-11-06');
  assert.equal(parse('aula 20 de novembro às 19h', NOW).date, '2026-11-20');
  assert.equal(parse('almoço ao meio-dia', NOW).time, '12:00');
  assert.equal(parse('tatuagem sábado às 14h por 3 horas', NOW).duration, 180);
});
