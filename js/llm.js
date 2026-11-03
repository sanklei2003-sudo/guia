// Camada 2 (opcional): IA local via Ollama.
// Só é usada se o usuário ativar nas configurações e o servidor responder.
// Nada aqui é necessário para os comandos básicos.

export async function ollamaStatus(url, timeout = 2500) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const r = await fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const data = await r.json();
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'sem resposta' : 'não conectou' };
  }
}

/** Monta um contexto curto com dados reais (respeitando a permissão do usuário). */
export function buildContext(store, planner) {
  const s = store.state;
  const today = store.now().toISOString().slice(0, 10);
  const pr = planner.priorities(store, 5).map((i) => `- ${i.title}${i.date ? ` (${i.date}${i.time ? ' ' + i.time : ''})` : ''}`).join('\n');
  const goals = s.goals.map((g) => `- ${g.title}: ${g.steps.filter((x) => x.done).length}/${g.steps.length} etapas`).join('\n');
  return `Hoje é ${today}. Usuário: ${s.profile.name || 'sem nome'}.\nPrioridades:\n${pr || '- nenhuma'}\nObjetivos:\n${goals || '- nenhum'}`;
}

export async function askOllama({ url, model, question, context, history = [], timeout = 90000 }) {
  const system = 'Você é o Guia, um cogumelo explorador que ajuda com produtividade. Responda em português brasileiro, '
    + 'de forma curta, prática e bem-humorada, sem elogios vazios. Nunca diga que criou, marcou ou alterou algo: '
    + 'você só aconselha; ações são feitas pelo app. Se não souber, diga que não sabe.\n\nDados do usuário:\n' + context;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model, stream: false,
        messages: [{ role: 'system', content: system }, ...history.slice(-6), { role: 'user', content: question }],
        options: { temperature: 0.6, num_predict: 400 },
      }),
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const data = await r.json();
    const text = data.message?.content?.trim();
    return text ? { ok: true, text } : { ok: false, reason: 'resposta vazia' };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, reason: e.name === 'AbortError' ? 'demorou demais' : 'não conectou' };
  }
}
