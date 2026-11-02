/**
 * «Информация»: вся библиотека карт и событий с поиском. Открывается из меню перед игрой.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BAGGAGE,
  BIOLOGY_FEMALE,
  BIOLOGY_MALE,
  CARD_TEXT,
  CATASTROPHES,
  CHARACTERS,
  EVENT_GROUP_ORDER,
  FACTS,
  HEALTH,
  HOBBIES,
  PHOBIAS,
  PROFESSIONS,
  SPECIALS,
  TAG_LABEL,
} from '../data/cards';
import { monthsText } from '../game/engine';
import type { Card, Catastrophe, Tag } from '../game/types';
import { colors, fonts, spacing } from '../theme';

type SectionKey =
  | 'events'
  | 'profession'
  | 'biology'
  | 'health'
  | 'phobia'
  | 'character'
  | 'hobby'
  | 'fact'
  | 'baggage'
  | 'special';

const SECTIONS: { key: SectionKey; label: string; cards?: readonly Card[] }[] = [
  { key: 'events', label: 'События' },
  { key: 'profession', label: 'Профессии', cards: PROFESSIONS },
  { key: 'biology', label: 'Биология', cards: [...BIOLOGY_FEMALE, ...BIOLOGY_MALE] },
  { key: 'health', label: 'Здоровье', cards: HEALTH },
  { key: 'phobia', label: 'Фобии', cards: PHOBIAS },
  { key: 'character', label: 'Характер', cards: CHARACTERS },
  { key: 'hobby', label: 'Хобби', cards: HOBBIES },
  { key: 'fact', label: 'Факты', cards: FACTS },
  { key: 'baggage', label: 'Багаж', cards: BAGGAGE },
  { key: 'special', label: 'Особые условия', cards: SPECIALS },
];

/** Подписи внутри описаний карт в библиотеке — по ним текст делится на абзацы. */
const LABELS = ['Что это', 'Аргумент в споре', 'В бункере', 'Нужно для работы', 'Идея способности', 'Снимается', 'Лечится/компенсируется', 'Теги'];
const LABEL_RE = new RegExp(`(${LABELS.map((l) => l.replace('/', '\\/')).join('|')}):`, 'g');

interface Part {
  label: string | null;
  text: string;
}

function splitDescription(desc: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  let label: string | null = null;
  for (const m of desc.matchAll(LABEL_RE)) {
    const chunk = desc.slice(last, m.index).trim();
    if (chunk) parts.push({ label, text: chunk });
    label = m[1];
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = desc.slice(last).trim();
  if (tail) parts.push({ label, text: tail });
  return parts
    .filter((p) => p.label !== 'Теги' && !/^[—-]\.?$/.test(p.text))
    .map((p) => (p.label === 'Снимается' ? { ...p, text: translateTags(p.text) } : p));
}

/** «psychology, medicine.» → «психология, медицина.» */
function translateTags(text: string): string {
  return text.replace(/\b[a-z]+\b/g, (w) => (w in TAG_LABEL ? TAG_LABEL[w as Tag] : w));
}

function usefulness(card: Card): number {
  return Math.round(card.value / 1.5 + 3);
}

function tagsText(tags: Tag[]): string {
  return tags.map((t) => TAG_LABEL[t]).join(', ');
}

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е');
}

export function InfoScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<SectionKey>('events');
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const current = SECTIONS.find((s) => s.key === section)!;
  const q = norm(query.trim());

  const events = useMemo(
    () =>
      CATASTROPHES.filter(
        (e) => (!group || e.group === group) && (!q || norm(e.title).includes(q) || norm(e.text).includes(q)),
      ),
    [group, q],
  );
  const cards = useMemo(
    () => (current.cards ?? []).filter((c) => !q || norm(c.title).includes(q)),
    [current, q],
  );

  function choose(key: SectionKey) {
    setSection(key);
    setOpen(null);
    setGroup(null);
  }

  const header = (
    <View>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>← Назад</Text>
      </Pressable>
      <Text style={styles.heading}>Информация</Text>
      <Text style={styles.lead}>Все карты и события игры. Нажмите на карточку, чтобы прочитать её полностью.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SECTIONS.map((s) => (
          <Chip
            key={s.key}
            label={`${s.label} · ${s.key === 'events' ? CATASTROPHES.length : s.cards!.length}`}
            on={section === s.key}
            onPress={() => choose(s.key)}
          />
        ))}
      </ScrollView>

      {section === 'events' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Все" on={!group} onPress={() => setGroup(null)} small />
          {EVENT_GROUP_ORDER.map((g) => (
            <Chip
              key={g}
              label={`${g} · ${CATASTROPHES.filter((e) => e.group === g).length}`}
              on={group === g}
              onPress={() => setGroup(group === g ? null : g)}
              small
            />
          ))}
        </ScrollView>
      )}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={section === 'events' ? 'Поиск по событиям' : `Поиск: ${current.label.toLowerCase()}`}
        placeholderTextColor={colors.onWoodMuted}
        style={styles.search}
        autoCorrect={false}
      />
      <Text style={styles.count}>
        Найдено: {section === 'events' ? events.length : cards.length}
      </Text>
    </View>
  );

  const empty = <Text style={styles.empty}>Ничего не найдено. Попробуйте другое слово.</Text>;

  if (section === 'events') {
    return (
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <EventItem event={item} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />
        )}
      />
    );
  }

  return (
    <FlatList
      data={cards}
      keyExtractor={(c) => c.id ?? c.title}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      renderItem={({ item }) => (
        <CardItem
          card={item}
          section={section}
          open={open === item.id}
          onToggle={() => setOpen(open === item.id ? null : item.id ?? null)}
        />
      )}
    />
  );
}

function Chip({ label, on, onPress, small }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, small && styles.chipSmall, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, small && styles.chipTextSmall, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function CardItem({
  card,
  section,
  open,
  onToggle,
}: {
  card: Card;
  section: SectionKey;
  open: boolean;
  onToggle: () => void;
}) {
  const desc = (card.id && CARD_TEXT[card.id]) || card.note || '';
  const parts = useMemo(() => (open || section === 'phobia' ? splitDescription(desc) : []), [open, section, desc]);
  const isSpecial = section === 'special';
  const u = usefulness(card);

  // У фобий в названии уже есть пояснение: «Арахнофобия — боязнь пауков»
  const dash = section === 'phobia' ? card.title.indexOf(' — ') : -1;
  const title = dash > 0 ? card.title.slice(0, dash) : card.title;
  const explain = dash > 0 ? card.title.slice(dash + 3) : null;
  const argument = section === 'phobia' ? parts.find((p) => p.label === 'Аргумент в споре')?.text : null;

  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.item}>
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle}>{title}</Text>
        {!isSpecial && (
          <Text
            style={[styles.useful, { color: u >= 4 ? colors.good : u <= 2 ? colors.bad : colors.inkSoft }]}
            accessibilityLabel={`Полезность ${u} из 5`}
          >
            {u}/5
          </Text>
        )}
      </View>
      {explain && <Text style={styles.explain}>{explain}</Text>}
      {card.tags.length > 0 && <Text style={styles.meta}>{tagsText(card.tags)}</Text>}
      {argument && !open && (
        <Text style={styles.argument}>
          <Text style={styles.partLabel}>Аргумент в споре: </Text>
          {argument}
        </Text>
      )}
      {isSpecial && !open && (
        <Text style={styles.preview} numberOfLines={2}>
          {desc}
        </Text>
      )}
      {open &&
        parts.map((p, i) => (
          <Text key={i} style={[styles.part, p.label === 'Аргумент в споре' && styles.argument]}>
            {p.label && <Text style={styles.partLabel}>{p.label}: </Text>}
            {p.text}
          </Text>
        ))}
    </Pressable>
  );
}

function EventItem({ event, open, onToggle }: { event: Catastrophe; open: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.item}>
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle}>{event.title}</Text>
        <Text style={styles.difficulty} accessibilityLabel={`Сложность ${event.difficulty} из 3`}>
          {'●'.repeat(event.difficulty)}
          <Text style={styles.difficultyOff}>{'●'.repeat(3 - event.difficulty)}</Text>
        </Text>
      </View>
      <Text style={styles.meta}>
        {event.group} · в бункере {monthsText(event.months)} · выжило {String(event.survivorsPercent).replace('.', ',')}%
      </Text>
      <Text style={styles.meta}>Без чего не выжить: {tagsText(event.needs)}</Text>
      {open && (
        <View>
          <Text style={styles.part}>{event.text}</Text>
          <Text style={styles.part}>
            <Text style={styles.partLabel}>Население: </Text>было {event.population}, выжило {event.survivors}.
          </Text>
          <Text style={styles.part}>
            <Text style={styles.partLabel}>Срок: </Text>
            {monthsText(event.months)}.{event.monthsReason ? ` ${event.monthsReason}` : ''}
          </Text>
          <Text style={styles.part}>
            <Text style={styles.partLabel}>Снаружи: </Text>
            {event.outside}.
          </Text>
          <Text style={styles.part}>
            <Text style={styles.partLabel}>Главные проблемы: </Text>
            {event.problems.join('; ')}.
          </Text>
          {event.valued.length > event.needs.length && (
            <Text style={styles.part}>
              <Text style={styles.partLabel}>Тоже пригодится: </Text>
              {tagsText(event.valued.filter((t) => !event.needs.includes(t)))}.
            </Text>
          )}
          {event.useless.length > 0 && (
            <Text style={styles.part}>
              <Text style={styles.partLabel}>Бесполезно: </Text>
              {tagsText(event.useless)}.
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg },
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.onWoodMuted },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.onWood,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  lead: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.onWood, marginTop: spacing.xs, marginBottom: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    borderWidth: 2,
    borderColor: 'rgba(234, 220, 191, 0.5)',
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5 },
  chipOn: { backgroundColor: colors.paper, borderColor: colors.paper },
  chipText: { fontFamily: fonts.displayMed, fontSize: 14, letterSpacing: 0.5, color: colors.onWood },
  chipTextSmall: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 0 },
  chipTextOn: { color: colors.ink },
  search: {
    marginTop: spacing.sm,
    fontFamily: fonts.type,
    fontSize: 15,
    color: colors.onWood,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.onWoodMuted,
    paddingVertical: 8,
  },
  count: { fontFamily: fonts.type, fontSize: 12, color: colors.onWoodMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.type, fontSize: 15, color: colors.onWood, marginTop: spacing.lg, textAlign: 'center' },
  item: {
    backgroundColor: colors.paper,
    borderRadius: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.ink },
  useful: { fontFamily: fonts.type, fontSize: 14 },
  difficulty: { fontSize: 12, color: colors.stamp, letterSpacing: 1 },
  difficultyOff: { color: colors.paperLine },
  explain: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 2 },
  meta: { fontFamily: fonts.type, fontSize: 12, lineHeight: 17, color: colors.inkSoft, marginTop: 2 },
  preview: { fontFamily: fonts.type, fontSize: 13, lineHeight: 18, color: colors.ink, marginTop: spacing.xs },
  part: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: spacing.sm },
  partLabel: { fontFamily: fonts.bold, color: colors.inkSoft },
  argument: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.stampBlue, marginTop: spacing.sm },
});
