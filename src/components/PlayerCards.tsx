import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL, KIND_ORDER } from '../data/cards';
import type { CardKind, Player } from '../game/types';
import { colors, fonts, radius, spacing, valueColor } from '../theme';

interface Props {
  player: Player;
  /** Карты, которые можно раскрыть сейчас (только для своей руки). */
  revealable?: CardKind[];
  onReveal?: (kind: CardKind) => void;
  /** Показывать все карты, включая скрытые (своя рука или выбывший игрок). */
  showAll?: boolean;
  highlight?: boolean;
  onPress?: () => void;
  /** Свернуть до шапки: имя и число открытых карт. */
  compact?: boolean;
  /** Показывать только раскрытые карты (чужие досье). */
  onlyOpen?: boolean;
  /** Подписывать скрытые карты своей руки: «видите только вы». */
  secretHint?: boolean;
}

function dossierNumber(id: string): string {
  const n = id === 'human' ? 1 : parseInt(id.replace(/\D/g, ''), 10) + 1;
  return String(n).padStart(2, '0');
}

export function PlayerCards({
  player,
  revealable = [],
  onReveal,
  showAll,
  highlight,
  onPress,
  compact,
  onlyOpen,
  secretHint,
}: Props) {
  const Wrapper: any = onPress ? Pressable : View;
  const openCount = KIND_ORDER.filter((k) => player.revealed[k]).length;
  const kinds = onlyOpen ? KIND_ORDER.filter((k) => player.revealed[k]) : KIND_ORDER;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.panel, highlight && styles.highlight, !player.alive && styles.dead]}
    >
      <View style={styles.header}>
        <Text style={styles.number}>№{dossierNumber(player.id)}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
          {player.isHuman ? ' (вы)' : ''}
        </Text>
        {!player.alive ? (
          <Text style={styles.out}>за дверью</Text>
        ) : (
          <Text style={styles.count}>
            {openCount}/{KIND_ORDER.length}
          </Text>
        )}
      </View>

      {!compact && onlyOpen && kinds.length === 0 && (
        <Text style={styles.empty}>Пока ничего о себе не раскрыл</Text>
      )}
      {!compact && kinds.length > 0 && (
        <View style={styles.grid}>
          {kinds.map((kind) => {
            const card = player.cards[kind];
            const open = player.revealed[kind];
            const visible = open || showAll;
            const canReveal = revealable.includes(kind);
            const Tile: any = canReveal ? Pressable : View;
            return (
              <Tile
                key={kind}
                onPress={canReveal ? () => onReveal && onReveal(kind) : undefined}
                accessibilityRole={canReveal ? 'button' : undefined}
                style={[
                  styles.tile,
                  visible && { borderLeftColor: valueColor(card.value) },
                  !visible && styles.tileClosed,
                  showAll && !open && styles.tileSecret,
                  canReveal && styles.tileAction,
                ]}
              >
                <Text style={styles.kind}>{KIND_LABEL[kind]}</Text>
                <Text style={[styles.title, !visible && styles.titleClosed]}>
                  {visible ? card.title : 'засекречено'}
                </Text>
                {visible && card.note ? <Text style={styles.note}>{card.note}</Text> : null}
                {canReveal ? (
                  <Text style={styles.action}>Раскрыть</Text>
                ) : secretHint && showAll && !open && player.alive ? (
                  <Text style={styles.secretHint}>видите только вы</Text>
                ) : null}
              </Tile>
            );
          })}
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.panel,
  },
  highlight: { borderColor: colors.amber, backgroundColor: colors.amberDeep },
  dead: { opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  number: { color: colors.amber, fontFamily: fonts.mono, fontSize: 13 },
  name: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  count: { color: colors.muted, fontFamily: fonts.mono, fontSize: 13 },
  out: { color: colors.bad, fontFamily: fonts.body, fontSize: 13 },
  empty: { color: colors.neutral, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.raised,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  tileClosed: { backgroundColor: colors.bg },
  tileSecret: { backgroundColor: colors.bg },
  tileAction: { borderWidth: 1, borderColor: colors.amber, borderLeftColor: colors.amber },
  kind: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, marginTop: 2, lineHeight: 19 },
  titleClosed: { color: colors.neutral, fontFamily: fonts.body },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 3, lineHeight: 16 },
  action: { color: colors.amber, fontFamily: fonts.bold, fontSize: 13, marginTop: 6 },
  secretHint: { color: colors.neutral, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
});
