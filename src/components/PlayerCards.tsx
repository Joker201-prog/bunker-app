import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KIND_ICON, KIND_LABEL, KIND_ORDER } from '../data/cards';
import type { CardKind, Player } from '../game/types';
import { colors, spacing, valueColor } from '../theme';

interface Props {
  player: Player;
  /** Kinds the viewer may reveal right now (only for the human's own panel). */
  revealable?: CardKind[];
  onReveal?: (kind: CardKind) => void;
  /** Show every card, even hidden ones (the viewer's own hand). */
  showAll?: boolean;
  highlight?: boolean;
  onPress?: () => void;
  footer?: React.ReactNode;
}

export function PlayerCards({
  player,
  revealable = [],
  onReveal,
  showAll,
  highlight,
  onPress,
  footer,
}: Props) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[styles.panel, highlight && styles.highlight, !player.alive && styles.dead]}
    >
      <View style={styles.header}>
        <Text style={styles.name}>
          {player.name}
          {player.isHuman ? ' (вы)' : ''}
        </Text>
        <Text style={[styles.status, { color: player.alive ? colors.good : colors.bad }]}>
          {player.alive ? 'в игре' : 'исключён'}
        </Text>
      </View>
      <View style={styles.grid}>
        {KIND_ORDER.map((kind) => {
          const card = player.cards[kind];
          const open = player.revealed[kind];
          const visible = open || showAll;
          const canReveal = revealable.includes(kind);
          const Chip: any = canReveal ? Pressable : View;
          return (
            <Chip
              key={kind}
              onPress={canReveal ? () => onReveal && onReveal(kind) : undefined}
              style={[
                styles.chip,
                visible && { borderColor: valueColor(card.value) },
                showAll && !open && styles.chipHidden,
                canReveal && styles.chipActive,
              ]}
            >
              <Text style={styles.chipKind}>
                {KIND_ICON[kind]} {KIND_LABEL[kind]}
                {showAll && !open ? ' · скрыто' : ''}
              </Text>
              <Text style={[styles.chipTitle, !visible && styles.chipLocked]}>
                {visible ? card.title : '???'}
              </Text>
              {visible && card.note ? <Text style={styles.chipNote}>{card.note}</Text> : null}
              {canReveal ? <Text style={styles.tapHint}>нажмите, чтобы раскрыть</Text> : null}
            </Chip>
          );
        })}
      </View>
      {footer}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  highlight: { borderColor: colors.accent, borderWidth: 2 },
  dead: { opacity: 0.55 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  status: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.panelAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  chipHidden: { borderStyle: 'dashed', opacity: 0.75 },
  chipActive: { borderColor: colors.accent, borderWidth: 2, opacity: 1 },
  chipKind: { color: colors.muted, fontSize: 11, marginBottom: 2 },
  chipTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipLocked: { color: colors.muted },
  chipNote: { color: colors.muted, fontSize: 11, marginTop: 2 },
  tapHint: { color: colors.accent, fontSize: 11, marginTop: 4 },
});
