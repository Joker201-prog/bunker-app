import type { BunkerCard, Card, CardKind, Catastrophe, Tag } from '../game/types';
import { chance, int, pick } from '../game/rng';

export const KIND_ORDER: CardKind[] = [
  'profession',
  'biology',
  'health',
  'fact',
  'hobby',
  'baggage',
  'special',
];

export const KIND_LABEL: Record<CardKind, string> = {
  profession: 'Профессия',
  biology: 'Биология',
  health: 'Здоровье',
  fact: 'Факт',
  hobby: 'Хобби',
  baggage: 'Багаж',
  special: 'Особое условие',
};

export const KIND_ICON: Record<CardKind, string> = {
  profession: '🛠',
  biology: '🧬',
  health: '❤️',
  fact: '💬',
  hobby: '🎨',
  baggage: '🎒',
  special: '⚡',
};

export const TAG_LABEL: Record<Tag, string> = {
  medicine: 'медицина',
  food: 'еда',
  energy: 'энергия',
  tech: 'техника',
  defense: 'защита',
  psychology: 'психологическая стойкость',
  labor: 'рабочие руки',
  water: 'вода',
  education: 'знания',
  children: 'дети',
};

const mk =
  (kind: CardKind) =>
  (title: string, value: number, tags: Tag[] = []): Card => ({ kind, title, value, tags });

const P = mk('profession');
const H = mk('health');
const F = mk('fact');
const Hb = mk('hobby');
const B = mk('baggage');

export const PROFESSIONS: Card[] = [
  P('Врач-терапевт', 3, ['medicine']),
  P('Хирург', 3, ['medicine']),
  P('Фельдшер скорой помощи', 2, ['medicine']),
  P('Ветеринар', 2, ['medicine', 'food']),
  P('Фермер', 3, ['food']),
  P('Эколог', 2, ['food', 'water']),
  P('Повар', 2, ['food']),
  P('Биолог-генетик', 2, ['food', 'medicine']),
  P('Инженер-электрик', 3, ['energy', 'tech']),
  P('Радиотехник', 2, ['tech', 'energy']),
  P('Слесарь', 2, ['tech', 'labor']),
  P('Строитель', 2, ['labor', 'defense']),
  P('Водитель-дальнобойщик', 1, ['labor']),
  P('Военный инструктор', 2, ['defense']),
  P('Охранник', 1, ['defense']),
  P('Психолог', 2, ['psychology']),
  P('Учитель начальных классов', 1, ['education', 'children']),
  P('Программист', 1, ['tech']),
  P('Бухгалтер', 0),
  P('Менеджер по продажам', 0),
  P('Парикмахер', 0),
  P('Юрист', -1),
  P('Блогер', -1),
  P('Фокусник', -1),
  P('Астролог', -2),
];

export const HEALTH: Card[] = [
  H('Идеальное здоровье', 3),
  H('Здоров, бегает марафоны', 3),
  H('Иммунитет к большинству инфекций', 2),
  H('Лёгкая близорукость', 0),
  H('Аллергия на пыль', -1),
  H('Бронхиальная астма', -1),
  H('Депрессия в ремиссии', -1),
  H('Диабет 1 типа', -2),
  H('Хронический бронхит', -2),
  H('Нет кисти левой руки', -2),
  H('Слепота', -3),
  H('Тяжёлая сердечная недостаточность', -3),
];

export const FACTS: Card[] = [
  F('Прошёл курс первой помощи', 1, ['medicine']),
  F('Знает три иностранных языка', 1),
  F('Умеет ориентироваться по звёздам', 1),
  F('Лидер от природы', 2, ['psychology']),
  F('Умеет водить любой транспорт', 1, ['labor']),
  F('Отличная память', 1),
  F('Чемпион по шахматам', 1),
  F('Не боится крови', 1, ['medicine']),
  F('Лунатик', -1),
  F('Бывший заключённый', -1),
  F('Состоит в секте', -2),
  F('Паникёр', -2),
  F('Боится замкнутых пространств', -3),
  F('Храпит так, что слышно в соседнем бункере', -1),
];

export const HOBBIES: Card[] = [
  Hb('Огородничество', 2, ['food']),
  Hb('Охота', 2, ['food', 'defense']),
  Hb('Рыбалка', 1, ['food']),
  Hb('Кулинария', 1, ['food']),
  Hb('Ремонт техники', 2, ['tech']),
  Hb('Радиолюбительство', 2, ['tech']),
  Hb('Боевые искусства', 1, ['defense']),
  Hb('Туризм и походы', 1),
  Hb('Шитьё и вязание', 1),
  Hb('Йога и медитация', 0, ['psychology']),
  Hb('Пение в хоре', 0, ['psychology']),
  Hb('Рисование', 0),
  Hb('Компьютерные игры', 0),
  Hb('Коллекционирование марок', -1),
  Hb('Танцы для соцсетей', -1),
];

export const BAGGAGE: Card[] = [
  B('Переносная электростанция', 3, ['energy']),
  B('Фильтр для воды', 3, ['water']),
  B('Семена овощей', 3, ['food']),
  B('Аптечка', 2, ['medicine']),
  B('Ящик консервов', 2, ['food']),
  B('Набор инструментов', 2, ['tech']),
  B('Рация', 2, ['tech']),
  B('Мини-теплица', 2, ['food']),
  B('Охотничье ружьё', 1, ['defense']),
  B('Спальные мешки', 1),
  B('Книга «Как выжить»', 1, ['education']),
  B('Дрон с камерой', 1, ['tech']),
  B('Гитара', 0, ['psychology']),
  B('Золотые слитки', 0),
  B('Плюшевый медведь', 0),
  B('Коллекционное вино', -1),
];

export const SPECIALS: Card[] = [
  {
    kind: 'special',
    title: 'Двойной голос',
    note: 'После раскрытия ваш голос в голосовании считается за два.',
    value: 1,
    tags: [],
    effect: 'doubleVote',
  },
  {
    kind: 'special',
    title: 'Неприкосновенность',
    note: 'После раскрытия защищает вас от одного исключения.',
    value: 1,
    tags: [],
    effect: 'shield',
  },
  {
    kind: 'special',
    title: 'Харизматичный оратор',
    note: 'Умеет успокаивать людей и приводить доводы.',
    value: 1,
    tags: ['psychology'],
  },
  {
    kind: 'special',
    title: 'Счастливчик',
    note: 'Ему всегда везёт.',
    value: 1,
    tags: [],
  },
  {
    kind: 'special',
    title: 'Хранитель секрета',
    note: 'Знает то, о чём остальные лучше бы не знали.',
    value: 0,
    tags: [],
  },
  {
    kind: 'special',
    title: 'Невезучий',
    note: 'Если что-то может сломаться, оно сломается.',
    value: -1,
    tags: [],
  },
];

export const CATASTROPHES: Catastrophe[] = [
  {
    title: 'Ядерная осень',
    text: 'Серия ударов привела к радиоактивному заражению. Воздух, вода и почва снаружи опасны.',
    needs: ['medicine', 'energy', 'water'],
  },
  {
    title: 'Пандемия «Красный сезон»',
    text: 'Смертельный вирус охватил планету. Города вымерли за несколько месяцев.',
    needs: ['medicine', 'psychology', 'food'],
  },
  {
    title: 'Метеоритная зима',
    text: 'Падение астероида подняло в атмосферу пыль, солнце скрылось на годы.',
    needs: ['food', 'energy', 'tech'],
  },
  {
    title: 'Восстание машин',
    text: 'Управляющий ИИ отключил инфраструктуру и охотится на людей.',
    needs: ['tech', 'defense', 'energy'],
  },
  {
    title: 'Великий потоп',
    text: 'Уровень океана поднялся, суши почти не осталось.',
    needs: ['labor', 'water', 'food'],
  },
  {
    title: 'Пробуждение супервулкана',
    text: 'Пепел покрыл небо, наступила вулканическая зима.',
    needs: ['food', 'energy', 'medicine'],
  },
  {
    title: 'Грибная чума',
    text: 'Споры неизвестного гриба заражают людей и животных.',
    needs: ['medicine', 'defense', 'tech'],
  },
  {
    title: 'Социальный коллапс',
    text: 'Государства распались, на улицах банды и анархия.',
    needs: ['defense', 'psychology', 'labor'],
  },
];

export const BUNKER_CARDS: BunkerCard[] = [
  { title: 'Склад консервов', text: 'Запасов еды хватит на два года.', bonus: 2, tags: ['food'] },
  { title: 'Оранжерея', text: 'Работающая гидропонная ферма.', bonus: 2, tags: ['food'] },
  { title: 'Дизельный генератор', text: 'Топлива на год.', bonus: 2, tags: ['energy'] },
  { title: 'Артезианская скважина', text: 'Чистая вода без фильтров.', bonus: 2, tags: ['water'] },
  { title: 'Медицинский блок', text: 'Операционная и запас лекарств.', bonus: 2, tags: ['medicine'] },
  { title: 'Арсенал', text: 'Оружейная комната и запас патронов.', bonus: 1, tags: ['defense'] },
  { title: 'Серверная', text: 'Связь и рабочие компьютеры.', bonus: 1, tags: ['tech'] },
  { title: 'Библиотека', text: 'Учебники, справочники, архивы.', bonus: 1, tags: ['education'] },
  { title: 'Спортзал и сад', text: 'Помогает не сойти с ума.', bonus: 1, tags: ['psychology'] },
  { title: 'Сырые стены', text: 'Плесень во всех жилых отсеках.', bonus: -2, tags: [] },
  { title: 'Неисправная вентиляция', text: 'Воздух приходится чистить вручную.', bonus: -2, tags: [] },
  { title: 'Тесные спальни', text: 'Нет личного пространства.', bonus: -1, tags: [] },
  { title: 'Крысы в запасах', text: 'Часть продуктов уже испорчена.', bonus: -1, tags: [] },
];

export function makeBiology(male: boolean = chance(0.5)): Card {
  const age = int(18, 75);
  let value: number;
  if (age <= 35) value = 2;
  else if (age <= 45) value = 1;
  else if (age <= 55) value = 0;
  else if (age <= 65) value = -1;
  else value = -2;

  const infertileChance = age > 50 ? 0.9 : 0.12;
  const fertile = !chance(infertileChance);
  const tags: Tag[] = [];
  if (fertile && age <= 45) {
    tags.push('children');
    value += 1;
  }
  const word = age % 10 === 1 && age % 100 !== 11 ? 'год' : [2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100) ? 'года' : 'лет';
  const sex = male ? 'Мужчина' : 'Женщина';
  const title = `${sex}, ${age} ${word}${fertile ? '' : ' (бесплодие)'}`;
  return { kind: 'biology', title, value, tags };
}

export function drawProfession(): Card {
  return pick(PROFESSIONS);
}
