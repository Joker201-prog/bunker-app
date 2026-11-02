/**
 * Игровой сервер «Убежища» для компьютера. Без внешних зависимостей: только встроенные модули Node.
 * Вся логика — в src/server/core.ts (та же, что работает на телефоне в режиме «в этой сети»).
 * Связь — обычный HTTP с «долгими» запросами, поэтому подходит любой туннель или хостинг.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { invitePage } from '../src/net/invite';
import { GameServer, LONG_POLL_MS } from '../src/server/core';

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = 16 * 1024;

const game = new GameServer({
  newCode: (taken) => {
    for (let i = 0; i < 50; i++) {
      const code = String(randomInt(1000, 10000));
      if (!taken(code)) return code;
    }
    throw new Error('Не удалось подобрать код комнаты');
  },
  newId: () => 'm-' + randomBytes(6).toString('hex'),
  newToken: () => randomBytes(18).toString('base64url'),
});

function send(res: ServerResponse, status: number, body: unknown) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Слишком большой запрос'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Неверный JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  try {
    const url = new URL(req.url || '/', 'http://local');
    // Страница приглашения: https://<адрес>/j/1234 — открывает комнату в приложении.
    const invite = req.method === 'GET' && /^\/j\/(\d{4})\/?$/.exec(url.pathname);
    if (invite) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(invitePage(invite[1], game.hasRoom(invite[1])));
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    game.handle(
      { method: req.method || 'GET', path: url.pathname, query: Object.fromEntries(url.searchParams), body },
      (status, data) => send(res, status, data),
      (cb) => req.on('close', cb),
    );
  } catch (e) {
    send(res, 400, { ok: false, error: e instanceof Error ? e.message : 'Ошибка' });
  }
});

server.keepAliveTimeout = LONG_POLL_MS + 10_000;
server.headersTimeout = LONG_POLL_MS + 15_000;
server.requestTimeout = LONG_POLL_MS + 15_000;

/** Запуск сервера; launcher.ts вызывает его и сам запускает туннель. */
export function listen(onReady?: () => void) {
  game.start();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Убежище: сервер работает на порту ${PORT}. Не закрывайте это окно, пока идёт игра.`);
    onReady?.();
  });
}

export function stop() {
  game.stop();
  server.close();
}

export { PORT };

if (require.main === module) listen();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    stop();
    process.exit(0);
  });
}
