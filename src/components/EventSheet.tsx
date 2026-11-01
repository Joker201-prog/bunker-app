import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TAG_LABEL } from '../data/cards';
import type { GameState } from '../game/types';
import { colors, fonts, spacing } from '../theme';
import { Paper } from './Desk';

/** Лист «Событие: катастрофа» — как приколотая к делу сводка. */
export function EventSheet({
  state,
  expanded,
  onToggle,
}: {
  state: GameState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = state.catastrophe;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }}>
      <Paper rotate="0.8deg">
        <View style={styles.headRow}>
          <View style={styles.box}>
            <Text style={styles.boxText}>Событие:</Text>
            <Text style={styles.boxText}>катастрофа</Text>
          </View>
          <Text style={styles.toggle}>{expanded ? 'Свернуть' : 'Подробнее'}</Text>
        </View>
        <Text style={styles.title}>{c.title}</Text>
        {expanded && (
          <View>
            <Text style={styles.text}>{c.text}</Text>
            <Text style={styles.text}>Ждать снаружи — около {state.catastropheYears} лет.</Text>
            <Text style={styles.text}>Нужно выбрать, кто войдёт в убежище.</Text>

            <Text style={styles.sub}>Что понадобится:</Text>
            <Text style={styles.text}>{c.needs.map((n) => TAG_LABEL[n]).join(', ')}.</Text>

            <Text style={styles.sub}>Что есть в бункере:</Text>
            {state.bunker.map((b) => (
              <Text key={b.title} style={styles.text}>
                <Text style={{ color: b.bonus >= 0 ? colors.good : colors.bad }}>{b.bonus >= 0 ? '+ ' : '− '}</Text>
                {b.title}. {b.text}
              </Text>
            ))}
          </View>
        )}
      </Paper>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  box: {
    borderWidth: 3,
    borderColor: colors.stamp,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-2deg' }],
    alignItems: 'center',
  },
  boxText: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: colors.stamp,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  toggle: { fontFamily: fonts.type, fontSize: 13, color: colors.inkSoft, textDecorationLine: 'underline' },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  text: { fontFamily: fonts.type, fontSize: 14, lineHeight: 21, color: colors.ink, marginTop: spacing.xs },
  sub: { fontFamily: fonts.type, fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginTop: spacing.md },
});
