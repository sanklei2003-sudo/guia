// Utilidades de data em português brasileiro (sem dependências).

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const pad = (n) => String(n).padStart(2, '0');

export function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d) {
  // Semana começando na segunda-feira
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

export function diffDays(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** "hoje", "amanhã", "quarta (05/11)" */
export function friendlyDate(dateStr, now = new Date()) {
  if (!dateStr) return 'sem data';
  const d = parseYmd(dateStr);
  const diff = diffDays(now, d);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff === 2) return 'depois de amanhã';
  const label = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (diff > 0 && diff < 7) return `${WEEKDAYS[d.getDay()]} (${label})`;
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${label}`;
}

export function friendlyTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function longDate(d = new Date()) {
  const wd = WEEKDAYS[d.getDay()];
  const full = ['segunda', 'terça', 'quarta', 'quinta', 'sexta'].includes(wd) ? `${wd}-feira` : wd;
  return `${full[0].toUpperCase()}${full.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatDuration(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}
