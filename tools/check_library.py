"""Проверка библиотеки игры на повторы и ошибки. Ничего не меняет, только читает.
Запуск: python3 tools/check_library.py <файл библиотеки>"""
import re, sys, collections, json

path = sys.argv[1]
lines = open(path, encoding='utf8').read().split('\n')

TAGS = {'medicine','engineering','food','defense','radiation','chemistry','biology','energy','water',
        'psychology','communication','construction','transport','leadership','science','craft'}
ENTRY = re.compile(r'^(?P<title>[^()\n]+?) \((?P<params>.*?)\): (?P<desc>.+)$')

sections = []  # (name, declared_count, [entries])
cur = None
problems = []
warnings = []
for i, line in enumerate(lines, 1):
    m = re.match(r'^## (\d+)\. (.+?) \((\d+)\)\s*$', line)
    if m:
        cur = {'name': m.group(2), 'declared': int(m.group(3)), 'entries': [], 'line': i}
        sections.append(cur)
        continue
    if not line.strip() or line.startswith('#') or cur is None or line.startswith('Формат:'):
        continue
    # Параметры могут содержать вложенные скобки, поэтому ищем «): » после последнего «id …»
    mm = re.match(r'^(?P<head>.+\bid [A-Za-z0-9_]+)\): (?P<desc>.+)$', line)
    if not mm or ' (' not in mm.group('head'):
        problems.append(f'стр. {i}: не разобрать запись: {line[:120]}')
        continue
    head = mm.group('head')
    # Скобки бывают и в названии («Туберкулёз (закрытая форма)»), и внутри параметров
    # («чайлдфри (не хочет детей)»), поэтому начало параметров ищем по парным скобкам с конца.
    depth, cut = 1, -1
    for j in range(len(head) - 1, -1, -1):
        if head[j] == ')':
            depth += 1
        elif head[j] == '(':
            depth -= 1
            if depth == 0:
                cut = j
                break
    if cut <= 0:
        problems.append(f'стр. {i}: не найти начало параметров: {line[:120]}')
        continue
    e = {'title': head[:cut].strip(), 'params': head[cut + 1:].strip(), 'desc': mm.group('desc').strip()}
    e['line'] = i
    idm = re.search(r'\bid ([A-Za-z0-9_]+)\s*$', e['params'])
    e['id'] = idm.group(1) if idm else None
    cur['entries'].append(e)

def norm(s):
    s = s.lower().replace('ё', 'е')
    s = re.sub(r'[«»"“”„()\-–—.,:;!?]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

# 1. Количество
for s in sections:
    if len(s['entries']) != s['declared']:
        problems.append(f'раздел «{s["name"]}»: заявлено {s["declared"]}, найдено {len(s["entries"])}')

all_entries = [(s['name'], e) for s in sections for e in s['entries']]

# 2. Повторы id
ids = collections.Counter(e['id'] for _, e in all_entries)
for k, n in ids.items():
    if k is None:
        problems.append(f'записей без id: {n}')
    elif n > 1:
        problems.append(f'id повторяется {n} раза: {k}')

# 3. Повторы названий внутри раздела и между разделами
for s in sections:
    c = collections.defaultdict(list)
    for e in s['entries']:
        c[norm(e['title'])].append(e['line'])
    for t, ls in c.items():
        if len(ls) > 1:
            problems.append(f'«{s["name"]}»: повтор названия «{t}» в строках {ls}')
by_title = collections.defaultdict(list)
for sec, e in all_entries:
    by_title[norm(e['title'])].append((sec, e['line']))
for t, occ in by_title.items():
    secs = {x[0] for x in occ}
    if len(secs) > 1:
        warnings.append(f'одно название в разных разделах «{t}»: {occ}')

# 4. Повторы описаний (точные и почти точные по первым 80 символам)
by_desc = collections.defaultdict(list)
for sec, e in all_entries:
    by_desc[norm(e['desc'])[:80]].append((sec, e['line'], e['title']))
for d, occ in by_desc.items():
    if len(occ) > 1:
        problems.append(f'похожие описания: {occ}')

# 5. Полезность, теги, обязательные поля
for sec, e in all_entries:
    p, d = e['params'], e['desc']
    if not sec.startswith('СОБЫТИЯ'):
        um = re.search(r'полезность (\d+)/5', p)
        sm = re.search(r'сила (\d+)/5', p)
        if sec.startswith('ОСОБЫЕ'):
            if not sm or not 1 <= int(sm.group(1)) <= 5:
                problems.append(f'стр. {e["line"]}: нет «сила N/5» ({e["title"]})')
        elif not um or not 1 <= int(um.group(1)) <= 5:
            problems.append(f'стр. {e["line"]}: нет «полезность N/5» ({e["title"]})')
    tm = re.search(r'Теги: ([^.]+)\.', d)
    if tm:
        for t in [x.strip() for x in tm.group(1).split(',')]:
            if t and t not in TAGS and t != '—':
                problems.append(f'стр. {e["line"]}: неизвестный тег «{t}» ({e["title"]})')
    if d.endswith((',', ' и', ' в', ':')):
        problems.append(f'стр. {e["line"]}: описание обрывается ({e["title"]})')

# 6. События: числа и доля выживших
for s in sections:
    if not s['name'].startswith('СОБЫТИЯ'):
        continue
    for e in s['entries']:
        d = e['desc']
        pop = re.search(r'Население на момент игры: ([\d\s ]+)\.', d)
        surv = re.search(r'Выживших: ([\d\s ]+) \(([\d.]+)%\)', d)
        months = re.search(r'В бункере нужно пробыть: (\d+) мес', d)
        for name, v in (('население', pop), ('выжившие', surv), ('срок', months)):
            if not v:
                problems.append(f'событие стр. {e["line"]} «{e["title"]}»: нет поля «{name}»')
        if pop and surv:
            P = int(re.sub(r'\D', '', pop.group(1)))
            S = int(re.sub(r'\D', '', surv.group(1)))
            pct = float(surv.group(2))
            if P == 0 or abs(S / P * 100 - pct) > 0.06:
                problems.append(f'событие «{e["title"]}»: {S}/{P} = {S / P * 100:.2f}%, а написано {pct}%')
            if S > P:
                problems.append(f'событие «{e["title"]}»: выживших больше населения')
        for key in ('Ценятся:', 'Снаружи:', 'Главные проблемы:'):
            if key not in d:
                problems.append(f'событие «{e["title"]}»: нет «{key}»')
        cm = re.search(r'сложность (\d)/3', e['params'])
        if not cm:
            problems.append(f'событие «{e["title"]}»: нет сложности')
        vm = re.search(r'Ценятся: ([^.]+)\.', d)
        if vm:
            for t in [x.strip() for x in vm.group(1).split(',')]:
                if t not in TAGS:
                    problems.append(f'событие «{e["title"]}»: неизвестный тег «{t}» в «Ценятся»')

# 7. Биология: пол и возраст в параметрах
for s in sections:
    if not s['name'].startswith('БИОЛОГИЯ'):
        continue
    for e in s['entries']:
        g = re.search(r'пол: (мужской|женский)', e['params'])
        a = re.search(r'возраст (\d+)', e['params'])
        if not g or not a:
            problems.append(f'биология стр. {e["line"]}: нет пола/возраста')
            continue
        tg = 'Мужчина' if g.group(1) == 'мужской' else 'Женщина'
        if not e['title'].startswith(tg):
            problems.append(f'биология стр. {e["line"]}: в названии «{e["title"][:20]}», а пол {g.group(1)}')
        if a.group(1) not in e['title']:
            problems.append(f'биология стр. {e["line"]}: возраст {a.group(1)} не совпадает с названием')

# Сводка
print('Разделы:')
for s in sections:
    print(f'  {s["name"]}: {len(s["entries"])} из {s["declared"]}')
print(f'\nОшибок и повторов: {len(problems)}')
for p in problems[:60]:
    print('  -', p)
print(f'\nЗамечаний (не ошибки): {len(warnings)}')
for w in warnings[:30]:
    print('  -', w)
json.dump([{'section': s['name'], 'entries': s['entries']} for s in sections],
          open('/tmp/claude-0/-home-claude/e505f1d3-beda-5480-9895-94d60af7e754/scratchpad/library.json', 'w', encoding='utf8'),
          ensure_ascii=False)
