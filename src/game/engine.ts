import {
  BAGGAGE,
  BUNKER_CARDS,
  CATASTROPHES,
  FACTS,
  HEALTH,
  HOBBIES,
  KIND_ORDER,
  PROFESSIONS,
  SPECIALS,
  TAG_LABEL,
  makeBiology,
} from '../data/cards';
import { chance, int, pick, rng, shuffle } from './rng';
import type {
  BunkerCard,
  Card,
  CardKind,
  ChatMessage,
  FinalReport,
  GameState,
  Player,
  RoundResult,
  Tag,
} from './types';

export const TOTAL_ROUNDS = 5;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;

const BOT_NAMES = [
  'Алексей', 'Мария', 'Дмитрий', 'Ольга', 'Игорь', 'Наталья', 'Сергей', 'Анна',
  'Виктор', 'Елена', 'Максим', 'Ирина', 'Артём', 'Светлана', 'Николай', 'Татьяна',
];

/** Draws cards without repeats until a pool runs dry, then reshuffles it. */
function makeDeck<T>(pool: readonly T[]): () => T {
  let queue: T[] = [];
  return () => {
    if (queue.length === 0) queue = shuffle(pool);
    return queue.pop() as T;
  };
}

function distributeEliminations(total: number, rounds: number): number[] {
  const base = Math.floor(total / rounds);
  const rem = total % rounds;
  const out: number[] = [];
  for (let i = 0; i < rounds; i++) {
    out.push(base + (i >= rounds - rem ? 1 : 0));
  }
  return out;
}

export function seatsFor(playerCount: number): number {
  return Math.floor(playerCount / 2);
}

export function newGame(opts: { humanName: string; players: number }): GameState {
  const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(opts.players)));
  const seats = seatsFor(count);

  const draw: Record<Exclude<CardKind, 'biology'>, () => Card> = {
    profession: makeDeck(PROFESSIONS),
    health: makeDeck(HEALTH),
    fact: makeDeck(FACTS),
    hobby: makeDeck(HOBBIES),
    baggage: makeDeck(BAGGAGE),
    special: makeDeck(SPECIALS),
  };

  const names = shuffle(BOT_NAMES).filter((n) => n !== opts.humanName);
  const players: Player[] = [];
  for (let i = 0; i < count; i++) {
    const isHuman = i === 0;
    const cards = {
      profession: draw.profession(),
      biology: makeBiology(),
      health: draw.health(),
      fact: draw.fact(),
      hobby: draw.hobby(),
      baggage: draw.baggage(),
      special: draw.special(),
    } as Record<CardKind, Card>;
    players.push({
      id: isHuman ? 'human' : `bot${i}`,
      name: isHuman ? opts.humanName || 'Вы' : names[(i - 1) % names.length],
      isHuman,
      alive: true,
      cards,
      revealed: {
        profession: false,
        biology: false,
        health: false,
        fact: false,
        hobby: false,
        baggage: false,
        special: false,
      },
      shieldUsed: false,
    });
  }

  const bunker: BunkerCard[] = shuffle(BUNKER_CARDS).slice(0, 3);
  return {
    players,
    seats,
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    elimsPerRound: distributeEliminations(count - seats, TOTAL_ROUNDS),
    stage: 'table',
    catastrophe: pick(CATASTROPHES),
    catastropheYears: int(2, 15),
    bunker,
    votes: {},
    revealedThisRound: {},
    chat: [],
    nextMessageId: 1,
    results: [],
    final: null,
  };
}

export function alivePlayers(s: GameState): Player[] {
  return s.players.filter((p) => p.alive);
}

export function playerById(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

export function eliminationsThisRound(s: GameState): number {
  return s.elimsPerRound[s.round - 1] ?? 0;
}

function mapPlayer(s: GameState, id: string, fn: (p: Player) => Player): GameState {
  return { ...s, players: s.players.map((p) => (p.id === id ? fn(p) : p)) };
}

function withMessage(s: GameState, authorId: string | null, text: string): GameState {
  const msg: ChatMessage = { id: s.nextMessageId, authorId, text };
  return { ...s, chat: [...s.chat, msg], nextMessageId: s.nextMessageId + 1 };
}

export function addChat(s: GameState, authorId: string | null, text: string): GameState {
  const t = text.trim();
  if (!t) return s;
  return withMessage(s, authorId, t.slice(0, 200));
}

/** The kinds a player may reveal right now (round 1 forces profession). */
export function revealableKinds(s: GameState, p: Player): CardKind[] {
  if (s.revealedThisRound[p.id]) return [];
  if (s.round === 1) return p.revealed.profession ? [] : ['profession'];
  return KIND_ORDER.filter((k) => !p.revealed[k]);
}

export function revealCard(s: GameState, playerId: string, kind: CardKind): GameState {
  if (s.stage !== 'table') return s;
  const p = playerById(s, playerId);
  if (!p.alive || !revealableKinds(s, p).includes(kind)) return s;
  const next = mapPlayer(s, playerId, (pl) => ({
    ...pl,
    revealed: { ...pl.revealed, [kind]: true },
  }));
  return { ...next, revealedThisRound: { ...next.revealedThisRound, [playerId]: true } };
}

function cardAppeal(card: Card): number {
  return card.value + rng.next() * 1.5;
}

/** Every living bot that has not yet revealed a card this round reveals one. */
export function botsReveal(s: GameState): GameState {
  let cur = s;
  for (const p of alivePlayers(s)) {
    if (p.isHuman || cur.revealedThisRound[p.id]) continue;
    const kinds = revealableKinds(cur, playerById(cur, p.id));
    if (kinds.length === 0) continue;
    // Bots like to show good cards first, but sometimes bluff by showing bad ones.
    const sorted = kinds
      .slice()
      .sort((a, b) => cardAppeal(playerById(cur, p.id).cards[b]) - cardAppeal(playerById(cur, p.id).cards[a]));
    const kind = chance(0.2) ? pick(kinds) : sorted[0];
    cur = revealCard(cur, p.id, kind);
  }
  return cur;
}

export function canLeaveTable(s: GameState): boolean {
  const human = s.players.find((p) => p.isHuman);
  if (!human || !human.alive) return true;
  return !!s.revealedThisRound[human.id];
}

export function startDiscussion(s: GameState): GameState {
  if (s.stage !== 'table') return s;
  const afterBots = botsReveal(s);
  return withMessage(
    { ...afterBots, stage: 'discussion' },
    null,
    `Раунд ${s.round}. Обсуждение началось. Мест в бункере: ${s.seats}.`,
  );
}

function revealedValue(p: Player): number {
  return KIND_ORDER.filter((k) => p.revealed[k]).reduce((sum, k) => sum + p.cards[k].value, 0);
}

/** A believable line for a random living bot, based on what is already on the table. */
export function botMessage(s: GameState): GameState {
  const bots = alivePlayers(s).filter((p) => !p.isHuman);
  if (bots.length === 0) return s;
  const bot = pick(bots);
  const others = alivePlayers(s).filter((p) => p.id !== bot.id);
  const roll = rng.next();
  let text: string;

  const mine = KIND_ORDER.filter((k) => bot.revealed[k]).map((k) => bot.cards[k]);
  const bestMine = mine.slice().sort((a, b) => b.value - a.value)[0];

  if (roll < 0.35 && bestMine && bestMine.value > 0) {
    text = `У меня «${bestMine.title}». Это пригодится бункеру.`;
  } else if (roll < 0.7) {
    const worst = others
      .map((o) => ({ o, v: revealedValue(o), n: KIND_ORDER.filter((k) => o.revealed[k]).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => a.v - b.v)[0];
    if (worst) {
      const bad = KIND_ORDER.filter((k) => worst.o.revealed[k])
        .map((k) => worst.o.cards[k])
        .sort((a, b) => a.value - b.value)[0];
      text = `${worst.o.name}, «${bad.title}» — это проблема для нас. Объясни.`;
    } else {
      text = 'Давайте не спешить, пока почти ничего не раскрыто.';
    }
  } else if (roll < 0.85) {
    const need = pick(s.catastrophe.needs);
    text = `Для этой катастрофы критична тема «${TAG_LABEL[need]}». Смотрите, у кого она есть.`;
  } else {
    const quiet = others.sort(
      (a, b) =>
        KIND_ORDER.filter((k) => a.revealed[k]).length - KIND_ORDER.filter((k) => b.revealed[k]).length,
    )[0];
    text = quiet ? `${quiet.name} пока молчит. Что скажешь в своё оправдание?` : 'Кто следующий?';
  }
  return withMessage(s, bot.id, text);
}

export function startVoting(s: GameState): GameState {
  if (s.stage !== 'discussion') return s;
  if (eliminationsThisRound(s) === 0) {
    return resolveRound({ ...s, stage: 'voting', votes: {} });
  }
  return { ...s, stage: 'voting', votes: {} };
}

export function castVote(s: GameState, voterId: string, targetId: string): GameState {
  if (s.stage !== 'voting') return s;
  const voter = playerById(s, voterId);
  const target = playerById(s, targetId);
  if (!voter.alive || !target.alive || voterId === targetId) return s;
  return { ...s, votes: { ...s.votes, [voterId]: targetId } };
}

/** How badly the voter wants a given player gone: worse cards and randomness raise it. */
function suspicion(voter: Player, target: Player, s: GameState): number {
  const kinds = KIND_ORDER.filter((k) => target.revealed[k]);
  let score = -revealedValue(target);
  for (const k of kinds) {
    for (const t of target.cards[k].tags) {
      if (s.catastrophe.needs.includes(t)) score -= 1.5;
    }
  }
  if (kinds.length === 0) score += 1; // unknown players look suspicious
  return score + rng.next() * 3 + (voter.isHuman ? 0 : 0);
}

export function botsVote(s: GameState): GameState {
  if (s.stage !== 'voting') return s;
  let cur = s;
  const alive = alivePlayers(s);
  for (const voter of alive) {
    if (voter.isHuman || cur.votes[voter.id]) continue;
    const targets = alive.filter((p) => p.id !== voter.id);
    const best = targets
      .map((t) => ({ t, v: suspicion(voter, t, s) }))
      .sort((a, b) => b.v - a.v)[0];
    cur = castVote(cur, voter.id, best.t.id);
  }
  return cur;
}

export function humanHasVoted(s: GameState): boolean {
  const human = s.players.find((p) => p.isHuman);
  return !human || !human.alive || !!s.votes[human.id];
}

export function resolveRound(s: GameState): GameState {
  if (s.stage !== 'voting') return s;
  const need = eliminationsThisRound(s);
  const withBots = need > 0 ? botsVote(s) : s;

  const tally: Record<string, number> = {};
  for (const p of alivePlayers(withBots)) tally[p.id] = 0;
  for (const [voterId, targetId] of Object.entries(withBots.votes)) {
    const voter = playerById(withBots, voterId);
    const weight = voter.revealed.special && voter.cards.special.effect === 'doubleVote' ? 2 : 1;
    if (tally[targetId] !== undefined) tally[targetId] += weight;
  }

  let tieBroken = false;
  const eliminated: string[] = [];
  const shieldBlocked: string[] = [];
  let players = withBots.players;

  if (need > 0) {
    const order = alivePlayers(withBots)
      .map((p) => ({ p, votes: tally[p.id], tie: rng.next() }))
      .sort((a, b) => b.votes - a.votes || b.tie - a.tie);

    for (let i = 0; i < order.length - 1; i++) {
      if (order[i].votes === order[i + 1].votes && order[i].votes > 0) tieBroken = true;
    }

    for (const { p } of order) {
      if (eliminated.length >= need) break;
      const shielded =
        p.revealed.special && p.cards.special.effect === 'shield' && !p.shieldUsed;
      if (shielded) {
        shieldBlocked.push(p.id);
        players = players.map((x) => (x.id === p.id ? { ...x, shieldUsed: true } : x));
        continue;
      }
      eliminated.push(p.id);
    }
    // If shields absorbed too many votes, the quota is still filled from the most-voted shielded players.
    for (const { p } of order) {
      if (eliminated.length >= need) break;
      if (!eliminated.includes(p.id)) eliminated.push(p.id);
    }
    players = players.map((x) =>
      eliminated.includes(x.id)
        ? {
            ...x,
            alive: false,
            revealed: {
              profession: true,
              biology: true,
              health: true,
              fact: true,
              hobby: true,
              baggage: true,
              special: true,
            },
          }
        : x,
    );
  }

  const result: RoundResult = {
    round: withBots.round,
    tally,
    eliminated,
    shieldBlocked,
    tieBroken,
  };
  return { ...withBots, players, stage: 'result', results: [...withBots.results, result] };
}

export function isLastRound(s: GameState): boolean {
  return s.round >= s.totalRounds;
}

export function nextRound(s: GameState): GameState {
  if (s.stage !== 'result') return s;
  if (isLastRound(s)) {
    return { ...s, stage: 'final', final: buildFinal(s) };
  }
  const next: GameState = {
    ...s,
    round: s.round + 1,
    stage: 'table',
    votes: {},
    revealedThisRound: {},
  };
  return withMessage(next, null, `Начинается раунд ${next.round}.`);
}

function buildFinal(s: GameState): FinalReport {
  const survivors = alivePlayers(s);
  const provided = new Set<Tag>();
  let cardScore = 0;
  for (const p of survivors) {
    for (const k of KIND_ORDER) {
      const c = p.cards[k];
      cardScore += c.value;
      c.tags.forEach((t) => provided.add(t));
    }
  }
  let bunkerScore = 0;
  for (const b of s.bunker) {
    bunkerScore += b.bonus;
    b.tags.forEach((t) => provided.add(t));
  }

  const covered: Tag[] = [];
  const missing: Tag[] = [];
  for (const need of s.catastrophe.needs) {
    (provided.has(need) ? covered : missing).push(need);
  }

  const score = cardScore + bunkerScore + covered.length * 4 - missing.length * 6;
  const base = survivors.length * 8;

  let verdict: FinalReport['verdict'];
  if (missing.length === 0 && score >= base * 1.05) verdict = 'thrive';
  else if (score >= base * 0.8 && missing.length <= 1) verdict = 'survive';
  else verdict = 'fall';

  const years = s.catastropheYears;
  const lines: string[] = [];
  for (const need of covered) {
    const hero = survivors.find((p) => p.cards.profession.tags.includes(need)) ??
      survivors.find((p) => KIND_ORDER.some((k) => p.cards[k].tags.includes(need)));
    const card = hero
      ? KIND_ORDER.map((k) => hero.cards[k]).find((c) => c.tags.includes(need))
      : undefined;
    if (hero && card) {
      lines.push(`С темой «${TAG_LABEL[need]}» справились благодаря игроку ${hero.name} («${card.title}»).`);
    } else {
      lines.push(`Тема «${TAG_LABEL[need]}» была закрыта оборудованием бункера.`);
    }
  }
  for (const need of missing) {
    lines.push(`Никто в бункере не мог обеспечить тему «${TAG_LABEL[need]}», и это стало слабым местом.`);
  }
  const flaws = s.bunker.filter((b) => b.bonus < 0);
  for (const f of flaws) {
    lines.push(`Проблема бункера: «${f.title}». ${f.text}`);
  }

  let headline: string;
  if (verdict === 'thrive') {
    headline = `Бункер выжил и процветает. Через ${years} лет люди вышли на поверхность.`;
  } else if (verdict === 'survive') {
    headline = `Бункер выжил, но дорогой ценой. Через ${years} лет вышла лишь часть группы.`;
  } else {
    headline = `Бункер не выдержал. Группа погибла, не дожив до конца катастрофы (${years} лет).`;
  }

  return {
    survivors: survivors.map((p) => p.id),
    score,
    base,
    verdict,
    headline,
    lines,
    covered,
    missing,
  };
}
