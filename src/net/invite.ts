/**
 * Приглашения в комнату через интернет.
 *
 * Ведущий отправляет друзьям обычную https-ссылку на свой сервер: https://<сервер>/j/1234.
 * Сервер отдаёт страничку с кнопкой «Открыть в приложении», которая открывает
 * ubezhishe://join?server=…&code=1234 — приложение само подставит адрес и код.
 */
export const APP_SCHEME = 'ubezhishe';
export const PACKAGE = 'ru.ubezhishe.bunker';
export const DOWNLOAD_URL = 'https://github.com/Joker201-prog/bunker-app/releases/latest';

export interface Invite {
  server: string;
  code: string;
}

/** Ссылка-приглашение для друзей (открывается в любом браузере и мессенджере). */
export function inviteLink(server: string, code: string): string {
  return `${server.replace(/\/+$/, '')}/j/${code}`;
}

/** Ссылка, которую открывает приложение. */
export function appLink(server: string, code: string): string {
  return `${APP_SCHEME}://join?server=${encodeURIComponent(server)}&code=${code}`;
}

/** Разбор ссылки ubezhishe://join?server=…&code=…; null — это не приглашение. */
export function parseInvite(url: string | null | undefined): Invite | null {
  if (!url || !url.toLowerCase().startsWith(`${APP_SCHEME}://`)) return null;
  const q = url.indexOf('?');
  if (q < 0) return null;
  const params: Record<string, string> = {};
  for (const pair of url.slice(q + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    try {
      params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    } catch {
      // битый параметр — пропускаем
    }
  }
  const server = (params.server || '').trim().replace(/\/+$/, '');
  const code = (params.code || '').trim();
  if (!/^https?:\/\/[^\s/?#]+$/i.test(server) || !/^\d{4}$/.test(code)) return null;
  return { server, code };
}

/** Текст, который ведущий отправляет друзьям. */
export function inviteMessage(opts: { code: string; server?: string; lan: boolean }): string {
  if (opts.lan) {
    return (
      `Заходи в «Убежище»! Подключись к той же Wi-Fi сети, что и я, ` +
      `открой приложение → «Войти по коду» → ${opts.code}`
    );
  }
  const link = inviteLink(opts.server || '', opts.code);
  return `Заходи в «Убежище»! Комната ${opts.code}: ${link}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Страничка приглашения. Адрес сервера берётся из адресной строки браузера (location.origin),
 * поэтому работает за любым туннелем.
 */
export function invitePage(code: string, exists: boolean): string {
  const c = escapeHtml(code);
  const body = exists
    ? `<p>Вас зовут в комнату</p>
  <div class="code">${c}</div>
  <a id="open" class="btn" href="#">Открыть в приложении</a>
  <p class="small">Нет приложения? <a href="${DOWNLOAD_URL}">Скачать «Убежище» для Android</a>,
  установить и снова открыть эту ссылку.</p>
  <p class="small">Или вручную: «Войти по коду» → <b>${c}</b>, адрес сервера: <b id="host"></b></p>`
    : `<p>Комнаты ${c} уже нет: партия закончилась или сервер перезапускали.</p>
  <p class="small">Попросите ведущего прислать новое приглашение.</p>`;
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>«Убежище» — приглашение</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#2b1d13;font-family:system-ui,sans-serif;color:#2a241d}
main{background:#e2d3b2;max-width:360px;margin:16px;padding:24px;border-radius:3px;box-shadow:0 6px 18px rgba(0,0,0,.5);text-align:center}
h1{font-size:26px;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px}
.code{font:700 44px/1.1 monospace;letter-spacing:6px;color:#a8281f;margin:8px 0 20px}
.btn{display:block;background:#2a241d;color:#eadcbf;text-decoration:none;font-weight:700;padding:14px;border-radius:3px;font-size:17px}
.small{font-size:14px;line-height:1.45;color:#62574a}
a{color:#2c4677}
</style></head>
<body><main>
  <h1>«Убежище»</h1>
  ${body}
</main>
<script>
(function(){
  var server = location.origin, code = ${JSON.stringify(code)};
  var h = document.getElementById('host'); if (h) h.textContent = location.host;
  var a = document.getElementById('open'); if (!a) return;
  var q = 'join?server=' + encodeURIComponent(server) + '&code=' + code;
  var android = /Android/i.test(navigator.userAgent);
  a.href = android
    ? 'intent://' + q + '#Intent;scheme=${APP_SCHEME};package=${PACKAGE};S.browser_fallback_url=' + encodeURIComponent(${JSON.stringify(DOWNLOAD_URL)}) + ';end'
    : '${APP_SCHEME}://' + q;
})();
</script>
</body></html>`;
}
