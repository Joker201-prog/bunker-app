/**
 * Ядро игрового сервера без привязки к платформе: комнаты, сессии и «долгие» запросы.
 * Работает и в Node (сервер на компьютере), и на телефоне (комната в Wi-Fi сети).
 * Транспорт (HTTP поверх чего угодно) передаёт сюда разобранный запрос и функцию ответа.
 *
 *   POST /api/rooms                 { name, settings }        → { code, playerId, token }
 *   POST /api/rooms/:code/join      { name }                  → { code, playerId, token }
 *   POST /api/rooms/:code/action    { token, action }         → { ok, version } | { ok:false, error }
 *   GET  /api/rooms/:code/state?token=…&since=N               → RoomView (ждёт изменений до 20 с)
 *   GET  /api/rooms/:code/ping                                → { ok } если комната есть
 *   GET  /health                                              → { ok, name, rooms }
 */
import {
  applyRoomAction,
  createRoom,
  joinRoom,
  ONLINE_MS,
  roomView,
  tickRoom,
  type Room,
  type RoomAction,
} from '../game/room';

export const LONG_POLL_MS = 20_000;
const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;

export interface CoreRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: any;
}

export type Respond = (status: number, body: unknown) => void;

export interface CoreOptions {
  /** Новый код комнаты. Должен вернуть код, которого ещё нет. */
  newCode: (taken: (code: string) => boolean) => string;
  newId: () => string;
  newToken: () => string;
  maxRooms?: number;
}

interface Session {
  code: string;
  memberId: string;
}

interface Waiter {
  memberId: string;
  since: number;
  respond: Respond;
  timer: ReturnType<typeof setTimeout>;
  done: boolean;
}

/** Случайная строка из букв и цифр (для телефона, где нет crypto). */
export function randomString(len: number): string {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export class GameServer {
  private rooms = new Map<string, Room>();
  private sessions = new Map<string, Session>();
  private waiters = new Map<string, Set<Waiter>>();
  private onlineSig = new Map<string, string>();
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(private opts: CoreOptions) {}

  /** Запустить таймеры: ход партий (таймер обсуждения, боты) и уборку брошенных комнат. */
  /** Есть ли комната с таким кодом (для страницы приглашения). */
  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  start() {
    this.timers.push(setInterval(() => this.tickGames(), 500));
    this.timers.push(setInterval(() => this.housekeeping(), 5000));
  }

  stop() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    for (const code of [...this.rooms.keys()]) this.closeRoom(code);
  }

  roomCount() {
    return this.rooms.size;
  }

  /** Обработать запрос. respond вызывается ровно один раз (для долгого запроса — позже). */
  handle(req: CoreRequest, respond: Respond, onAbort?: (cb: () => void) => void) {
    try {
      this.route(req, respond, onAbort);
    } catch (e) {
      respond(400, { ok: false, error: e instanceof Error ? e.message : 'Ошибка' });
    }
  }

  private route(req: CoreRequest, respond: Respond, onAbort?: (cb: () => void) => void) {
    const parts = req.path.split('/').filter(Boolean);
    const now = Date.now();
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (req.path === '/' || req.path === '/health') {
      return respond(200, { ok: true, name: 'ubezhishe', rooms: this.rooms.size });
    }

    if (req.method === 'POST' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'rooms') {
      if (this.rooms.size >= (this.opts.maxRooms ?? 2000)) {
        return respond(503, { ok: false, error: 'Сервер переполнен, попробуйте позже' });
      }
      const code = this.opts.newCode((c) => this.rooms.has(c));
      const id = this.opts.newId();
      const token = this.opts.newToken();
      const room = createRoom(code, { id, name: body.name }, body.settings || {}, now);
      this.sessions.set(token, { code, memberId: id });
      this.save(room);
      return respond(200, { ok: true, code, playerId: id, token });
    }

    if (parts[0] !== 'api' || parts[1] !== 'rooms' || parts.length !== 4) {
      return respond(404, { ok: false, error: 'Не найдено' });
    }
    const code = parts[2];
    const verb = parts[3];

    if (req.method === 'GET' && verb === 'ping') {
      return this.rooms.has(code)
        ? respond(200, { ok: true, code })
        : respond(404, { ok: false, error: 'Комнаты с таким кодом нет' });
    }

    if (req.method === 'POST' && verb === 'join') {
      const room = this.rooms.get(code);
      if (!room) return respond(404, { ok: false, error: 'Комнаты с таким кодом нет' });
      const id = this.opts.newId();
      const r = joinRoom(room, { id, name: body.name }, now);
      if (!r.ok) return respond(409, r);
      const token = this.opts.newToken();
      this.sessions.set(token, { code, memberId: id });
      this.save(r.room);
      return respond(200, { ok: true, code, playerId: id, token });
    }

    if (req.method === 'POST' && verb === 'action') {
      const a = this.auth(code, body.token);
      if ('error' in a) return respond(a.status, { ok: false, error: a.error });
      const action = body.action as RoomAction;
      if (!action || typeof action !== 'object' || typeof (action as any).type !== 'string') {
        return respond(400, { ok: false, error: 'Неверное действие' });
      }
      const touched = touch(a.room, a.memberId, now);
      const r = applyRoomAction(touched, a.memberId, action, now);
      if (!r.ok) {
        this.rooms.set(code, touched);
        return respond(400, r);
      }
      if (action.type === 'leave') {
        this.sessions.delete(body.token);
        if (!r.room.members.some((m) => !m.isBot)) {
          this.closeRoom(code);
          return respond(200, { ok: true, version: r.room.version });
        }
      }
      this.save(r.room);
      return respond(200, { ok: true, version: r.room.version });
    }

    if (req.method === 'GET' && verb === 'state') {
      const a = this.auth(code, req.query.token);
      if ('error' in a) return respond(a.status, { ok: false, error: a.error });
      const room = touch(a.room, a.memberId, now);
      this.rooms.set(code, room);
      const since = Number(req.query.since || 0);
      if (room.version > since) return respond(200, roomView(room, a.memberId, now));

      const set = this.waiters.get(code) ?? new Set<Waiter>();
      this.waiters.set(code, set);
      const w: Waiter = {
        memberId: a.memberId,
        since,
        respond,
        done: false,
        timer: setTimeout(() => {
          set.delete(w);
          if (w.done) return;
          w.done = true;
          const cur = this.rooms.get(code);
          if (cur) respond(200, roomView(cur, a.memberId, Date.now()));
          else respond(404, { ok: false, error: 'Комната закрыта' });
        }, LONG_POLL_MS),
      };
      set.add(w);
      onAbort?.(() => {
        clearTimeout(w.timer);
        w.done = true;
        set.delete(w);
      });
      return;
    }

    return respond(404, { ok: false, error: 'Не найдено' });
  }

  private auth(code: string, token: unknown): { room: Room; memberId: string } | { error: string; status: number } {
    const s = typeof token === 'string' ? this.sessions.get(token) : undefined;
    if (!s || s.code !== code) return { error: 'Сессия не найдена. Войдите в комнату заново.', status: 401 };
    const room = this.rooms.get(code);
    if (!room) return { error: 'Комната закрыта', status: 404 };
    if (!room.members.some((m) => m.id === s.memberId)) {
      this.sessions.delete(token as string);
      return { error: 'Вас нет в этой комнате', status: 403 };
    }
    return { room, memberId: s.memberId };
  }

  /** Сохранить комнату и ответить всем, кто ждёт изменений. */
  private save(room: Room) {
    this.rooms.set(room.code, room);
    const set = this.waiters.get(room.code);
    if (!set) return;
    for (const w of [...set]) {
      if (room.version > w.since && !w.done) {
        clearTimeout(w.timer);
        w.done = true;
        set.delete(w);
        w.respond(200, roomView(room, w.memberId, Date.now()));
      }
    }
  }

  private closeRoom(code: string) {
    this.rooms.delete(code);
    this.onlineSig.delete(code);
    const set = this.waiters.get(code);
    if (set) {
      for (const w of set) {
        clearTimeout(w.timer);
        if (!w.done) {
          w.done = true;
          w.respond(404, { ok: false, error: 'Комната закрыта' });
        }
      }
      this.waiters.delete(code);
    }
    for (const [t, s] of this.sessions) if (s.code === code) this.sessions.delete(t);
  }

  private tickGames() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (!room.game) continue;
      const next = tickRoom(room, now);
      if (next !== room) this.save(next);
    }
  }

  /** Кто в сети (чтобы лобби видело выход из сети) и закрытие брошенных комнат. */
  private housekeeping() {
    const now = Date.now();
    for (const [code, room] of [...this.rooms]) {
      const last = Math.max(room.updatedAt, ...room.members.map((m) => (m.isBot ? 0 : m.lastSeen)));
      if (now - last > ROOM_IDLE_MS) {
        this.closeRoom(code);
        continue;
      }
      const sig = room.members
        .filter((m) => !m.isBot && now - m.lastSeen < ONLINE_MS)
        .map((m) => m.id)
        .join(',');
      if (this.onlineSig.has(code) && this.onlineSig.get(code) !== sig) {
        this.save({ ...room, version: room.version + 1 });
      }
      this.onlineSig.set(code, sig);
    }
  }
}

function touch(room: Room, memberId: string, now: number): Room {
  return { ...room, members: room.members.map((m) => (m.id === memberId ? { ...m, lastSeen: now } : m)) };
}
