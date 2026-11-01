import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL, KIND_ORDER } from '../data/cards';
import type { CardKind, Player } from '../game/types';
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
}

function photoFor(p: Player) {
  const male = p.cards.biology.title.startsWith('Мужчина');
  const set = male ? images.photos.m : images.photos.f;
  return set[hashIndex(p.id + p.name, set.length)];
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
}: Props) {
  const Wrapper: any = onPress ? Pressable : View;
  const out = !player.alive;

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
              ({player.name}){player.isHuman ? ' — вы' : ''}
            </Text>
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
            const Line: any = canReveal ? Pressable : View;
            return (
              <Line
                key={kind}
                onPress={canReveal ? () => onReveal && onReveal(kind) : undefined}
                accessibilityRole={canReveal ? 'button' : undefined}
                accessibilityLabel={canReveal ? `Раскрыть: ${KIND_LABEL[kind]}` : undefined}
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
  photo: { width: 78, height: 94 },
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
