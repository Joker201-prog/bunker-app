export type CardKind =
  | 'profession'
  | 'biology'
  | 'health'
  | 'fact'
  | 'hobby'
  | 'baggage'
  | 'special';

export type Tag =
  | 'medicine'
  | 'food'
  | 'energy'
  | 'tech'
  | 'defense'
  | 'psychology'
  | 'labor'
  | 'water'
  | 'education'
  | 'children';

export type CardEffect = 'doubleVote' | 'shield';

export interface Card {
  kind: CardKind;
  title: string;
  /** Short explanation shown under the title (used for special cards). */
  note?: string;
  /** How useful the card is for survival: from -3 (terrible) to +3 (great). */
  value: number;
  tags: Tag[];
  effect?: CardEffect;
}

export interface Catastrophe {
  title: string;
  text: string;
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

export interface GameState {
  players: Player[];
  seats: number;
  round: number;
  totalRounds: number;
  elimsPerRound: number[];
  stage: Stage;
  catastrophe: Catastrophe;
  catastropheYears: number;
  bunker: BunkerCard[];
  /** voterId -> targetId for the current voting. */
  votes: Record<string, string>;
  revealedThisRound: Record<string, boolean>;
  chat: ChatMessage[];
  nextMessageId: number;
  results: RoundResult[];
  final: FinalReport | null;
}
