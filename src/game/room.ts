/**
 * Комната сетевой игры: лобби, выбор ведущего и партия.
 * Чистая логика без сети — сервер хранит комнаты и вызывает эти функции.
 */
import { applyAction, tick, viewFor, type Action } from './actions';
import { createGame, freeBotNames, MAX_PLAYERS, MIN_PLAYERS, type Participant } from './engine';
import { pick, rng, shuffle } from './rng';
import type { GameState } from './types';

export type HostMode = 'creator' | 'random' | 'vote';

export interface RoomSettings {
  /** Как выбирается ведущий: создатель комнаты, случайный игрок или голосование в лобби. */
  hostMode: HostMode;
  /** Ведущий тоже получает карты и голосует. */
  hostPlays: boolean;
  discussionSeconds: number;
}

export interface Member {
  id: string;
  name: string;
  isBot: boolean;
  male?: boolean;
  lastSeen: number;
}

export interface Room {
  code: string;
  settings: RoomSettings;
  creatorId: string;
  members: Member[];
  /** Ведущий. В режимах «случайно» и «голосование» назначается при старте. */
  hostId: string | null;
  /** Голоса за ведущего в лобби: кто → за кого. */
  hostVotes: Record<string, string>;
  game: GameState | null;
  version: number;
  updatedAt: number;
}

export type LobbyAction =
  | { type: 'addBot' }
  | { type: 'kick'; id: string }
  | { type: 'voteHost'; id: string }
  | { type: 'settings'; settings: Partial<RoomSettings> }
  | { type: 'start' }
  | { type: 'transferHost'; id: string }
  | { type: 'toLobby' }
  | { type: 'leave' };

export type RoomAction = LobbyAction | Action;

export type RoomResult = { ok: true; room: Room } | { ok: false; error: string };

export const ONLINE_MS = 15_000;
const NAME_MAX = 16;

export const DEFAULT_SETTINGS: RoomSettings = { hostMode: 'creator', hostPlays: true, discussionSeconds: 60 };

export function cleanName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

function uniqueName(name: string, members: Member[]): string {
  const taken = new Set(members.map((m) => m.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, NAME_MAX - 3)} ${i}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

function sanitizeSettings(base: RoomSettings, patch: Partial<RoomSettings>): RoomSettings {
  const next = { ...base };
  if (patch.hostMode === 'creator' || patch.hostMode === 'random' || patch.hostMode === 'vote') next.hostMode = patch.hostMode;
  if (typeof patch.hostPlays === 'boolean') next.hostPlays = patch.hostPlays;
  if (typeof patch.discussionSeconds === 'number') {
    next.discussionSeconds = Math.max(30, Math.min(300, Math.round(patch.discussionSeconds)));
  }
  return next;
}

export function createRoom(
  code: string,
  creator: { id: string; name: string },
  settings: Partial<RoomSettings>,
  now: number,
): Room {
  const s = sanitizeSettings(DEFAULT_SETTINGS, settings);
  return {
    code,
    settings: s,
    creatorId: creator.id,
    members: [{ id: creator.id, name: cleanName(creator.name) || 'Игрок', isBot: false, lastSeen: now }],
    hostId: s.hostMode === 'creator' ? creator.id : null,
    hostVotes: {},
    game: null,
    version: 1,
    updatedAt: now,
  };
}

/** Сколько участников получит карты при текущем составе. */
export function participantCount(room: Room): number {
  const n = room.members.length;
  // В режиме «случайно»/«голосование» ведущий ещё не известен, но он один из людей.
  return room.settings.hostPlays ? n : n - 1;
}

/** Кто распоряжается лобби: ведущий, а пока его нет — создатель комнаты. */
export function lobbyAdmin(room: Room): string {
  return room.hostId ?? room.creatorId;
}

export function joinRoom(room: Room, member: { id: string; name: string }, now: number): RoomResult {
  if (room.game) return { ok: false, error: 'Партия уже идёт. Дождитесь, пока ведущий вернёт всех в лобби.' };
  const limit = MAX_PLAYERS + (room.settings.hostPlays ? 0 : 1);
  if (room.members.length >= limit) return { ok: false, error: 'В комнате нет мест' };
  const name = uniqueName(cleanName(member.name) || 'Игрок', room.members);
  return {
    ok: true,
    room: bump({ ...room, members: [...room.members, { id: member.id, name, isBot: false, lastSeen: now }] }, now),
  };
}

function bump(room: Room, now: number): Room {
  return { ...room, version: room.version + 1, updatedAt: now };
}

function humans(room: Room): Member[] {
  return room.members.filter((m) => !m.isBot);
}

/** Ведущий по правилам комнаты в момент старта. */
function chooseHost(room: Room): string {
  const people = humans(room);
  if (room.settings.hostMode === 'creator') return room.hostId ?? room.creatorId;
  if (room.settings.hostMode === 'random') return pick(people).id;
  const tally = new Map<string, number>();
  for (const target of Object.values(room.hostVotes)) {
    if (people.some((p) => p.id === target)) tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  if (tally.size === 0) return room.creatorId;
  const best = Math.max(...tally.values());
  return pick(shuffle([...tally.entries()].filter(([, n]) => n === best).map(([id]) => id)));
}

/** Кто станет главным, если уйдёт текущий: первый оставшийся человек. */
function successor(members: Member[], leaving: string): string | null {
  const next = members.find((m) => !m.isBot && m.id !== leaving);
  return next ? next.id : null;
}

export function applyRoomAction(room: Room, actorId: string, a: RoomAction, now: number): RoomResult {
  const fail = (error: string): RoomResult => ({ ok: false, error });
  const actor = room.members.find((m) => m.id === actorId);
  if (!actor) return fail('Вы не в этой комнате');
  const isAdmin = lobbyAdmin(room) === actorId;
  const inLobby = !room.game;

  switch (a.type) {
    case 'addBot': {
      if (!inLobby) return fail('Ботов добавляют в лобби');
      if (!isAdmin) return fail('Ботов добавляет ведущий');
      const limit = MAX_PLAYERS + (room.settings.hostPlays ? 0 : 1);
      if (room.members.length >= limit) return fail('В комнате нет мест');
      const free = freeBotNames(room.members.map((m) => m.name));
      if (!free.length) return fail('Закончились имена для ботов');
      const b = pick(free);
      const id = `bot-${Math.floor(rng.next() * 1e9).toString(36)}`;
      return { ok: true, room: bump({ ...room, members: [...room.members, { id, name: b.name, isBot: true, male: b.male, lastSeen: now }] }, now) };
    }
    case 'kick': {
      if (!inLobby) return fail('Убрать игрока можно только в лобби');
      if (!isAdmin) return fail('Убирает игроков ведущий');
      if (a.id === actorId) return fail('Себя убрать нельзя — выйдите из комнаты');
      if (!room.members.some((m) => m.id === a.id)) return fail('Такого игрока нет');
      const hostVotes = { ...room.hostVotes };
      delete hostVotes[a.id];
      for (const [k, v] of Object.entries(hostVotes)) if (v === a.id) delete hostVotes[k];
      return { ok: true, room: bump({ ...room, members: room.members.filter((m) => m.id !== a.id), hostVotes }, now) };
    }
    case 'voteHost': {
      if (!inLobby) return fail('Ведущего выбирают в лобби');
      if (room.settings.hostMode !== 'vote') return fail('В этой комнате ведущего не выбирают голосованием');
      const target = room.members.find((m) => m.id === a.id);
      if (!target || target.isBot) return fail('Ведущим может быть только человек');
      return { ok: true, room: bump({ ...room, hostVotes: { ...room.hostVotes, [actorId]: a.id } }, now) };
    }
    case 'settings': {
      if (!inLobby) return fail('Настройки меняют в лобби');
      if (actorId !== room.creatorId && !isAdmin) return fail('Настройки меняет создатель комнаты');
      const settings = sanitizeSettings(room.settings, a.settings || {});
      const hostId = settings.hostMode === 'creator' ? room.hostId ?? room.creatorId : null;
      return { ok: true, room: bump({ ...room, settings, hostId, hostVotes: settings.hostMode === 'vote' ? room.hostVotes : {} }, now) };
    }
    case 'start': {
      if (!inLobby) return fail('Партия уже идёт');
      if (!isAdmin) return fail('Партию начинает ведущий');
      const hostId = chooseHost(room);
      const players: Participant[] = room.members
        .filter((m) => room.settings.hostPlays || m.id !== hostId)
        .map((m) => ({ id: m.id, name: m.name, isHuman: !m.isBot, male: m.male }));
      if (players.length < MIN_PLAYERS) {
        return fail(`Нужно хотя бы ${MIN_PLAYERS} игрока${room.settings.hostPlays ? '' : ' (не считая ведущего)'}. Добавьте ботов или позовите друзей.`);
      }
      if (players.length > MAX_PLAYERS) return fail(`Игроков не больше ${MAX_PLAYERS}`);
      const game = createGame(players, { hostId, discussionSeconds: room.settings.discussionSeconds });
      return { ok: true, room: bump({ ...room, hostId, game }, now) };
    }
    case 'transferHost': {
      const currentHost = room.hostId ?? (inLobby ? room.creatorId : null);
      if (currentHost !== actorId) return fail('Передать роль может только ведущий');
      const target = room.members.find((m) => m.id === a.id);
      if (!target || target.isBot) return fail('Ведущим может быть только человек');
      const game = room.game ? { ...room.game, hostId: a.id } : null;
      // Передача в лобби закрепляет ведущего вручную.
      const settings = inLobby ? { ...room.settings, hostMode: 'creator' as HostMode } : room.settings;
      return { ok: true, room: bump({ ...room, hostId: a.id, game, settings, hostVotes: {} }, now) };
    }
    case 'toLobby': {
      if (inLobby) return fail('Вы уже в лобби');
      if (room.hostId !== actorId) return fail('Вернуть всех в лобби может ведущий');
      const hostId = room.settings.hostMode === 'creator' ? room.hostId : null;
      return { ok: true, room: bump({ ...room, game: null, hostId, hostVotes: {} }, now) };
    }
    case 'leave': {
      const members = room.members.filter((m) => m.id !== actorId);
      const next = successor(room.members, actorId);
      const creatorId = room.creatorId === actorId && next ? next : room.creatorId;
      let hostId = room.hostId;
      let game = room.game;
      if (room.hostId === actorId) {
        // Ведущий ушёл: роль переходит к живому игроку-человеку или к следующему в комнате.
        const aliveHuman = game?.players.find((p) => p.alive && p.isHuman && p.id !== actorId);
        hostId = aliveHuman ? aliveHuman.id : next;
        if (game) game = { ...game, hostId };
      }
      // Ушедший посреди партии игрок не ломает её: за него дальше играет бот.
      if (game) {
        game = {
          ...game,
          players: game.players.map((p) => (p.id === actorId ? { ...p, isHuman: false } : p)),
        };
      }
      const hostVotes = { ...room.hostVotes };
      delete hostVotes[actorId];
      return { ok: true, room: bump({ ...room, members, creatorId, hostId, game, hostVotes }, now) };
    }
    default: {
      if (!room.game) return fail('Партия ещё не началась');
      const r = applyAction(room.game, actorId, a as Action, now);
      if (!r.ok) return r;
      return { ok: true, room: bump({ ...room, game: r.state }, now) };
    }
  }
}

/** Ход времени в комнате (таймер обсуждения, реплики ботов). */
export function tickRoom(room: Room, now: number): Room {
  if (!room.game) return room;
  const g = tick(room.game, now);
  return g === room.game ? room : bump({ ...room, game: g }, now);
}

export interface MemberView {
  id: string;
  name: string;
  isBot: boolean;
  online: boolean;
  hostVotes: number;
}

export interface RoomView {
  code: string;
  you: string;
  settings: RoomSettings;
  creatorId: string;
  hostId: string | null;
  members: MemberView[];
  myHostVote: string | null;
  game: GameState | null;
  version: number;
  serverTime: number;
}

export function roomView(room: Room, viewerId: string, now: number): RoomView {
  const votes = new Map<string, number>();
  for (const t of Object.values(room.hostVotes)) votes.set(t, (votes.get(t) ?? 0) + 1);
  return {
    code: room.code,
    you: viewerId,
    settings: room.settings,
    creatorId: room.creatorId,
    hostId: room.hostId,
    members: room.members.map((m) => ({
      id: m.id,
      name: m.name,
      isBot: m.isBot,
      online: m.isBot || now - m.lastSeen < ONLINE_MS,
      hostVotes: votes.get(m.id) ?? 0,
    })),
    myHostVote: room.hostVotes[viewerId] ?? null,
    game: room.game ? viewFor(room.game, viewerId) : null,
    version: room.version,
    serverTime: now,
  };
}
