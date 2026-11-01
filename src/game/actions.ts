/**
 * Действия игроков и ведущего. Один и тот же код выполняется на сервере
 * (сетевая игра) и на телефоне (одиночная игра с ботами), поэтому правила
 * не расходятся.
 */
import { KIND_ORDER } from '../data/cards';
import {
  addChat,
  allHumansVoted,
  botMessage,
  castVote,
  nextRound,
  resolveRound,
  revealCard,
  startDiscussion,
  startVoting,
} from './engine';
import { rng } from './rng';
import type { Card, CardKind, GameState } from './types';

export type Action =
  | { type: 'reveal'; kind: CardKind }
  | { type: 'chat'; text: string }
  | { type: 'vote'; target: string }
  /** Ведущий: перейти к следующему этапу (стол → обсуждение → голосование → итоги → следующий раунд). */
  | { type: 'advance' }
  /** Ведущий: добавить время к обсуждению. */
  | { type: 'extend'; seconds: number };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

const MAX_EXTEND_SECONDS = 120;

export function applyAction(s: GameState, actorId: string, a: Action, now: number = Date.now()): ActionResult {
  const isHost = s.hostId === actorId;
  const me = s.players.find((p) => p.id === actorId);
  const fail = (error: string): ActionResult => ({ ok: false, error });

  switch (a.type) {
    case 'reveal': {
      if (!me) return fail('Вы не участвуете в партии');
      if (!me.alive) return fail('Вы выбыли');
      if (s.stage !== 'table') return fail('Карты раскрывают за столом');
      if (!KIND_ORDER.includes(a.kind)) return fail('Неизвестная карта');
      const next = revealCard(s, actorId, a.kind);
      if (next === s) return fail('Эту карту сейчас раскрыть нельзя');
      return { ok: true, state: next };
    }
    case 'chat': {
      const text = String(a.text ?? '').trim();
      if (!text) return fail('Пустое сообщение');
      if (!isHost && (!me || !me.alive)) return fail('Выбывшие игроки не участвуют в обсуждении');
      return { ok: true, state: addChat(s, actorId, text) };
    }
    case 'vote': {
      if (!me || !me.alive) return fail('Голосуют только игроки в игре');
      if (s.stage !== 'voting') return fail('Сейчас не время голосовать');
      if (a.target === actorId) return fail('Нельзя голосовать против себя');
      const target = s.players.find((p) => p.id === a.target);
      if (!target || !target.alive) return fail('Такого игрока нет у двери');
      let next = castVote(s, actorId, a.target);
      // Когда проголосовали все люди, голоса подсчитываются сами.
      if (allHumansVoted(next)) next = resolveRound(next);
      return { ok: true, state: next };
    }
    case 'advance': {
      if (!isHost) return fail('Это делает ведущий');
      return { ok: true, state: advance(s, now) };
    }
    case 'extend': {
      if (!isHost) return fail('Это делает ведущий');
      if (s.stage !== 'discussion' || !s.discussionEndsAt) return fail('Обсуждение не идёт');
      const add = Math.max(10, Math.min(MAX_EXTEND_SECONDS, Math.floor(a.seconds || 30)));
      return { ok: true, state: { ...s, discussionEndsAt: s.discussionEndsAt + add * 1000 } };
    }
  }
  return fail('Неизвестное действие');
}

/** Следующий этап по кнопке ведущего. */
export function advance(s: GameState, now: number = Date.now()): GameState {
  switch (s.stage) {
    case 'table':
      return startDiscussion(s, now);
    case 'discussion':
      return startVoting(s);
    case 'voting':
      return resolveRound(s);
    case 'result':
      return nextRound(s);
    default:
      return s;
  }
}

/**
 * Ход времени: конец обсуждения по таймеру и реплики ботов.
 * Возвращает то же состояние, если ничего не изменилось.
 */
export function tick(s: GameState, now: number = Date.now()): GameState {
  if (s.stage !== 'discussion') return s;
  if (s.discussionEndsAt !== null && now >= s.discussionEndsAt) return startVoting(s);
  if (s.nextBotChatAt !== null && now >= s.nextBotChatAt) {
    const said = botMessage(s);
    return { ...said, nextBotChatAt: now + 3500 + Math.floor(rng.next() * 2500) };
  }
  return s;
}

/** Секунды до конца обсуждения (для экрана). */
export function secondsLeft(s: GameState, now: number = Date.now()): number | null {
  if (s.stage !== 'discussion' || s.discussionEndsAt === null) return null;
  return Math.max(0, Math.ceil((s.discussionEndsAt - now) / 1000));
}

const HIDDEN_CARD = (kind: CardKind): Card => ({ kind, title: '', value: 0, tags: [] });

/**
 * Что видит конкретный участник: чужие нераскрытые карты стёрты,
 * чужие голоса до подсчёта скрыты (видно только, кто уже проголосовал).
 */
export function viewFor(s: GameState, viewerId: string | null): GameState {
  const players = s.players.map((p) => {
    if (p.id === viewerId || !p.alive) return p;
    const cards = { ...p.cards };
    for (const k of KIND_ORDER) if (!p.revealed[k]) cards[k] = HIDDEN_CARD(k);
    return { ...p, cards };
  });
  const votes: Record<string, string> = {};
  for (const [voter, target] of Object.entries(s.votes)) votes[voter] = voter === viewerId ? target : '?';
  return { ...s, players, votes };
}
