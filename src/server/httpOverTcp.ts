/**
 * Простейший HTTP/1.1 сервер поверх TCP-сокетов для телефона.
 * Принимает модуль с интерфейсом как у Node `net` (react-native-tcp-socket повторяет его),
 * поэтому тот же код проверяется в Node тестом scripts/lan-test.js.
 *
 * Поддерживается ровно то, что нужно игре: GET/POST/OPTIONS, тело JSON с Content-Length,
 * один запрос на соединение (Connection: close).
 */
import { Buffer } from 'buffer';
import type { GameServer } from './core';

export interface TcpSocketLike {
  on(event: 'data', cb: (data: any) => void): any;
  on(event: 'error' | 'close' | 'end', cb: (...args: any[]) => void): any;
  write(data: any): any;
  /** end(data): отправить и закрыть — закрытие только после отправки. */
  end(data?: any): any;
  destroy(): any;
}

export interface TcpServerLike {
  listen(opts: { port: number; host?: string }, cb?: () => void): any;
  on(event: 'error', cb: (e: any) => void): any;
  close(cb?: () => void): any;
}

export interface NetLike {
  createServer(onConnection: (socket: TcpSocketLike) => void): TcpServerLike;
}

const MAX_REQUEST = 32 * 1024;
const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  503: 'Service Unavailable',
};

function toBuffer(data: any): Buffer {
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(data);
}

function writeResponse(socket: TcpSocketLike, status: number, body: unknown) {
  const payload = Buffer.from(status === 204 ? '' : JSON.stringify(body), 'utf8');
  const head =
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'OK'}\r\n` +
    'Content-Type: application/json; charset=utf-8\r\n' +
    'Cache-Control: no-store\r\n' +
    'Access-Control-Allow-Origin: *\r\n' +
    'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n' +
    'Access-Control-Allow-Headers: Content-Type\r\n' +
    `Content-Length: ${payload.length}\r\n` +
    'Connection: close\r\n\r\n';
  try {
    // Ответ передаётся в end(): на телефоне запись асинхронная, и отдельный end() сразу после write()
    // может закрыть соединение раньше, чем ответ уйдёт — клиент получит «нет связи».
    socket.end(Buffer.concat([Buffer.from(head, 'latin1'), payload]));
  } catch {
    // Клиент уже отключился.
  }
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
    const v = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

/** Запустить HTTP-сервер игры на порту. Возвращает функцию остановки. */
export function serveHttp(
  net: NetLike,
  game: GameServer,
  port: number,
): Promise<{ stop: () => void }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let buf = Buffer.alloc(0);
      let handled = false;
      const aborts: (() => void)[] = [];
      const fireAbort = () => {
        while (aborts.length) aborts.pop()!();
      };
      socket.on('error', fireAbort);
      socket.on('close', fireAbort);

      socket.on('data', (chunk: any) => {
        if (handled) return;
        buf = Buffer.concat([buf, toBuffer(chunk)]);
        if (buf.length > MAX_REQUEST) {
          handled = true;
          return writeResponse(socket, 413, { ok: false, error: 'Слишком большой запрос' });
        }
        const headEnd = buf.indexOf('\r\n\r\n');
        if (headEnd < 0) return;
        const head = buf.subarray(0, headEnd).toString('latin1');
        const lines = head.split('\r\n');
        const [method = 'GET', target = '/'] = (lines[0] || '').split(' ');
        const headers: Record<string, string> = {};
        for (const line of lines.slice(1)) {
          const i = line.indexOf(':');
          if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
        }
        const length = Number(headers['content-length'] || 0);
        if (buf.length < headEnd + 4 + length) return; // ждём остаток тела
        handled = true;

        if (method === 'OPTIONS') return writeResponse(socket, 204, null);

        let body: any = {};
        if (length > 0) {
          try {
            body = JSON.parse(buf.subarray(headEnd + 4, headEnd + 4 + length).toString('utf8'));
          } catch {
            return writeResponse(socket, 400, { ok: false, error: 'Неверный JSON' });
          }
        }
        const q = target.indexOf('?');
        const path = q < 0 ? target : target.slice(0, q);
        const query = parseQuery(q < 0 ? '' : target.slice(q + 1));
        game.handle(
          { method, path, query, body },
          (status, data) => writeResponse(socket, status, data),
          (cb) => aborts.push(cb),
        );
      });
    });

    let started = false;
    server.on('error', (e: any) => {
      if (!started) reject(e);
    });
    server.listen({ port, host: '0.0.0.0' }, () => {
      started = true;
      resolve({
        stop: () => {
          try {
            server.close();
          } catch {
            // уже остановлен
          }
        },
      });
    });
  });
}
