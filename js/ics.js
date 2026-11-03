// Exportação .ics: leva tarefas e compromissos ao Calendário do iPhone/Mac
// ou ao Google Agenda, com alarme. É a forma confiável de ter aviso com o app fechado.
import { pad, parseYmd, addDays, toMinutes, fromMinutes } from './dates.js';

const RRULE = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' };
const escText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const local = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

export function buildICS(items) {
  const now = stamp(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GUIA//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const it of items) {
    if (!it.date) continue;
    lines.push('BEGIN:VEVENT', `UID:${it.id}@guia.app`, `DTSTAMP:${now}`, `SUMMARY:${escText(it.title)}`);
    if (it.time) {
      const end = Math.min(toMinutes(it.time) + (it.duration || (it.kind === 'event' ? 60 : 30)), 23 * 60 + 59);
      lines.push(`DTSTART:${local(it.date, it.time)}`, `DTEND:${local(it.date, fromMinutes(end))}`);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(it.title)}`, 'TRIGGER:-PT10M', 'END:VALARM');
    } else {
      const next = addDays(parseYmd(it.date), 1);
      lines.push(`DTSTART;VALUE=DATE:${it.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`);
    }
    if (it.recurrence && RRULE[it.recurrence]) lines.push(`RRULE:${RRULE[it.recurrence]}`);
    if (it.notes) lines.push(`DESCRIPTION:${escText(it.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Entrega o arquivo: compartilhar (iPhone) ou baixar (Mac). Retorna como foi entregue. */
export async function deliverFile(name, content, type) {
  const blob = new Blob([content], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if (e.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
