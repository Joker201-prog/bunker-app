/**
 * Игровой сервер «Убежища». Без внешних зависимостей: только встроенные модули Node.
 *
 * Связь — обычный HTTP с «долгими» запросами (long-polling): клиент спрашивает
 * состояние комнаты и, если ничего не изменилось, сервер держит запрос до 20 секунд.
 * Это проходит через любые прокси и не требует поддержки WebSocket у хостинга.
 *
 *   POST /api/rooms                 { name, settings }        → { code, playerId, token }
 *   POST /api/rooms/:code/join      { name }                  → { code, playerId, token }
 *   POST /api/rooms/:code/action    { token, action }         → { ok, version } | { ok:false, error }
 *   GET  /api/rooms/:code/state?token=…&since=N               → RoomView (ждёт изменений до 20 с)
 *   GET  /health                                              → ok
 */
import { randomBytes, randomInt } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  applyRoomAction,
  createRoom,
  joinRoom,
  ONLINE_MS,
  roomView,
  tickRoom,
  type Room,
  type RoomAction,
} from '../src/game/room';

const PORT = Number(process.env.PORT || 80);
const LONG_POLL_MS = 20_000;
const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;
const MAX_ROOMS = 2000;
const MAX_BODY = 16 * 1024;

interface Session {
  code: string;
  memberId: string;
}

interface Waiter {
  memberId: string;
  since: number;
  res: ServerResponse;
  timer: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();
const sessions = new Map<string, Session>(); // token → участник
const waiters = new Map<string, Set<Waiter>>(); // code → ждущие запросы
const onlineSig = new Map<string, string>(); // code → кто сейчас в сети (чтобы оповещать об изменениях)

function newCode(): string {
  for (let i = 0; i < 50; i++) {
    const code = String(randomInt(1000, 10000));
    if (!rooms.has(code)) return code;
  }
  throw new Error('Не удалось подобрать код комнаты');
}

const newId = () => 'm-' + randomBytes(6).toString('hex');
const newToken = () => randomBytes(18).toString('base64url');

function send(res: ServerResponse, status: number, body: unknown) {
  if (res.writableEnded) return;
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(data);
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

function touch(room: Room, memberId: string, now: number): Room {
  const members = room.members.map((m) => (m.id === memberId ? { ...m, lastSeen: now } : m));
  return { ...room, members };
}

/** Сохранить комнату и разбудить всех, кто ждёт изменений. */
function save(room: Room) {
  rooms.set(room.code, room);
  const set = waiters.get(room.code);
  if (!set) return;
  for (const w of [...set]) {
    if (room.version > w.since) {
      clearTimeout(w.timer);
      set.delete(w);
      respondState(w.res, room, w.memberId);
    }
  }
}

function respondState(res: ServerResponse, room: Room, memberId: string) {
  send(res, 200, roomView(room, memberId, Date.now()));
}

function auth(code: string, token: unknown): { room: Room; memberId: string } | { error: string; status: number } {
  const s = typeof token === 'string' ? sessions.get(token) : undefined;
  if (!s || s.code !== code) return { error: 'Сессия не найдена. Войдите в комнату заново.', status: 401 };
  const room = rooms.get(code);
  if (!room) return { error: 'Комната закрыта', status: 404 };
  if (!room.members.some((m) => m.id === s.memberId)) {
    sessions.delete(token as string);
    return { error: 'Вас нет в этой комнате', status: 403 };
  }
  return { room, memberId: s.memberId };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://local');
  const parts = url.pathname.split('/').filter(Boolean);
  const now = Date.now();

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (url.pathname === '/' || url.pathname === '/health') {
    return send(res, 200, { ok: true, name: 'ubezhishe', rooms: rooms.size });
  }

  // POST /api/rooms — создать комнату
  if (req.method === 'POST' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'rooms') {
    if (rooms.size >= MAX_ROOMS) return send(res, 503, { ok: false, error: 'Сервер переполнен, попробуйте позже' });
    const body = await readBody(req);
    const code = newCode();
    const id = newId();
    const token = newToken();
    const room = createRoom(code, { id, name: body.name }, body.settings || {}, now);
    sessions.set(token, { code, memberId: id });
    save(room);
    return send(res, 200, { ok: true, code, playerId: id, token });
  }

  if (parts[0] !== 'api' || parts[1] !== 'rooms' || parts.length !== 4) {
    return send(res, 404, { ok: false, error: 'Не найдено' });
  }
  const code = parts[2];
  const verb = parts[3];

  // POST /api/rooms/:code/join
  if (req.method === 'POST' && verb === 'join') {
    const room = rooms.get(code);
    if (!room) return send(res, 404, { ok: false, error: 'Комнаты с таким кодом нет' });
    const body = await readBody(req);
    const id = newId();
    const r = joinRoom(room, { id, name: body.name }, now);
    if (!r.ok) return send(res, 409, r);
    const token = newToken();
    sessions.set(token, { code, memberId: id });
    save(r.room);
    return send(res, 200, { ok: true, code, playerId: id, token });
  }

  // POST /api/rooms/:code/action
  if (req.method === 'POST' && verb === 'action') {
    const body = await readBody(req);
    const a = auth(code, body.token);
    if ('error' in a) return send(res, a.status, { ok: false, error: a.error });
    const action = body.action as RoomAction;
    if (!action || typeof action !== 'object' || typeof (action as any).type !== 'string') {
      return send(res, 400, { ok: false, error: 'Неверное действие' });
    }
    const r = applyRoomAction(touch(a.room, a.memberId, now), a.memberId, action, now);
    if (!r.ok) {
      rooms.set(code, touch(a.room, a.memberId, now));
      return send(res, 400, r);
    }
    if (action.type === 'leave') {
      sessions.delete(body.token);
      if (!r.room.members.some((m) => !m.isBot)) {
        rooms.delete(code);
        wakeAll(code);
        return send(res, 200, { ok: true, version: r.room.version });
      }
    }
    save(r.room);
    return send(res, 200, { ok: true, version: r.room.version });
  }

  // GET /api/rooms/:code/state?token=&since=
  if (req.method === 'GET' && verb === 'state') {
    const a = auth(code, url.searchParams.get('token'));
    if ('error' in a) return send(res, a.status, { ok: false, error: a.error });
    const room = touch(a.room, a.memberId, now);
    rooms.set(code, room);
    const since = Number(url.searchParams.get('since') || 0);
    if (room.version > since) return respondState(res, room, a.memberId);

    const set = waiters.get(code) ?? new Set<Waiter>();
    waiters.set(code, set);
    const w: Waiter = {
      memberId: a.memberId,
      since,
      res,
      timer: setTimeout(() => {
        set.delete(w);
        const cur = rooms.get(code);
        if (cur) respondState(res, cur, a.memberId);
        else send(res, 404, { ok: false, error: 'Комната закрыта' });
      }, LONG_POLL_MS),
    };
    set.add(w);
    req.on('close', () => {
      clearTimeout(w.timer);
      set.delete(w);
    });
    return;
  }

  return send(res, 404, { ok: false, error: 'Не найдено' });
}

function wakeAll(code: string) {
  const set = waiters.get(code);
  if (!set) return;
  for (const w of set) {
    clearTimeout(w.timer);
    send(w.res, 404, { ok: false, error: 'Комната закрыта' });
  }
  waiters.delete(code);
}

// Таймеры партий: конец обсуждения и реплики ботов.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.game) continue;
    const next = tickRoom(room, now);
    if (next !== room) save(next);
  }
}, 500).unref();

// Кто в сети, закрытие брошенных комнат.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const lastActivity = Math.max(room.updatedAt, ...room.members.map((m) => (m.isBot ? 0 : m.lastSeen)));
    if (now - lastActivity > ROOM_IDLE_MS) {
      rooms.delete(code);
      onlineSig.delete(code);
      wakeAll(code);
      for (const [t, s] of sessions) if (s.code === code) sessions.delete(t);
      continue;
    }
    const sig = room.members
      .filter((m) => !m.isBot && now - m.lastSeen < ONLINE_MS)
      .map((m) => m.id)
      .join(',');
    if (onlineSig.has(code) && onlineSig.get(code) !== sig) {
      save({ ...room, version: room.version + 1 });
    }
    onlineSig.set(code, sig);
  }
}, 5000).unref();

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    send(res, 400, { ok: false, error: e instanceof Error ? e.message : 'Ошибка' });
  });
});
server.keepAliveTimeout = LONG_POLL_MS + 10_000;
server.headersTimeout = LONG_POLL_MS + 15_000;
server.requestTimeout = LONG_POLL_MS + 15_000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Убежище: сервер слушает порт ${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    process.exit(0);
  });
}
