"""Переводит библиотеку content/bunker-library.md в код игры src/data/library.ts.
Запуск: python3 tools/import_library.py

Полезность 1–5 превращается в ценность карты: 1 → −3, 2 → −1.5, 3 → 0, 4 → +1.5, 5 → +3.
Полные описания карт кладутся отдельно (CARD_TEXT по id), чтобы не гонять их по сети в каждом состоянии игры.
"""
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'content', 'bunker-library.md')
OUT = os.path.join(ROOT, 'src', 'data', 'library.ts')

TAGS = ['medicine', 'engineering', 'food', 'defense', 'radiation', 'chemistry', 'biology', 'energy', 'water',
        'psychology', 'communication', 'construction', 'transport', 'leadership', 'science', 'craft']

SECTION_KIND = {
    'ПРОФЕССИИ': 'profession',
    'БИОЛОГИЯ': 'biology',
    'ЗДОРОВЬЕ': 'health',
    'ХОББИ': 'hobby',
    'ФОБИИ': 'phobia',
    'ЧЕРТЫ ХАРАКТЕРА': 'character',
    'ФАКТЫ': 'fact',
    'БАГАЖ': 'baggage',
    'ОСОБЫЕ УСЛОВИЯ': 'special',
}

# Типы событий в библиотеке подписаны по-разному — для фильтров сводим их в группы.
EVENT_GROUPS = {
    'Стихия и климат': ['климат и стихия', 'природная'],
    'Экология': ['экологический коллапс', 'экологическая катастрофа', 'экология', 'вымирание растений',
                 'гмо-катастрофа', 'мутировавшие насекомые'],
    'Эпидемии': ['вирусная пандемия', 'грибковое заражение', 'прионная эпидемия', 'бесплодие человечества',
                 'паразитарная инфекция', 'зомби-подобное заражение'],
    'Космос': ['космос', 'космическая', 'космическая аномалия', 'пришельцы'],
    'Техника и ИИ': ['техногенная', 'нанотехнологии', 'сбой спутников', 'бунт роботов', 'коллапс интернета',
                     'кибератака', 'ии и управление', 'отказ реакторов', 'промышленная авария', 'лаборатория'],
    'Война': ['ядерная война', 'радиационный терроризм', 'ограниченный ядерный конфликт', 'химическая война',
              'биологическое оружие', 'мировая гражданская война'],
    'Общество и власть': ['социальная', 'захват власти корпорациями', 'религиозный культ', 'голод', 'диктатура'],
    'Аномалии': ['портал', 'аномальное явление'],
}


def event_group(kind, event_id):
    k = kind.strip().lower()
    # Пандемии в старой части библиотеки подписаны как «природная»
    if 'pandemic' in event_id or 'plague' in event_id or 'virus' in event_id:
        return 'Эпидемии'
    for group, kinds in EVENT_GROUPS.items():
        if k in kinds:
            return group
    raise SystemExit(f'Нет группы для типа события «{kind}» ({event_id}) — добавьте его в EVENT_GROUPS')


# Особые условия, которые приложение выполняет само. Остальные исполняет ведущий по тексту карты.
EFFECTS = {'Дополнительный голос': 'doubleVote'}


def parse(path):
    sections = []
    cur = None
    for line in open(path, encoding='utf8').read().split('\n'):
        m = re.match(r'^## \d+\. (.+?) \((\d+)\)\s*$', line)
        if m:
            cur = {'name': m.group(1), 'entries': []}
            sections.append(cur)
            continue
        if cur is None or not line.strip() or line.startswith('#'):
            continue
        mm = re.match(r'^(?P<head>.+\bid [A-Za-z0-9_]+)\): (?P<desc>.+)$', line)
        if not mm:
            raise SystemExit(f'Не разобрать строку: {line[:100]}')
        head = mm.group('head')
        depth, cut = 1, -1
        for j in range(len(head) - 1, -1, -1):
            if head[j] == ')':
                depth += 1
            elif head[j] == '(':
                depth -= 1
                if depth == 0:
                    cut = j
                    break
        params = head[cut + 1:].strip()
        cur['entries'].append({
            'title': head[:cut].strip(),
            'params': params,
            'desc': mm.group('desc').strip(),
            'id': re.search(r'\bid ([A-Za-z0-9_]+)\s*$', params).group(1),
        })
    return sections


def tags_of(desc):
    m = re.search(r'Теги: ([^.]+)\.', desc)
    if not m:
        return []
    return [t.strip() for t in m.group(1).split(',') if t.strip() in TAGS]


def value_of(params):
    m = re.search(r'полезность (\d)/5', params)
    return (int(m.group(1)) - 3) * 1.5 if m else 0


def field(desc, start, stops):
    """Текст после «start» до ближайшего из «stops» (или до конца)."""
    i = desc.find(start)
    if i < 0:
        return ''
    i += len(start)
    end = len(desc)
    for s in stops:
        j = desc.find(s, i)
        if j >= 0:
            end = min(end, j)
    return desc[i:end].strip().rstrip('.')


def main():
    sections = parse(SRC)
    cards = {k: [] for k in SECTION_KIND.values()}
    text = {}
    bio = {'m': [], 'f': []}
    events = []

    for s in sections:
        name = s['name']
        if name.startswith('СОБЫТИЯ'):
            for e in s['entries']:
                d = e['desc']
                stops = ['Население на момент игры:', 'Выживших:', 'В бункере нужно пробыть:', 'Снаружи:',
                         'Главные проблемы:', 'Ценятся:', 'Бесполезны:']
                story = d[:d.find('Население на момент игры:')].strip()
                months = int(re.search(r'В бункере нужно пробыть: (\d+) мес', d).group(1))
                why = re.search(r'В бункере нужно пробыть: \d+ мес\.\s*\(([^)]*)\)', d)
                surv = re.search(r'Выживших: ([\d\s ]+) \(([\d.]+)%\)', d)
                valued = [t.strip() for t in field(d, 'Ценятся:', ['Бесполезны:']).split(',') if t.strip() in TAGS]
                useless = [t.strip() for t in field(d, 'Бесполезны:', []).split(',') if t.strip() in TAGS]
                events.append({
                    'id': e['id'],
                    'title': e['title'],
                    'kind': e['params'].split(',')[0].strip(),
                    'group': event_group(e['params'].split(',')[0], e['id']),
                    'difficulty': int(re.search(r'сложность (\d)/3', e['params']).group(1)),
                    'text': story,
                    'population': field(d, 'Население на момент игры:', stops),
                    'survivors': surv.group(1).strip(),
                    'survivorsPercent': float(surv.group(2)),
                    'months': months,
                    'monthsReason': why.group(1).strip() if why else '',
                    'outside': field(d, 'Снаружи:', stops),
                    'problems': [p.strip() for p in field(d, 'Главные проблемы:', stops).split(';') if p.strip()],
                    'valued': valued,
                    'useless': useless,
                    # Главное для выживания — первые три ценные темы, остальные дают бонус
                    'needs': valued[:3],
                })
            continue

        kind = next(v for k, v in SECTION_KIND.items() if name.startswith(k))
        for e in s['entries']:
            card = {'id': e['id'], 'kind': kind, 'title': e['title'], 'value': value_of(e['params']),
                    'tags': tags_of(e['desc'])}
            if kind == 'special':
                card['value'] = 0
                card['note'] = e['desc']
                if e['title'] in EFFECTS:
                    card['effect'] = EFFECTS[e['title']]
            text[e['id']] = e['desc']
            if kind == 'biology':
                sex = 'm' if 'пол: мужской' in e['params'] else 'f'
                bio[sex].append(card)
            else:
                cards[kind].append(card)

    def js(v):
        if isinstance(v, list):
            return '[\n' + ',\n'.join('  ' + json.dumps(x, ensure_ascii=False) for x in v) + ',\n]'
        return '{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(x, ensure_ascii=False)}' for k, x in v.items()) + ',\n}'

    out = [
        '/* Сгенерировано tools/import_library.py из content/bunker-library.md. Не править вручную. */',
        "import type { Card, Catastrophe } from '../game/types';",
        '',
        f'export const PROFESSIONS: Card[] = {js(cards["profession"])};',
        f'export const BIOLOGY_MALE: Card[] = {js(bio["m"])};',
        f'export const BIOLOGY_FEMALE: Card[] = {js(bio["f"])};',
        f'export const HEALTH: Card[] = {js(cards["health"])};',
        f'export const HOBBIES: Card[] = {js(cards["hobby"])};',
        f'export const PHOBIAS: Card[] = {js(cards["phobia"])};',
        f'export const CHARACTERS: Card[] = {js(cards["character"])};',
        f'export const FACTS: Card[] = {js(cards["fact"])};',
        f'export const BAGGAGE: Card[] = {js(cards["baggage"])};',
        f'export const SPECIALS: Card[] = {js(cards["special"])};',
        f'export const CATASTROPHES: Catastrophe[] = {js(events)};',
        '',
        '/** Группы событий для фильтров, в порядке показа. */',
        f'export const EVENT_GROUP_ORDER: string[] = {js(list(EVENT_GROUPS.keys()))};',
        '',
        '/** Полное описание карты по id — для экрана подробностей. */',
        f'export const CARD_TEXT: Record<string, string> = {js(text)};',
        '',
    ]
    open(OUT, 'w', encoding='utf8').write('\n'.join(out))
    counts = {k: len(v) for k, v in cards.items() if k != 'biology'}
    counts['biology'] = f"{len(bio['m'])} м + {len(bio['f'])} ж"
    groups = {}
    for ev in events:
        groups[ev['group']] = groups.get(ev['group'], 0) + 1
    print('Группы событий:', groups)
    print('Карты:', counts, '| события:', len(events), '| файл:', os.path.getsize(OUT) // 1024, 'КБ')


main()
