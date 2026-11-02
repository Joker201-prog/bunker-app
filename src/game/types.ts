export type CardKind =
  | 'profession'
  | 'biology'
  | 'health'
  | 'phobia'
  | 'character'
  | 'hobby'
  | 'fact'
  | 'baggage'
  | 'special';

/** Темы, нужные для выживания (общие для всей библиотеки карт). */
export type Tag =
  | 'medicine'
  | 'engineering'
  | 'food'
  | 'defense'
  | 'radiation'
  | 'chemistry'
  | 'biology'
  | 'energy'
  | 'water'
  | 'psychology'
  | 'communication'
  | 'construction'
  | 'transport'
  | 'leadership'
  | 'science'
  | 'craft';

export type CardEffect = 'doubleVote' | 'shield';

export interface Card {
  /** id из библиотеки; по нему берётся полное описание (CARD_TEXT). Пусто у скрытых чужих карт. */
  id?: string;
  kind: CardKind;
  title: string;
  /** Текст на самой карте (у особых условий — что она делает). */
  note?: string;
  /** Польза для выживания: от −3 до +3 (полезность 1–5 из библиотеки). */
  value: number;
  tags: Tag[];
  effect?: CardEffect;
}

export interface Catastrophe {
  id: string;
  title: string;
  /** Тип события, как в библиотеке: «Климат и стихия», «техногенная»… */
  kind: string;
  /** Группа для фильтров: «Стихия и климат», «Эпидемии», «Космос»… */
  group: string;
  difficulty: number;
  /** Что случилось. */
  text: string;
  population: string;
  survivors: string;
  survivorsPercent: number;
  /** Сколько месяцев сидеть в бункере, и почему. */
  months: number;
  monthsReason: string;
  /** Что творится снаружи. */
  outside: string;
  problems: string[];
  /** Что ценится и что бесполезно при этой катастрофе. */
  valued: Tag[];
  useless: Tag[];
  /** Главное для выживания: без этих тем группе тяжело. */
  needs: Tag[];
}

export interface BunkerCard {
  title: string;
  text: string;
  bonus: number;
  tags: Tag[];
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  /** Портрет в досье: «m0»…«m5», «f0»…«f5». Виден всем. */
  photo: string;
  alive: boolean;
  cards: Record<CardKind, Card>;
  revealed: Record<CardKind, boolean>;
  /** Whether a one-time shield from the special card has already been spent. */
  shieldUsed: boolean;
}

export type Stage = 'table' | 'discussion' | 'voting' | 'result' | 'final';

export interface ChatMessage {
  id: number;
  authorId: string | null; // null = system message
  text: string;
}

export interface RoundResult {
  round: number;
  tally: Record<string, number>;
  eliminated: string[];
  shieldBlocked: string[];
  tieBroken: boolean;
}

export interface FinalReport {
  survivors: string[];
  score: number;
  base: number;
  verdict: 'thrive' | 'survive' | 'fall';
  headline: string;
  lines: string[];
  covered: Tag[];
  missing: Tag[];
}

/** Запись журнала: кто какую карту открыл и в каком раунде. */
export interface RevealEntry {
  round: number;
  playerId: string;
  kind: CardKind;
  /** Раскрыта автоматически (игрок не успел или ведущий пропустил ход). */
  auto?: boolean;
}

export interface GameState {
  /** Уникальный id партии (для личных заметок на телефоне). */
  id: string;
  /** Кто управляет переходами между этапами. null — партия без ведущего. */
  hostId: string | null;
  /** Длительность обсуждения и голосования в секундах. */
  discussionSeconds: number;
  votingSeconds: number;
  /** Когда обсуждение / голосование закончится само. null — ведущий ещё не запустил таймер. */
  discussionEndsAt: number | null;
  votingEndsAt: number | null;
  /** Очередь раскрытия карт в текущем раунде и чей сейчас ход. */
  turnOrder: string[];
  turnIndex: number;
  /** Когда следующий бот раскроет карту. */
  nextBotRevealAt: number | null;
  revealLog: RevealEntry[];
  /** Когда очередной бот скажет реплику. */
  nextBotChatAt: number | null;
  players: Player[];
  seats: number;
  round: number;
  totalRounds: number;
  elimsPerRound: number[];
  stage: Stage;
  catastrophe: Catastrophe;
  bunker: BunkerCard[];
  /** voterId -> targetId for the current voting. */
  votes: Record<string, string>;
  revealedThisRound: Record<string, boolean>;
  chat: ChatMessage[];
  nextMessageId: number;
  results: RoundResult[];
  final: FinalReport | null;
}
