// Notificações e lembretes — com honestidade sobre o que a plataforma permite.
//
// 1) Lembrete no app: aparece como aviso do mascote quando o app está aberto.
// 2) Notificação local: usa a API de Notificações via service worker. No iPhone
//    (iOS 16.4+) só funciona com o app instalado na Tela de Início, e este app só
//    consegue dispará-la enquanto está aberto ou acabou de ser aberto.
// 3) Push com o app fechado: exige um servidor de push (Web Push + VAPID). Não
//    está implementado. Para avisos garantidos com o app fechado, use a exportação
//    para o Calendário (.ics), que cria alarmes do próprio sistema.

import { ymd, toMinutes } from './dates.js';

export function notifSupport() {
  const hasAPI = 'Notification' in window && 'serviceWorker' in navigator;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { hasAPI, standalone, ios, permission: hasAPI ? Notification.permission : 'unsupported', needsInstall: ios && !standalone };
}

export async function requestPermission() {
  const s = notifSupport();
  if (!s.hasAPI) return { ok: false, reason: s.needsInstall ? 'install' : 'unsupported' };
  try {
    const p = await Notification.requestPermission();
    return { ok: p === 'granted', reason: p };
  } catch (e) {
    return { ok: false, reason: 'error' };
  }
}

export async function showLocal(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) { await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title }); return true; }
    new Notification(title, { body });
    return true;
  } catch (e) { return false; }
}

/**
 * Verifica lembretes vencidos enquanto o app está aberto.
 * Dispara uma vez por item/dia, no horário ou até 30 min depois.
 */
export function startReminderLoop(store, onReminder) {
  const check = async () => {
    const now = store.now();
    const today = ymd(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const p = store.state.profile;
    for (const it of store.itemsOn(today)) {
      if (!it.time || !it.remind || store.isDone(it, today)) continue;
      const key = `${it.id}@${today}`;
      if (store.wasNotified(key)) continue;
      const t = toMinutes(it.time);
      const lead = it.kind === 'event' ? 10 : 0;
      if (nowMin >= t - lead && nowMin <= t + 30) {
        store.markNotified(key);
        const body = it.kind === 'event' ? `Começa às ${it.time}.` : 'Hora dessa missão.';
        let sent = false;
        if (p.notifications && document.visibilityState !== 'visible') sent = await showLocal(it.title, body);
        onReminder(it, sent);
      }
    }
    // Resumo do dia (só dentro do app)
    if (p.dailySummary && p.summaryTime && nowMin >= toMinutes(p.summaryTime)) {
      const key = `summary@${today}`;
      if (!store.wasNotified(key)) { store.markNotified(key); onReminder({ summary: true }, false); }
    }
  };
  check();
  const id = setInterval(check, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  return () => clearInterval(id);
}
