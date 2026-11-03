// Tela JORNADA: cada objetivo é um mapa ilustrado com etapas reais.
import { esc, ICON } from '../ui.js';
import { mascotSVG } from '../mascot.js';
import { friendlyDate } from '../dates.js';
import { ACHIEVEMENTS } from '../store.js';

export const jornadaState = { goalId: null };
const walkerPos = {}; // última posição desenhada por objetivo (para animar a caminhada)

const REGIONS = [
  { name: 'Campina', bg: '#CDEBB8', ground: '#9FD38A' },
  { name: 'Bosque', bg: '#B9DEA4', ground: '#7CC46A' },
  { name: 'Serra', bg: '#E8D7B5', ground: '#D2B98A' },
  { name: 'Picos', bg: '#D7EEFB', ground: '#B7D6E8' },
];

function nodePos(i, n, W, H) {
  const top = 120;
  const y = H - 90 - (i * (H - 90 - top)) / Math.max(1, n - 1);
  const x = i % 2 === 0 ? 92 : W - 92;
  return { x: n === 1 ? W / 2 : x, y };
}

export function mapSVG(ctx, goal) {
  const { store } = ctx;
  const n = goal.steps.length;
  const W = 360;
  const H = Math.max(420, 200 + n * 105);
  const pts = goal.steps.map((_, i) => nodePos(i, n, W, H));
  const current = goal.steps.findIndex((s) => !s.done);
  const allDone = current === -1 && n > 0;
  const reached = allDone ? n : Math.max(0, current);

  // Caminho sinuoso
  let d = `M ${W / 2} ${H - 10} Q ${W / 2} ${H - 50} ${pts[0]?.x ?? W / 2} ${pts[0]?.y ?? H - 90}`;
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1]; const b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  const last = pts[n - 1] || { x: W / 2, y: H - 90 };
  d += ` Q ${last.x} 80 ${W / 2} 62`;

  // Faixas de região (de baixo para cima), as não alcançadas ficam com névoa
  const bands = [];
  const per = Math.max(1, Math.ceil(n / 3));
  const regionCount = Math.min(REGIONS.length, Math.ceil(n / per) + 1);
  const bandH = H / regionCount;
  for (let r = 0; r < regionCount; r++) {
    const y = H - (r + 1) * bandH;
    const unlocked = reached >= r * per;
    const R = REGIONS[r];
    bands.push(`<rect x="0" y="${y}" width="${W}" height="${bandH + 1}" fill="${R.bg}"/>
      <path d="M0 ${y + bandH} Q ${W * 0.25} ${y + bandH - 26} ${W / 2} ${y + bandH - 8} T ${W} ${y + bandH - 14} V ${y + bandH} Z" fill="${R.ground}" opacity=".7"/>
      <text x="${W - 12}" y="${y + bandH - 12}" text-anchor="end" font-family="Baloo 2, sans-serif" font-weight="600" font-size="13" fill="#141010" opacity=".55">${R.name}${unlocked ? '' : ' · bloqueada'}</text>
      ${unlocked ? '' : `<rect x="0" y="${y}" width="${W}" height="${bandH}" fill="#FFF6E6" opacity=".55"/>`}`);
  }

  // Decoração determinística
  const deco = [];
  for (let i = 0; i < n + 2; i++) {
    const y = H - 60 - i * ((H - 160) / Math.max(1, n));
    const side = i % 2 === 0 ? W - 60 : 50;
    const kind = i % 4;
    if (kind === 0) deco.push(tree(side, y + 10)), deco.push(tree(side + 22, y + 24));
    else if (kind === 1) deco.push(mountain(side, y + 30));
    else if (kind === 2) deco.push(house(side, y + 20));
    else deco.push(rock(side, y + 26));
  }
  // Rio com ponte no meio do caminho
  const ry = H * 0.55;
  deco.push(`<path d="M-10 ${ry} C 80 ${ry - 30}, 140 ${ry + 30}, 200 ${ry} S 320 ${ry - 24}, 380 ${ry + 6}" stroke="#0094FF" stroke-width="18" fill="none" opacity=".85"/>
    <path d="M-10 ${ry} C 80 ${ry - 30}, 140 ${ry + 30}, 200 ${ry} S 320 ${ry - 24}, 380 ${ry + 6}" stroke="#fff" stroke-width="2" stroke-dasharray="6 14" fill="none" opacity=".7"/>`);

  // Nós
  const nodes = goal.steps.map((s, i) => {
    const p = pts[i];
    const isCur = i === current;
    const fill = s.done ? '#3A8D5C' : isCur ? '#FFA900' : '#FFFDF8';
    return `<g class="map-node" tabindex="0" role="button" data-action="step-sheet" data-goal="${goal.id}" data-step="${s.id}" aria-label="Etapa ${i + 1}: ${esc(s.title)}${s.done ? ', concluída' : ''}">
      <ellipse cx="${p.x}" cy="${p.y + 16}" rx="30" ry="8" fill="#141010" opacity=".15"/>
      <circle class="base" cx="${p.x}" cy="${p.y}" r="24" fill="${fill}" stroke="#141010" stroke-width="4"/>
      ${s.done ? `<path d="M${p.x - 9} ${p.y} l6 6 12 -13" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<text x="${p.x}" y="${p.y + 7}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="20" fill="#141010">${i + 1}</text>`}
      ${s.done ? `<path d="M${p.x + 18} ${p.y - 30} l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z" fill="#FFA900" stroke="#141010" stroke-width="1.8"/>` : ''}
      <foreignObject x="${p.x < W / 2 ? p.x + 30 : p.x - 160}" y="${p.y - 22}" width="130" height="50"><div xmlns="http://www.w3.org/1999/xhtml" style="font:700 12px/1.2 Baloo 2, sans-serif;color:#141010;background:#FFFDF8;border:2px solid #141010;border-radius:10px;padding:3px 6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;${s.done ? 'opacity:.7;text-decoration:line-through' : ''}">${esc(s.title)}</div></foreignObject>
    </g>`;
  }).join('');

  // Destino final (castelo + bandeira)
  const castle = `<g transform="translate(${W / 2 - 34} 18)">
    <rect x="8" y="22" width="52" height="34" fill="${allDone ? '#FFA900' : '#EADBC0'}" stroke="#141010" stroke-width="3.5"/>
    <path d="M8 22 v-10 h9 v6 h8 v-6 h9 v6 h8 v-6 h9 v6 h9 v10" fill="${allDone ? '#FFA900' : '#EADBC0'}" stroke="#141010" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M28 56 v-14 a6 6 0 0 1 12 0 v14" fill="#141010"/>
    <path d="M34 12 V-14" stroke="#141010" stroke-width="3"/><path d="M34 -14 h18 l-5 6 5 6 h-18" fill="#C20D02" stroke="#141010" stroke-width="2.5"/>
  </g>`;

  // Mascote caminhante
  const wp = allDone ? { x: W / 2, y: 70 } : n ? pts[reached] : { x: W / 2, y: H - 40 };
  const look = store.state.mascot;
  const walker = mascotSVG(allDone ? 'celebrating' : 'happy', look).replace('<svg ', '<svg x="-30" y="-74" width="60" height="70" ');
  const prev = walkerPos[goal.id];
  walkerPos[goal.id] = wp;

  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa da jornada ${esc(goal.title)}">
    ${bands.join('')}
    ${deco.join('')}
    <path d="${d}" stroke="#141010" stroke-width="16" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="${d}" stroke="#FEF4E3" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="#C20D02" stroke-width="3" fill="none" stroke-dasharray="2 12" stroke-linecap="round"/>
    ${castle}
    ${nodes}
    <g class="map-walker" data-goal="${goal.id}" data-to="${wp.x},${wp.y}" ${prev ? `data-from="${prev.x},${prev.y}"` : ''} transform="translate(${(prev || wp).x} ${(prev || wp).y - 26})">${walker}</g>
  </svg>`;
}

function tree(x, y) { return `<g><rect x="${x - 3}" y="${y}" width="6" height="12" fill="#7A5236"/><circle cx="${x}" cy="${y - 4}" r="13" fill="#4FA35A" stroke="#141010" stroke-width="2.5"/></g>`; }
function mountain(x, y) { return `<g><path d="M${x - 34} ${y} L${x} ${y - 44} L${x + 34} ${y}Z" fill="#B49A78" stroke="#141010" stroke-width="2.5" stroke-linejoin="round"/><path d="M${x - 10} ${y - 31} L${x} ${y - 44} L${x + 10} ${y - 31} L${x + 4} ${y - 27} L${x} ${y - 32} L${x - 5} ${y - 27}Z" fill="#fff"/></g>`; }
function house(x, y) { return `<g><rect x="${x - 13}" y="${y - 14}" width="26" height="20" fill="#FFF6E6" stroke="#141010" stroke-width="2.5"/><path d="M${x - 17} ${y - 13} L${x} ${y - 28} L${x + 17} ${y - 13}Z" fill="#C20D02" stroke="#141010" stroke-width="2.5" stroke-linejoin="round"/><rect x="${x - 4}" y="${y - 6}" width="8" height="12" fill="#141010"/></g>`; }
function rock(x, y) { return `<ellipse cx="${x}" cy="${y}" rx="16" ry="10" fill="#C9BBA4" stroke="#141010" stroke-width="2.5"/>`; }

/** Anima o mascote do ponto anterior até o atual. */
export function animateWalker(root) {
  root.querySelectorAll('.map-walker[data-from]').forEach((g) => {
    const [x, y] = g.dataset.to.split(',').map(Number);
    requestAnimationFrame(() => requestAnimationFrame(() => { g.setAttribute('transform', `translate(${x} ${y - 26})`); g.style.transform = `translate(${x}px, ${y - 26}px)`; }));
  });
}

export function renderJornada(ctx) {
  const { store } = ctx;
  const goals = store.state.goals.filter((g) => !g.archived);
  if (!goals.some((g) => g.id === jornadaState.goalId)) jornadaState.goalId = goals[0]?.id || null;
  const goal = goals.find((g) => g.id === jornadaState.goalId);
  const st = store.state.stats;
  const tabs = `<div class="goal-tabs">${goals.map((g) => `<button class="goal-tab ${g.id === jornadaState.goalId ? 'on' : ''}" data-action="select-goal" data-id="${g.id}">${esc(g.title)} · ${Math.round(store.goalProgress(g) * 100)}%</button>`).join('')}<button class="goal-tab add" data-action="new-goal">+ Nova jornada</button></div>`;

  if (!goal) {
    return `<main class="screen" aria-label="Jornada"><header class="topbar"><h1>Jornada</h1></header>
      <section class="card empty"><div class="mascot" style="width:130px;margin:0 auto">${mascotSVG('excited', store.state.mascot)}</div>
      <p>Nenhuma jornada ainda. Cada objetivo vira um mapa, e cada etapa concluída me faz andar.</p>
      <button class="btn primary" data-action="new-goal">${ICON.flag} Criar primeira jornada</button></section>
      ${rewards(store)}</main>`;
  }

  const done = goal.steps.filter((s) => s.done).length;
  const current = goal.steps.findIndex((s) => !s.done);
  return `<main class="screen" aria-label="Jornada">
    <header class="topbar"><h1>Jornada</h1><span class="chip-level"><b>${done}/${goal.steps.length}</b>etapas</span></header>
    ${tabs}
    <div class="map-wrap">${mapSVG(ctx, goal)}</div>
    <section class="card">
      <div class="card-head"><h2>${esc(goal.title)}</h2><button class="icon-btn" data-action="edit-goal" data-id="${goal.id}" aria-label="Editar jornada">${ICON.edit}</button></div>
      <div class="bar" style="margin-bottom:12px"><i style="width:${Math.round(store.goalProgress(goal) * 100)}%"></i></div>
      ${goal.steps.map((s, i) => {
        const task = s.taskId ? store.getItem(s.taskId) : null;
        return `<div class="step ${s.done ? 'done' : ''} ${i === current ? 'current' : ''}">
          <button class="num" data-action="toggle-step" data-goal="${goal.id}" data-step="${s.id}" aria-label="${s.done ? 'Desmarcar' : 'Concluir'} etapa ${i + 1}">${s.done ? '✓' : i + 1}</button>
          <button class="s-title m-body" data-action="step-sheet" data-goal="${goal.id}" data-step="${s.id}">${esc(s.title)}${task?.date ? `<span class="m-meta">📅 ${esc(friendlyDate(task.date, store.now()))}</span>` : ''}</button>
        </div>`;
      }).join('')}
      <div class="btn-row" style="margin-top:12px"><button class="btn small" data-action="add-step" data-goal="${goal.id}">${ICON.plus} Etapa</button>
      ${current >= 0 ? `<button class="btn small sun" data-action="step-sheet" data-goal="${goal.id}" data-step="${goal.steps[current].id}">Agendar próxima</button>` : ''}</div>
    </section>
    ${rewards(store)}
  </main>`;
}

function rewards(store) {
  const st = store.state.stats;
  const emoji = { primeira: '👣', dez: '🎒', cinquenta: '🥾', etapa: '🚩', jornada: '🏰', retomada: '🌱', foco: '🔦', nivel5: '⭐' };
  return `<section class="card"><div class="card-head"><h2>Conquistas</h2><button class="link" data-action="go" data-to="mascote">Visual do Guia →</button></div>
    <div class="rewards">${ACHIEVEMENTS.map((a) => `<button class="reward ${st.achievements.includes(a.id) ? '' : 'locked'}" data-action="achievement" data-id="${a.id}" aria-label="${esc(a.title)}">${emoji[a.id] || '★'}<small>${esc(a.title.split(' ')[0])}</small></button>`).join('')}</div></section>`;
}
