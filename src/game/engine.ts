import {
  BAGGAGE,
  BUNKER_CARDS,
  CATASTROPHES,
  CHARACTERS,
  FACTS,
  HEALTH,
  HOBBIES,
  KIND_LABEL,
  KIND_ORDER,
  PHOBIAS,
  PROFESSIONS,
  SPECIALS,
  TAG_LABEL,
  biologyDeck,
} from '../data/cards';
import { chance, pick, rng, shuffle } from './rng';
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

/** Имена с полом: биология бота всегда соответствует его имени. */
export const BOT_NAMES: { name: string; male: boolean }[] = [
  { name: 'Алексей', male: true },
  { name: 'Мария', male: false },
  { name: 'Дмитрий', male: true },
  { name: 'Ольга', male: false },
  { name: 'Игорь', male: true },
  { name: 'Наталья', male: false },
  { name: 'Сергей', male: true },
  { name: 'Анна', male: false },
  { name: 'Виктор', male: true },
  { name: 'Елена', male: false },
  { name: 'Максим', male: true },
  { name: 'Ирина', male: false },
  { name: 'Артём', male: true },
  { name: 'Светлана', male: false },
  { name: 'Николай', male: true },
  { name: 'Татьяна', male: false },
];

export const DEFAULT_HUMAN_NAME = 'Игрок';

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

/** Участник партии до раздачи карт. */
export interface Participant {
  id: string;
  name: string;
  isHuman: boolean;
  /** Пол для карты биологии; если не задан — случайный. */
  male?: boolean;
}

export const DEFAULT_DISCUSSION_SECONDS = 60;
export const DEFAULT_VOTING_SECONDS = 30;
/** Пауза между раскрытиями карт ботами, мс. */
export const BOT_REVEAL_GAP_MS = 900;

/** Сколько аватаров каждого пола есть в приложении (assets/ui/avatar_m*.jpg, avatar_f*.jpg). */
export const AVATARS_PER_SEX = 6;

/** Раздаёт карты участникам и создаёт партию. */
export function createGame(
  participants: Participant[],
  opts: { hostId?: string | null; discussionSeconds?: number; votingSeconds?: number } = {},
  now: number = Date.now(),
): GameState {
  const count = participants.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`В партии должно быть от ${MIN_PLAYERS} до ${MAX_PLAYERS} игроков`);
  }
  const seats = seatsFor(count);

  // Колоды без повторов внутри партии; биология — отдельно для мужчин и женщин.
  const draw: Record<Exclude<CardKind, 'biology'>, () => Card> = {
    profession: makeDeck(PROFESSIONS),
    health: makeDeck(HEALTH),
    phobia: makeDeck(PHOBIAS),
    character: makeDeck(CHARACTERS),
    hobby: makeDeck(HOBBIES),
    fact: makeDeck(FACTS),
    baggage: makeDeck(BAGGAGE),
    special: makeDeck(SPECIALS),
  };
  const bioDeck = { m: makeDeck(biologyDeck(true)), f: makeDeck(biologyDeck(false)) };

  // Аватары раздаются из перемешанной колоды отдельно для мужчин и женщин,
  // поэтому в партии они не повторяются, пока хватает портретов.
  const avatarDeck = {
    m: makeDeck(Array.from({ length: AVATARS_PER_SEX }, (_, i) => i)),
    f: makeDeck(Array.from({ length: AVATARS_PER_SEX }, (_, i) => i)),
  };
  const players: Player[] = participants.map((part) => {
    const male = part.male ?? chance(0.5);
    const cards = {
      profession: draw.profession(),
      biology: bioDeck[male ? 'm' : 'f'](),
      health: draw.health(),
      phobia: draw.phobia(),
      character: draw.character(),
      hobby: draw.hobby(),
      fact: draw.fact(),
      baggage: draw.baggage(),
      special: draw.special(),
    } as Record<CardKind, Card>;
    return {
      id: part.id,
      name: part.name,
      isHuman: part.isHuman,
      photo: `${male ? 'm' : 'f'}${avatarDeck[male ? 'm' : 'f']()}`,
      alive: true,
      cards,
      revealed: Object.fromEntries(KIND_ORDER.map((k) => [k, false])) as Record<CardKind, boolean>,
      shieldUsed: false,
    };
  });

  const bunker: BunkerCard[] = shuffle(BUNKER_CARDS).slice(0, 3);
  const game: GameState = {
    id: Math.floor(rng.next() * 36 ** 8).toString(36) + now.toString(36),
    hostId: opts.hostId ?? null,
    discussionSeconds: opts.discussionSeconds ?? DEFAULT_DISCUSSION_SECONDS,
    votingSeconds: opts.votingSeconds ?? DEFAULT_VOTING_SECONDS,
    discussionEndsAt: null,
    votingEndsAt: null,
    turnOrder: [],
    turnIndex: 0,
    nextBotRevealAt: null,
    revealLog: [],
    nextBotChatAt: null,
    players,
    seats,
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    elimsPerRound: distributeEliminations(count - seats, TOTAL_ROUNDS),
    stage: 'table',
    catastrophe: pick(CATASTROPHES),
    bunker,
    votes: {},
    revealedThisRound: {},
    chat: [],
    nextMessageId: 1,
    results: [],
    final: null,
  };
  return beginTable(game, now);
}

/** Свободные имена ботов, которых ещё нет среди занятых имён. */
export function freeBotNames(taken: string[]): { name: string; male: boolean }[] {
  const lower = new Set(taken.map((n) => n.trim().toLowerCase()));
  return BOT_NAMES.filter((b) => !lower.has(b.name.toLowerCase()));
}

/** Одиночная партия: игрок с id «human» против ботов, игрок же и ведущий. */
export function newGame(opts: { humanName: string; players: number }): GameState {
  const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(opts.players)));
  const humanName = opts.humanName.trim() || DEFAULT_HUMAN_NAME;
  const bots = shuffle(freeBotNames([humanName]));
  const participants: Participant[] = [{ id: 'human', name: humanName, isHuman: true }];
  for (let i = 1; i < count; i++) {
    const b = bots[(i - 1) % bots.length];
    participants.push({ id: `bot${i}`, name: b.name, isHuman: false, male: b.male });
  }
  return createGame(participants, { hostId: 'human' });
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

/**
 * Начало раунда за столом: очередь раскрытия. Каждый раунд очередь сдвигается,
 * чтобы первым ходил разный игрок.
 */
function beginTable(s: GameState, now: number): GameState {
  const alive = alivePlayers(s).map((p) => p.id);
  const shift = alive.length ? (s.round - 1) % alive.length : 0;
  const turnOrder = [...alive.slice(shift), ...alive.slice(0, shift)];
  return skipFinished({ ...s, turnOrder, turnIndex: 0, nextBotRevealAt: now + BOT_REVEAL_GAP_MS });
}

/** Пропустить в очереди тех, кому нечего раскрывать или кто уже раскрыл. */
function skipFinished(s: GameState): GameState {
  let i = s.turnIndex;
  while (i < s.turnOrder.length) {
    const p = s.players.find((x) => x.id === s.turnOrder[i]);
    if (p && p.alive && !s.revealedThisRound[p.id] && revealableKinds(s, p).length > 0) break;
    i++;
  }
  return i === s.turnIndex ? s : { ...s, turnIndex: i };
}

/** Чей сейчас ход раскрывать карту; null — все раскрыли. */
export function currentTurn(s: GameState): string | null {
  if (s.stage !== 'table') return null;
  return s.turnOrder[s.turnIndex] ?? null;
}

/** The kinds a player may reveal right now (round 1 forces profession). */
export function revealableKinds(s: GameState, p: Player): CardKind[] {
  if (s.revealedThisRound[p.id]) return [];
  if (s.round === 1) return p.revealed.profession ? [] : ['profession'];
  return KIND_ORDER.filter((k) => !p.revealed[k]);
}

/** Раскрыть карту в свой ход. Возвращает то же состояние, если сейчас нельзя. */
export function revealCard(s: GameState, playerId: string, kind: CardKind, auto = false): GameState {
  if (s.stage !== 'table') return s;
  if (currentTurn(s) !== playerId) return s;
  const p = playerById(s, playerId);
  if (!p.alive || !revealableKinds(s, p).includes(kind)) return s;
  let next = mapPlayer(s, playerId, (pl) => ({
    ...pl,
    revealed: { ...pl.revealed, [kind]: true },
  }));
  next = {
    ...next,
    revealedThisRound: { ...next.revealedThisRound, [playerId]: true },
    revealLog: [...next.revealLog, { round: s.round, playerId, kind, ...(auto ? { auto: true } : {}) }],
    turnIndex: next.turnIndex + 1,
  };
  next = withMessage(next, null, `${p.name} открывает: ${KIND_LABEL[kind]} — ${p.cards[kind].title}${auto ? ' (автоматически)' : ''}.`);
  return skipFinished(next);
}

function cardAppeal(card: Card): number {
  return card.value + rng.next() * 1.5;
}

/** Какую карту раскроет бот: обычно лучшую, иногда наугад (блефует). */
function botChoice(s: GameState, p: Player): CardKind | null {
  const kinds = revealableKinds(s, p);
  if (!kinds.length) return null;
  const sorted = kinds.slice().sort((a, b) => cardAppeal(p.cards[b]) - cardAppeal(p.cards[a]));
  return chance(0.2) ? pick(kinds) : sorted[0];
}

/** Если сейчас ход бота и пауза прошла — бот раскрывает карту. */
export function botTurn(s: GameState, now: number): GameState {
  const id = currentTurn(s);
  if (!id || (s.nextBotRevealAt !== null && now < s.nextBotRevealAt)) return s;
  const p = playerById(s, id);
  if (p.isHuman) return s;
  const kind = botChoice(s, p);
  const next = kind ? revealCard(s, id, kind) : skipFinished({ ...s, turnIndex: s.turnIndex + 1 });
  return { ...next, nextBotRevealAt: now + BOT_REVEAL_GAP_MS };
}

/** Раскрыть оставшиеся карты по очереди: боты выбирают сами, людям открывается первая доступная. */
function revealRemaining(s: GameState): GameState {
  let cur = s;
  for (let guard = 0; guard < 64; guard++) {
    const id = currentTurn(cur);
    if (!id) break;
    const p = playerById(cur, id);
    const kind = p.isHuman ? revealableKinds(cur, p)[0] : botChoice(cur, p);
    const next = kind ? revealCard(cur, id, kind, p.isHuman) : skipFinished({ ...cur, turnIndex: cur.turnIndex + 1 });
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** Ведущий пропускает ход игрока-человека: ему раскрывается первая доступная карта. */
export function skipTurn(s: GameState): GameState {
  const id = currentTurn(s);
  if (!id) return s;
  const p = playerById(s, id);
  const kind = revealableKinds(s, p)[0];
  return kind ? revealCard(s, id, kind, true) : skipFinished({ ...s, turnIndex: s.turnIndex + 1 });
}

/** Живые люди, которые ещё не раскрыли карту в этом раунде. */
export function pendingReveals(s: GameState): Player[] {
  if (s.stage !== 'table') return [];
  return alivePlayers(s).filter((p) => p.isHuman && !s.revealedThisRound[p.id] && revealableKinds(s, p).length > 0);
}

/** Может ли игрок перейти к обсуждению (раскрыл карту, выбыл или не участвует). */
export function canLeaveTable(s: GameState, playerId = 'human'): boolean {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || !p.alive) return true;
  return !!s.revealedThisRound[p.id] || revealableKinds(s, p).length === 0;
}

export function startDiscussion(s: GameState, now: number = Date.now()): GameState {
  if (s.stage !== 'table') return s;
  const revealed = revealRemaining(s);
  const next: GameState = {
    ...revealed,
    stage: 'discussion',
    // Таймер обсуждения запускает ведущий.
    discussionEndsAt: null,
    votingEndsAt: null,
    nextBotChatAt: now + 2500,
    nextBotRevealAt: null,
  };
  return withMessage(next, null, `Раунд ${s.round}. Обсуждение началось. Мест в бункере: ${s.seats}.`);
}

/** Ведущий запускает таймер текущего этапа (обсуждение или голосование). */
export function startTimer(s: GameState, now: number): GameState {
  if (s.stage === 'discussion' && s.discussionEndsAt === null) {
    return { ...s, discussionEndsAt: now + s.discussionSeconds * 1000 };
  }
  if (s.stage === 'voting' && s.votingEndsAt === null) {
    return { ...s, votingEndsAt: now + s.votingSeconds * 1000 };
  }
  return s;
}

function revealedValue(p: Player): number {
  return KIND_ORDER.filter((k) => p.revealed[k]).reduce((sum, k) => sum + p.cards[k].value, 0);
}

/*
 * Реплики ботов. Имена стоят только в начале фразы и в именительном падеже
 * («Игорь, …»), чтобы не склонять их. Обращения на «ты» не зависят от пола.
 */
const BOAST: ((card: string) => string)[] = [
  (c) => `У меня «${c}». Это пригодится бункеру.`,
  (c) => `«${c}» — вот что я принесу в бункер.`,
  (c) => `Моя карта «${c}» нам точно пригодится.`,
  (c) => `Не забывайте: у меня «${c}».`,
];

const ACCUSE: ((name: string, card: string) => string)[] = [
  (n, c) => `${n}, «${c}» — это проблема для нас. Объясни.`,
  (n, c) => `${n}, как «${c}» поможет бункеру?`,
  (n, c) => `${n}, «${c}» — серьёзный минус. Что скажешь?`,
  (n, c) => `${n}, мне не нравится «${c}». Убеди нас.`,
];

const NEED: ((tag: string) => string)[] = [
  (t) => `Для этой катастрофы критична тема «${t}». Смотрите, у кого она есть.`,
  (t) => `Нам нужна тема «${t}». Кто может её закрыть?`,
  (t) => `Без темы «${t}» мы не выживем.`,
  (t) => `Кто из нас отвечает за тему «${t}»?`,
];

const QUIET: ((name: string) => string)[] = [
  (n) => `${n}, ты пока молчишь. Что скажешь в своё оправдание?`,
  (n) => `${n}, твоя очередь рассказать о себе.`,
  (n) => `${n}, мы почти ничего о тебе не знаем. Расскажи.`,
];

const CAUTION = [
  'Давайте не спешить, пока почти ничего не раскрыто.',
  'Пока мало данных. Послушаем остальных.',
];

function openCards(p: Player): Card[] {
  return KIND_ORDER.filter((k) => p.revealed[k]).map((k) => p.cards[k]);
}

/** Одна возможная реплика бота; null, если сказать нечего. */
function candidateLine(s: GameState, bot: Player): string | null {
  const others = alivePlayers(s).filter((p) => p.id !== bot.id);
  const roll = rng.next();

  if (roll < 0.3) {
    const good = openCards(bot).filter((c) => c.value > 0);
    return good.length ? pick(BOAST)(pick(good).title) : null;
  }
  if (roll < 0.65) {
    const withCards = others
      .map((o) => ({ o, worst: openCards(o).sort((a, b) => a.value - b.value)[0] }))
      .filter((x) => x.worst && x.worst.value < 0)
      .sort((a, b) => a.worst.value - b.worst.value)
      .slice(0, 3);
    if (!withCards.length) return pick(CAUTION);
    const t = pick(withCards);
    return pick(ACCUSE)(t.o.name, t.worst.title);
  }
  if (roll < 0.82) {
    return pick(NEED)(TAG_LABEL[pick(s.catastrophe.needs)]);
  }
  if (roll < 0.95) {
    const quiet = others
      .slice()
      .sort((a, b) => openCards(a).length - openCards(b).length)
      .slice(0, 2);
    return quiet.length ? pick(QUIET)(pick(quiet).name) : null;
  }
  return pick(CAUTION);
}

/** Реплика случайного бота; не повторяет уже сказанное в этом обсуждении. */
export function botMessage(s: GameState): GameState {
  const bots = alivePlayers(s).filter((p) => !p.isHuman);
  if (bots.length === 0) return s;

  // Реплики текущего обсуждения: от конца чата до последнего системного сообщения.
  const used = new Set<string>();
  for (let i = s.chat.length - 1; i >= 0 && s.chat[i].authorId !== null; i--) {
    used.add(s.chat[i].text);
  }
  const last = s.chat[s.chat.length - 1];
  const pool = bots.length > 1 && last && last.authorId ? bots.filter((b) => b.id !== last.authorId) : bots;

  for (let attempt = 0; attempt < 14; attempt++) {
    const bot = pick(pool);
    const text = candidateLine(s, bot);
    if (text && !used.has(text)) return withMessage(s, bot.id, text);
  }
  return s;
}

export function startVoting(s: GameState): GameState {
  if (s.stage !== 'discussion') return s;
  const base: GameState = { ...s, stage: 'voting', votes: {}, discussionEndsAt: null, votingEndsAt: null, nextBotChatAt: null };
  if (eliminationsThisRound(s) === 0) return resolveRound(base);
  return base;
}

/** Все живые люди проголосовали. */
export function allHumansVoted(s: GameState): boolean {
  return alivePlayers(s).every((p) => !p.isHuman || !!s.votes[p.id]);
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
    // Жребий был, только если среди исключённых есть игрок с тем же числом голосов,
    // что и у оставшегося (не защищённого щитом) игрока.
    const lastOut = Math.min(...eliminated.map((id) => tally[id]));
    tieBroken =
      lastOut > 0 &&
      order.some(
        ({ p, votes }) =>
          !eliminated.includes(p.id) && !shieldBlocked.includes(p.id) && votes === lastOut,
      );
    players = players.map((x) =>
      eliminated.includes(x.id)
        ? {
            ...x,
            alive: false,
            revealed: Object.fromEntries(KIND_ORDER.map((k) => [k, true])) as Record<CardKind, boolean>,
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
  return { ...withBots, players, stage: 'result', votingEndsAt: null, results: [...withBots.results, result] };
}

export function isLastRound(s: GameState): boolean {
  return s.round >= s.totalRounds;
}

export function nextRound(s: GameState, now: number = Date.now()): GameState {
  if (s.stage !== 'result') return s;
  if (isLastRound(s)) {
    return { ...s, stage: 'final', final: buildFinal(s) };
  }
  const next: GameState = {
    ...s,
    round: s.round + 1,
    stage: 'table',
    votes: {},
    votingEndsAt: null,
    revealedThisRound: {},
  };
  return withMessage(beginTable(next, now), null, `Начинается раунд ${next.round}.`);
}

/** Пороги итога относительно ориентира base (подобраны симуляцией scripts/simulate.js). */
export const THRIVE_K = 1.0;
export const SURVIVE_K = 0.6;

export function monthsText(m: number): string {
  if (m % 12 === 0 && m >= 12) {
    const y = m / 12;
    const w = y % 10 === 1 && y % 100 !== 11 ? 'год' : [2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100) ? 'года' : 'лет';
    return `${y} ${w}`;
  }
  const w = m % 10 === 1 && m % 100 !== 11 ? 'месяц' : [2, 3, 4].includes(m % 10) && ![12, 13, 14].includes(m % 100) ? 'месяца' : 'месяцев';
  return `${m} ${w}`;
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
  // Остальные ценные при этой катастрофе темы дают небольшой бонус.
  const extraValued = s.catastrophe.valued.filter((t) => !s.catastrophe.needs.includes(t) && provided.has(t)).length;

  const score = cardScore + bunkerScore + covered.length * 4 + extraValued * 2 - missing.length * 6;
  // Чем тяжелее катастрофа (1–3), тем больше нужно набрать.
  const base = survivors.length * (4 + s.catastrophe.difficulty);

  let verdict: FinalReport['verdict'];
  if (missing.length === 0 && score >= base * THRIVE_K) verdict = 'thrive';
  else if (score >= base * SURVIVE_K && missing.length <= 1) verdict = 'survive';
  else verdict = 'fall';

  const term = monthsText(s.catastrophe.months);
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
    headline = `Бункер выжил и процветает. Через ${term} люди вышли на поверхность.`;
  } else if (verdict === 'survive') {
    headline = `Бункер выжил, но дорогой ценой. Через ${term} вышла лишь часть группы.`;
  } else {
    headline = `Бункер не выдержал. Группа погибла, не дождавшись конца катастрофы (нужно было продержаться ${term}).`;
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
