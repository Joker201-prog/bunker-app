import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CARD_TEXT, KIND_LABEL, KIND_ORDER } from '../data/cards';
import type { CardKind, Player, RevealEntry } from '../game/types';
import { colors, fonts, hashIndex, images, spacing, tilt } from '../theme';
import { Paper, Stamp } from './Desk';

interface Props {
  player: Player;
  /** Номер игрока в партии, начиная с 1. */
  number: number;
  /** Показывать скрытые карты (своя рука). */
  showAll?: boolean;
  /** Помечать скрытые карты своей руки и ставить штамп «Секретно». */
  secretHint?: boolean;
  revealable?: CardKind[];
  onReveal?: (kind: CardKind) => void;
  /** Игрок выбран для голосования: штамп «Против». */
  marked?: boolean;
  onPress?: () => void;
  /** Журнал раскрытий партии: рядом с картой видно, в каком раунде её открыли. */
  revealLog?: RevealEntry[];
  /** Сейчас ход этого игрока раскрывать карту. */
  isTurn?: boolean;
  /** Личная заметка о игроке (видна только на этом телефоне). Без onNote заметок нет. */
  note?: string;
  onNote?: (text: string) => void;
}

function photoFor(p: Player) {
  const set = p.photo && p.photo[0] === 'f' ? images.photos.f : images.photos.m;
  const idx = Number(p.photo ? p.photo.slice(1) : hashIndex(p.id, set.length)) || 0;
  return set[idx % set.length];
}

/** Полное описание карты из библиотеки. */
function showDetails(kind: CardKind, title: string, id: string | undefined) {
  const text = id ? CARD_TEXT[id] : undefined;
  if (!text) return;
  Alert.alert(`${KIND_LABEL[kind]}: ${title}`, text);
}

/** Ширина «вымаранной» строки: своя для каждой карты, чтобы не выглядело как шаблон. */
function redactionWidth(key: string): number {
  return 70 + hashIndex(key, 90);
}

export function Dossier({
  player,
  number,
  showAll,
  secretHint,
  revealable = [],
  onReveal,
  marked,
  onPress,
  revealLog,
  isTurn,
  note,
  onNote,
}: Props) {
  const Wrapper: any = onPress ? Pressable : View;
  const out = !player.alive;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const openedIn: Partial<Record<CardKind, RevealEntry>> = {};
  for (const r of revealLog ?? []) if (r.playerId === player.id) openedIn[r.kind] = r;

  function saveNote() {
    setEditing(false);
    onNote?.(draft.trim());
  }

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!marked } : undefined}
      style={styles.wrap}
    >
      <Paper rotate={tilt(player.id)} style={out ? styles.outPaper : undefined}>
        <View style={styles.head}>
          <View style={styles.photoFrame}>
            <Image source={photoFor(player)} style={styles.photo} />
          </View>
          <View style={styles.headText}>
            <Text style={styles.number}>Игрок {number}</Text>
            <Text style={styles.name} numberOfLines={1}>
              ({player.name}){player.isHuman && secretHint ? ' — вы' : ''}
            </Text>
            {isTurn && !out && <Text style={styles.turn}>Сейчас раскрывает карту</Text>}
            {secretHint && player.alive && (
              <Stamp label="Секретно" size={15} rotate="-6deg" style={styles.headStamp} />
            )}
          </View>
        </View>

        <View style={styles.fields}>
          {KIND_ORDER.map((kind) => {
            const card = player.cards[kind];
            const open = player.revealed[kind];
            const visible = open || showAll;
            const canReveal = revealable.includes(kind);
            const hasDetails = visible && !!card.id && !!CARD_TEXT[card.id];
            // Нажатие: раскрыть карту (если можно) или прочитать описание.
            // Когда всё досье нажимается (голосование), описание открывается долгим нажатием.
            const tapDetails = hasDetails && !canReveal && !onPress;
            const Line: any = canReveal || hasDetails ? Pressable : View;
            return (
              <Line
                key={kind}
                onPress={
                  canReveal
                    ? () => onReveal && onReveal(kind)
                    : tapDetails
                      ? () => showDetails(kind, card.title, card.id)
                      : undefined
                }
                onLongPress={hasDetails ? () => showDetails(kind, card.title, card.id) : undefined}
                accessibilityRole={canReveal || tapDetails ? 'button' : undefined}
                accessibilityLabel={canReveal ? `Раскрыть: ${KIND_LABEL[kind]}` : undefined}
                accessibilityHint={hasDetails ? 'Открывает полное описание карты' : undefined}
                style={[styles.line, canReveal && styles.lineAction]}
              >
                <Text style={[styles.mark, { color: card.value > 0 ? colors.good : colors.bad }]}>
                  {visible && card.value > 0 ? '✓' : visible && card.value < 0 ? '✗' : ' '}
                </Text>
                <View style={styles.lineBody}>
                  <Text style={styles.label}>{KIND_LABEL[kind]}:</Text>
                  {visible ? (
                    <Text style={[styles.value, !open && styles.valueHidden]}>
                      {card.title}
                      {!open && secretHint ? '  (скрыто)' : ''}
                      {open && openedIn[kind] ? (
                        <Text style={styles.round}>
                          {'  '}раунд {openedIn[kind]!.round}
                          {openedIn[kind]!.auto ? ', авто' : ''}
                        </Text>
                      ) : null}
                    </Text>
                  ) : (
                    <View style={[styles.redaction, { width: redactionWidth(player.id + kind) }]} />
                  )}
                  {visible && card.note ? <Text style={styles.note}>{card.note}</Text> : null}
                </View>
                {canReveal && <Text style={styles.reveal}>Раскрыть</Text>}
              </Line>
            );
          })}
        </View>

        {onNote && (
          <View style={styles.noteBox}>
            {editing ? (
              <View>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ваши мысли об этом игроке — их видите только вы"
                  placeholderTextColor={colors.inkSoft}
                  style={styles.noteInput}
                  multiline
                  maxLength={300}
                  autoFocus
                  onBlur={saveNote}
                />
                <Pressable onPress={saveNote} hitSlop={8} accessibilityRole="button" style={styles.noteDone}>
                  <Text style={styles.noteAction}>Готово</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setDraft(note ?? '');
                  setEditing(true);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={note ? 'Изменить заметку' : 'Добавить заметку'}
              >
                {note ? (
                  <Text style={styles.noteText}>
                    <Text style={styles.noteLabel}>Заметка: </Text>
                    {note}
                  </Text>
                ) : (
                  <Text style={styles.noteAction}>✎ Добавить заметку</Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      </Paper>

      {/* Скрепка поверх листа */}
      <View pointerEvents="none" style={styles.clipWrap}>
        <Image source={images.paperclip} style={styles.clip} />
      </View>

      {out && <Stamp label="Выбыл" size={40} rotate="-14deg" style={styles.bigStamp} />}
      {marked && !out && <Stamp label="Против" size={34} rotate="10deg" style={styles.markStamp} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: spacing.lg },
  outPaper: { opacity: 0.92 },
  head: { flexDirection: 'row', gap: spacing.md },
  photoFrame: {
    backgroundColor: '#f1ece0',
    padding: 5,
    paddingBottom: 12,
    transform: [{ rotate: '-3deg' }],
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  photo: { width: 84, height: 101 },
  headText: { flex: 1, paddingTop: 2 },
  number: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  name: { fontFamily: fonts.type, fontSize: 15, color: colors.ink },
  headStamp: { marginTop: spacing.sm },
  turn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.paper,
    backgroundColor: colors.stampBlue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  round: { fontFamily: fonts.type, fontSize: 11, color: colors.inkSoft },
  noteBox: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.paperLine, paddingTop: spacing.sm },
  noteLabel: { fontFamily: fonts.bold, color: colors.stampBlue },
  noteText: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.stampBlue },
  noteAction: { fontFamily: fonts.type, fontSize: 14, color: colors.stampBlue, textDecorationLine: 'underline' },
  noteInput: {
    fontFamily: fonts.type,
    fontSize: 14,
    lineHeight: 20,
    color: colors.stampBlue,
    borderBottomWidth: 1,
    borderBottomColor: colors.stampBlue,
    minHeight: 44,
    paddingVertical: 4,
    textAlignVertical: 'top',
  },
  noteDone: { alignSelf: 'flex-end', marginTop: spacing.xs },

  fields: { marginTop: spacing.md },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperLine,
  },
  lineAction: { backgroundColor: 'rgba(168, 40, 31, 0.07)' },
  mark: { width: 16, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  lineBody: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 },
  label: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  value: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.ink, flexShrink: 1 },
  valueHidden: { color: colors.inkSoft },
  note: { width: '100%', fontFamily: fonts.type, fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  redaction: { height: 14, backgroundColor: colors.redaction, marginTop: 3, transform: [{ skewX: '-6deg' }] },
  reveal: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.stamp,
    borderWidth: 2,
    borderColor: colors.stamp,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  clipWrap: { position: 'absolute', top: -16, left: 26, zIndex: 10, elevation: 12 },
  clip: { width: 22, height: 60 },
  bigStamp: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    zIndex: 11,
    elevation: 13,
    backgroundColor: 'rgba(226, 211, 178, 0.35)',
  },
  markStamp: { position: 'absolute', top: 30, right: 14, zIndex: 11, elevation: 13 },
});
