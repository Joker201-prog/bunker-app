/**
 * Карты игры. Профессии, биология, здоровье, фобии, черты характера, хобби, факты, багаж,
 * особые условия и катастрофы берутся из библиотеки (src/data/library.ts, генерируется из
 * content/bunker-library.md). Здесь — порядок и подписи видов карт, названия тем и карты бункера.
 */
import type { BunkerCard, Card, CardKind, Tag } from '../game/types';
import { pick } from '../game/rng';
import { BIOLOGY_FEMALE, BIOLOGY_MALE } from './library';

export {
  BAGGAGE,
  CARD_TEXT,
  CATASTROPHES,
  CHARACTERS,
  FACTS,
  HEALTH,
  HOBBIES,
  PHOBIAS,
  PROFESSIONS,
  SPECIALS,
} from './library';

export const KIND_ORDER: CardKind[] = [
  'profession',
  'biology',
  'health',
  'phobia',
  'character',
  'hobby',
  'fact',
  'baggage',
  'special',
];

export const KIND_LABEL: Record<CardKind, string> = {
  profession: 'Профессия',
  biology: 'Биология',
  health: 'Здоровье',
  phobia: 'Фобия',
  character: 'Характер',
  hobby: 'Хобби',
  fact: 'Факт',
  baggage: 'Багаж',
  special: 'Особое условие',
};

export const TAG_LABEL: Record<Tag, string> = {
  medicine: 'медицина',
  engineering: 'техника',
  food: 'еда',
  defense: 'защита',
  radiation: 'защита от радиации',
  chemistry: 'химия',
  biology: 'биология',
  energy: 'энергия',
  water: 'вода',
  psychology: 'психология',
  communication: 'связь',
  construction: 'строительство',
  transport: 'транспорт',
  leadership: 'руководство',
  science: 'наука',
  craft: 'ремесло',
};

export const BUNKER_CARDS: BunkerCard[] = [
  { title: 'Склад консервов', text: 'Запасов еды хватит на два года.', bonus: 2, tags: ['food'] },
  { title: 'Оранжерея', text: 'Работающая гидропонная ферма.', bonus: 2, tags: ['food', 'biology'] },
  { title: 'Дизельный генератор', text: 'Топлива на год.', bonus: 2, tags: ['energy'] },
  { title: 'Артезианская скважина', text: 'Чистая вода без фильтров.', bonus: 2, tags: ['water'] },
  { title: 'Медицинский блок', text: 'Операционная и запас лекарств.', bonus: 2, tags: ['medicine'] },
  { title: 'Арсенал', text: 'Оружейная комната и запас патронов.', bonus: 1, tags: ['defense'] },
  { title: 'Радиостанция', text: 'Связь с другими убежищами.', bonus: 1, tags: ['communication'] },
  { title: 'Мастерская', text: 'Станки и инструменты для ремонта.', bonus: 1, tags: ['engineering', 'craft'] },
  { title: 'Библиотека', text: 'Учебники, справочники, архивы.', bonus: 1, tags: ['science'] },
  { title: 'Свинцовые стены', text: 'Защита от радиации в жилых отсеках.', bonus: 1, tags: ['radiation'] },
  { title: 'Спортзал и сад', text: 'Помогает не сойти с ума.', bonus: 1, tags: ['psychology'] },
  { title: 'Сырые стены', text: 'Плесень во всех жилых отсеках.', bonus: -2, tags: [] },
  { title: 'Неисправная вентиляция', text: 'Воздух приходится чистить вручную.', bonus: -2, tags: [] },
  { title: 'Тесные спальни', text: 'Нет личного пространства.', bonus: -1, tags: [] },
  { title: 'Крысы в запасах', text: 'Часть продуктов уже испорчена.', bonus: -1, tags: [] },
];

/** Карта биологии нужного пола: пол в досье совпадает с именем и портретом. */
export function biologyDeck(male: boolean): readonly Card[] {
  return male ? BIOLOGY_MALE : BIOLOGY_FEMALE;
}

export function randomBiology(male: boolean): Card {
  return pick(biologyDeck(male));
}
