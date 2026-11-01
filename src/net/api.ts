/** Обращения к игровому серверу. */
import type { RoomAction, RoomSettings, RoomView } from '../game/room';

/** Адрес сервера по умолчанию. Можно поменять на главном экране. */
export const DEFAULT_SERVER = '';

export interface Session {
  server: string;
  code: string;
  playerId: string;
  token: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function normalizeServer(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  if (s && !/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

async function request<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      throw new ApiError(`Сервер ответил не так, как ожидалось (код ${res.status})`, res.status);
    }
    if (!res.ok || body?.ok === false) {
      throw new ApiError(body?.error || `Ошибка сервера (код ${res.status})`, res.status);
    }
    return body as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError') throw new ApiError('Сервер не ответил вовремя', 0);
    throw new ApiError('Нет связи с сервером. Проверьте интернет и адрес сервера.', 0);
  } finally {
    clearTimeout(timer);
  }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function createRoom(server: string, name: string, settings: Partial<RoomSettings>): Promise<Session> {
  const r = await request<{ code: string; playerId: string; token: string }>(`${server}/api/rooms`, json({ name, settings }));
  return { server, code: r.code, playerId: r.playerId, token: r.token };
}

export async function joinRoom(server: string, code: string, name: string): Promise<Session> {
  const r = await request<{ code: string; playerId: string; token: string }>(
    `${server}/api/rooms/${encodeURIComponent(code)}/join`,
    json({ name }),
  );
  return { server, code: r.code, playerId: r.playerId, token: r.token };
}

export async function sendAction(s: Session, action: RoomAction): Promise<void> {
  await request(`${s.server}/api/rooms/${s.code}/action`, json({ token: s.token, action }));
}

/** Долгий запрос: сервер отвечает сразу, если версия новее since, иначе ждёт до 20 секунд. */
export async function pollState(s: Session, since: number): Promise<RoomView> {
  return request<RoomView>(
    `${s.server}/api/rooms/${s.code}/state?token=${encodeURIComponent(s.token)}&since=${since}`,
    { timeoutMs: 30_000 },
  );
}

export async function checkServer(server: string): Promise<void> {
  await request(`${server}/health`, { timeoutMs: 8000 });
}
