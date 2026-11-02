import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TAG_LABEL } from '../data/cards';
import { monthsText } from '../game/engine';
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
        <Text style={styles.meta}>
          {c.kind}, сложность {c.difficulty} из 3 · в бункере {monthsText(c.months)}
        </Text>
        {expanded && (
          <View>
            <Text style={styles.text}>{c.text}</Text>

            <Text style={styles.sub}>Население:</Text>
            <Text style={styles.text}>
              было {c.population}, выжило {c.survivors} ({String(c.survivorsPercent).replace('.', ',')}%).
            </Text>

            <Text style={styles.sub}>Сколько сидеть в бункере:</Text>
            <Text style={styles.text}>
              {monthsText(c.months)}.{c.monthsReason ? ` ${c.monthsReason}` : ''}
            </Text>

            <Text style={styles.sub}>Снаружи:</Text>
            <Text style={styles.text}>{c.outside}.</Text>

            <Text style={styles.sub}>Главные проблемы:</Text>
            {c.problems.map((p) => (
              <Text key={p} style={styles.text}>
                — {p}
              </Text>
            ))}

            <Text style={styles.sub}>Без чего не выжить:</Text>
            <Text style={styles.strong}>{c.needs.map((n) => TAG_LABEL[n]).join(', ')}.</Text>
            {c.valued.length > c.needs.length && (
              <>
                <Text style={styles.sub}>Тоже пригодится:</Text>
                <Text style={styles.text}>
                  {c.valued.filter((t) => !c.needs.includes(t)).map((n) => TAG_LABEL[n]).join(', ')}.
                </Text>
              </>
            )}
            {c.useless.length > 0 && (
              <>
                <Text style={styles.sub}>Здесь бесполезно:</Text>
                <Text style={styles.text}>{c.useless.map((n) => TAG_LABEL[n]).join(', ')}.</Text>
              </>
            )}

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
  meta: { fontFamily: fonts.type, fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: 2 },
  strong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.stamp, marginTop: spacing.xs },
});
