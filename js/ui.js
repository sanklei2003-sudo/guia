// Utilidades de interface: escape, ícones, mascote, toasts, folhas e efeitos.
import { mascotSVG } from './mascot.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const P = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  hoje: P('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
  conversa: P('<path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="3.2"/>'),
  agenda: P('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  jornada: P('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  check: P('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3.4"/>'),
  plus: P('<path d="M12 5v14M5 12h14" stroke-width="3"/>'),
  mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>'),
  send: P('<path d="M4 12l16-8-6 17-3-7z"/><path d="M11 14l9-10"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  back: P('<path d="M15 5l-7 7 7 7" stroke-width="3"/>'),
  next: P('<path d="M9 5l7 7-7 7" stroke-width="3"/>'),
  close: P('<path d="M6 6l12 12M18 6L6 18" stroke-width="3"/>'),
  sos: P('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01" stroke-width="3"/>'),
  focus: P('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>'),
  chat: P('<path d="M4 5h16v11H9l-5 4z"/>'),
  trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  star: P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  flag: P('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  play: P('<path d="M7 4l13 8-13 8z"/>'),
  pause: P('<path d="M8 5v14M16 5v14" stroke-width="3.4"/>'),
  download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
};

let mascotLook = {};
export function setMascotLook(look) { mascotLook = look || {}; }

/** HTML do mascote (pode receber toque para reagir). */
export function mascot(mood = 'happy', cls = '', id = '') {
  return `<div class="mascot ${cls}" ${id ? `id="${id}"` : ''} data-action="poke-mascot" data-mood="${mood}">${mascotSVG(mood, mascotLook)}</div>`;
}

export function setMood(el, mood) {
  if (!el) return;
  el.dataset.mood = mood;
  el.innerHTML = mascotSVG(mood, mascotLook);
}

export function poke(el) {
  if (!el) return;
  el.classList.remove('tapped', 'waving');
  void el.offsetWidth;
  el.classList.add(Math.random() < 0.5 ? 'tapped' : 'waving');
  setTimeout(() => el.classList.remove('tapped', 'waving'), 1600);
  if (navigator.vibrate) navigator.vibrate(12);
}

// ---------- Toasts ----------
export function toast(text, mood = 'happy', ms = 2600) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${mascot(mood)}<div>${esc(text)}</div>`;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- Efeitos de recompensa ----------
export function celebrate(x, y, xp) {
  const colors = ['#C20D02', '#0094FF', '#FFA900', '#FFF6E6'];
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = `${x}px`; c.style.top = `${y}px`;
    c.style.background = colors[i % colors.length];
    const a = (Math.PI * 2 * i) / 18;
    c.style.setProperty('--dx', `${Math.cos(a) * (50 + Math.random() * 60)}px`);
    c.style.setProperty('--dy', `${Math.sin(a) * (50 + Math.random() * 60) + 40}px`);
    c.style.setProperty('--r', `${Math.random() * 540}deg`);
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1200);
  }
  if (xp) {
    const f = document.createElement('div');
    f.className = 'xp-float'; f.textContent = `+${xp} XP`;
    f.style.left = `${x - 30}px`; f.style.top = `${y - 30}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }
  if (navigator.vibrate) navigator.vibrate([10, 40, 18]);
}

// ---------- Folhas (modais inferiores) ----------
export function openSheet(html, { onClose } = {}) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  const sh = document.createElement('div');
  sh.className = 'sheet';
  sh.setAttribute('role', 'dialog');
  sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = `<div class="grab"></div>${html}`;
  bg.addEventListener('click', () => closeSheet());
  document.body.append(bg, sh);
  sh._onClose = onClose;
  const first = sh.querySelector('input, textarea, select');
  if (first && !('ontouchstart' in window)) setTimeout(() => first.focus(), 250);
  return sh;
}
export function closeSheet() {
  const sh = document.querySelector('.sheet');
  if (sh?._onClose) sh._onClose();
  document.querySelectorAll('.sheet, .sheet-bg').forEach((e) => e.remove());
}

export function confirmSheet(text, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    let answered = false;
    const sh = openSheet(`<h2>${esc(text)}</h2><div class="btn-row"><button class="btn ${danger ? 'primary' : 'sun'}" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-no>Cancelar</button></div>`, { onClose: () => { if (!answered) resolve(false); } });
    sh.querySelector('[data-ok]').onclick = () => { answered = true; closeSheet(); resolve(true); };
    sh.querySelector('[data-no]').onclick = () => { answered = true; closeSheet(); resolve(false); };
  });
}
