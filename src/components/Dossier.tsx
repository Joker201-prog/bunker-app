/**
 * Полное досье игрока (дизайн v2): фото-«полароид», номер, 9 строк карт,
 * кнопка-штамп «РАСКРЫТЬ», бирки «раунд N», заметка карандашом.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CARD_TEXT, KIND_LABEL, KIND_ORDER } from '../data/cards';
import type { CardKind, Player, RevealEntry } from '../game/types';
import { colors, fonts, images, spacing } from '../theme';
import { DropIn, StampHit } from '../ui/anim';
import { DUR, EASE_PAPER, haptic, isReduceMotion } from '../ui/motion';
import { Paper } from './Desk';
import { photoFor } from './TableParts';

interface Props {
  player: Player;
  /** Номер игрока в партии, начиная с 1. */
  number: number;
  /** Своё досье: видны и закрытые карты, стоит штамп «Секретно». */
  mine?: boolean;
  /** Показать все карты (итоговый отчёт). */
  showAll?: boolean;
  revealable?: CardKind[];
  onReveal?: (kind: CardKind) => void;
  /** Журнал раскрытий партии: у открытой карты — бирка «раунд N». */
  revealLog?: RevealEntry[];
  /** Личная заметка (видна только на этом телефоне). Без onNote заметок нет. */
  note?: string;
  onNote?: (text: string) => void;
}

/** Полное описание карты из библиотеки. */
function showDetails(kind: CardKind, title: string, id: string | undefined) {
  const text = id ? CARD_TEXT[id] : undefined;
  if (!text) return;
  Alert.alert(`${KIND_LABEL[kind]}: ${title}`, text);
}

export function Dossier({ player, number, mine, showAll, revealable = [], onReveal, revealLog, note, onNote }: Props) {
  const out = !player.alive;
  const openCount = KIND_ORDER.filter((k) => player.revealed[k]).length;
  const openedIn: Partial<Record<CardKind, RevealEntry>> = {};
  for (const r of revealLog ?? []) if (r.playerId === player.id) openedIn[r.kind] = r;

  return (
    <DropIn rotate="-0.5deg" style={styles.wrap}>
      <Paper padded={false}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.photoFrame}>
              <Image source={photoFor(player)} style={[styles.photo, out && styles.photoOut]} />
            </View>
            <View style={styles.headText}>
              <Text style={styles.number}>ИГРОК № {number}</Text>
              <Text style={styles.name} numberOfLines={1}>
                ({player.name})
              </Text>
              <Text style={styles.count}>открыто {openCount} из 9</Text>
              {mine && !out && <StampHit label="Секретно" color={colors.stamp} size={14} rotate="-5deg" style={styles.secret} />}
            </View>
          </View>

          <View style={styles.rows}>
            {KIND_ORDER.map((kind) => (
              <CardRow
                key={kind}
                kind={kind}
                player={player}
                mine={!!mine || !!showAll}
                canReveal={revealable.includes(kind)}
                onReveal={onReveal}
                entry={openedIn[kind]}
              />
            ))}
          </View>

          {onNote && <NoteLine note={note} onNote={onNote} />}
        </View>
      </Paper>

      <View pointerEvents="none" style={styles.clipWrap}>
        <Image source={images.paperclip} style={styles.clip} />
      </View>
      {out && <StampHit label="Выбыл" size={40} rotate="-14deg" style={styles.outStamp} fill play={false} />}
    </DropIn>
  );
}

function CardRow({
  kind,
  player,
  mine,
  canReveal,
  onReveal,
  entry,
}: {
  kind: CardKind;
  player: Player;
  mine: boolean;
  canReveal: boolean;
  onReveal?: (kind: CardKind) => void;
  entry?: RevealEntry;
}) {
  const card = player.cards[kind];
  const open = player.revealed[kind];
  const visible = open || mine || !player.alive;
  const hasDetails = visible && !!card.id && !!CARD_TEXT[card.id];

  // Раскрытие: плашка цензуры стирается слева направо, дописывается ✓/✗, появляется бирка.
  const wipe = useRef(new Animated.Value(1)).current;
  const wasOpen = useRef(open);
  const [playing, setPlaying] = useState(false);
  const justOpened = open && !wasOpen.current;
  if (justOpened && !isReduceMotion()) wipe.setValue(0);
  const fresh = (justOpened || playing) && !isReduceMotion();
  useEffect(() => {
    const opened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opened) return;
    haptic('light');
    if (isReduceMotion()) return;
    setPlaying(true);
    const k = player.isHuman ? 1 : 0.5; // ходы ботов — вдвое быстрее
    Animated.timing(wipe, { toValue: 1, duration: DUR.card * k, easing: EASE_PAPER, useNativeDriver: true }).start(() =>
      setPlaying(false),
    );
  }, [open, wipe, player.isHuman]);

  const mark = visible && card.value > 0 ? '✓' : visible && card.value < 0 ? '✗' : '';
  const Line: any = hasDetails ? Pressable : View;
  return (
    <Line
      onPress={hasDetails ? () => showDetails(kind, card.title, card.id) : undefined}
      accessibilityRole={hasDetails ? 'button' : undefined}
      accessibilityHint={hasDetails ? 'Открывает полное описание карты' : undefined}
      style={styles.row}
    >
      <Animated.Text
        style={[
          styles.mark,
          { color: card.value > 0 ? colors.good : colors.bad },
          open && fresh ? { opacity: wipe.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] }) } : null,
        ]}
      >
        {mark}
      </Animated.Text>
      <View style={styles.rowBody}>
        <Text style={styles.kind}>{KIND_LABEL[kind].toUpperCase()}</Text>
        {visible ? (
          <View>
            <Text style={[styles.value, !open && styles.valueHidden]}>{card.title}</Text>
            {visible && card.note ? <Text style={styles.cardNote}>{card.note}</Text> : null}
            {open && fresh && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.wipe,
                  {
                    transformOrigin: 'right',
                    transform: [{ scaleX: wipe.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }],
                  } as any,
                ]}
              />
            )}
          </View>
        ) : (
          <View style={[styles.redaction, { width: 70 + ((kind.length * 37 + player.id.length * 11) % 90) }]} />
        )}
      </View>
      {open && entry ? (
        <Animated.Text
          style={[
            styles.roundChip,
            fresh
              ? {
                  opacity: wipe.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }),
                  transform: [{ translateY: wipe.interpolate({ inputRange: [0, 0.8, 1], outputRange: [4, 4, 0] }) }],
                }
              : null,
          ]}
        >
          раунд {entry.round}
          {entry.auto ? ', авто' : ''}
        </Animated.Text>
      ) : null}
      {canReveal && onReveal ? (
        <Pressable
          onPress={() => onReveal(kind)}
          accessibilityRole="button"
          accessibilityLabel={`Раскрыть: ${KIND_LABEL[kind]}`}
          hitSlop={6}
          style={({ pressed }) => [styles.revealBtn, pressed && styles.revealPressed]}
        >
          <Text style={styles.revealText}>РАСКРЫТЬ</Text>
        </Pressable>
      ) : null}
    </Line>
  );
}

/** Заметка карандашом: сохранённая «пишется» слева направо, за текстом едет карандаш. */
function NoteLine({ note, onNote }: { note?: string; onNote: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const [width, setWidth] = useState(0);
  const write = useRef(new Animated.Value(1)).current;
  const justSaved = useRef(false);

  useEffect(() => {
    if (!justSaved.current || !note || !width) return;
    justSaved.current = false;
    if (isReduceMotion()) return;
    write.setValue(0);
    Animated.timing(write, {
      toValue: 1,
      duration: Math.min(DUR.letterMax, note.length * DUR.letter),
      useNativeDriver: false,
    }).start();
  }, [note, width, write]);

  function save() {
    setEditing(false);
    const text = draft.trim();
    if (text && text !== note) justSaved.current = true;
    onNote(text);
  }

  if (editing) {
    return (
      <View style={styles.noteBox}>
        <Text style={styles.pencil}>✎</Text>
        <View style={styles.flex}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ваши мысли об этом игроке — их видите только вы"
            placeholderTextColor={colors.paperLine}
            style={styles.noteInput}
            multiline
            maxLength={300}
            autoFocus
            onBlur={save}
          />
          <Pressable onPress={save} hitSlop={8} accessibilityRole="button" style={styles.noteDone}>
            <Text style={styles.noteAction}>Готово</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        setDraft(note ?? '');
        setEditing(true);
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={note ? `Заметка: ${note}. Изменить` : 'Добавить заметку'}
      style={styles.noteBox}
    >
      <Text style={styles.pencil}>✎</Text>
      {note ? (
        <View style={styles.flex} onLayout={(e: any) => setWidth(e.nativeEvent.layout.width)}>
          <Animated.View
            style={{
              overflow: 'hidden',
              width: width ? write.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) : undefined,
            }}
          >
            <Text style={[styles.noteText, width ? { width } : null]}>{note}</Text>
          </Animated.View>
        </View>
      ) : (
        <Text style={styles.noteAdd}>Добавить заметку</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { marginTop: 22, marginBottom: spacing.lg },
  sheet: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 },
  head: { flexDirection: 'row', gap: 12 },
  photoFrame: {
    backgroundColor: colors.paperWhite,
    padding: 5,
    paddingBottom: 14,
    transform: [{ rotate: '-3deg' }],
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
  },
  photo: { width: 68, height: 80 },
  photoOut: { filter: [{ grayscale: 1 }] } as any,
  headText: { flex: 1 },
  number: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: 1, color: colors.ink },
  name: { fontFamily: fonts.type, fontSize: 15, color: colors.ink },
  count: { marginTop: 6, fontFamily: fonts.type, fontSize: 12, color: colors.inkSoft },
  secret: { marginTop: 6 },

  rows: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperLine,
  },
  mark: { width: 16, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15 },
  rowBody: { flex: 1, minWidth: 0, paddingVertical: 3 },
  kind: { fontFamily: fonts.type, fontSize: 11, letterSpacing: 0.5, color: colors.inkSoft },
  value: { fontFamily: fonts.body, fontSize: 15, lineHeight: 19, color: colors.ink },
  valueHidden: { color: colors.inkSoft },
  cardNote: { fontFamily: fonts.type, fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  wipe: { position: 'absolute', left: 0, right: 0, top: 1, height: 17, backgroundColor: colors.redaction },
  redaction: { height: 14, marginTop: 3, backgroundColor: colors.redaction, transform: [{ skewX: '-6deg' }] },
  roundChip: {
    fontFamily: fonts.type,
    fontSize: 11,
    color: colors.inkSoft,
    borderWidth: 1,
    borderColor: '#8f7f62',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  revealBtn: {
    minHeight: 34,
    paddingHorizontal: 9,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.stamp,
    borderRadius: 2,
  },
  revealPressed: { backgroundColor: 'rgba(168, 40, 31, 0.12)', transform: [{ translateY: 2 }] },
  revealText: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.2, color: colors.stamp },

  noteBox: { marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'flex-start', minHeight: 40 },
  pencil: { fontSize: 18, lineHeight: 26, color: colors.stampBlue },
  noteText: { fontFamily: fonts.hand, fontSize: 21, lineHeight: 23, color: colors.stampBlue },
  noteAdd: { fontFamily: fonts.hand, fontSize: 20, lineHeight: 26, color: colors.stampBlue, opacity: 0.75 },
  noteInput: {
    fontFamily: fonts.hand,
    fontSize: 21,
    lineHeight: 24,
    color: colors.stampBlue,
    borderBottomWidth: 1,
    borderBottomColor: colors.stampBlue,
    minHeight: 44,
    paddingVertical: 2,
    textAlignVertical: 'top',
  },
  noteDone: { alignSelf: 'flex-end', marginTop: spacing.xs, minHeight: 32, justifyContent: 'center' },
  noteAction: { fontFamily: fonts.type, fontSize: 14, color: colors.stampBlue, textDecorationLine: 'underline' },

  clipWrap: { position: 'absolute', top: -18, left: 30, zIndex: 10, elevation: 12 },
  clip: { width: 22, height: 60 },
  outStamp: { position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 11, elevation: 13 },
});
