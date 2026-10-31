import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Stage } from '../game/types';
import { colors, fonts, spacing } from '../theme';

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'table', label: 'Стол' },
  { stage: 'discussion', label: 'Обсуждение' },
  { stage: 'voting', label: 'Голосование' },
];

/** Раунды точками и три этапа раунда — реальная последовательность, поэтому с номерами. */
export function StageBar({
  round,
  totalRounds,
  stage,
}: {
  round: number;
  totalRounds: number;
  stage: Stage;
}) {
  const activeIndex = stage === 'result' ? 3 : STEPS.findIndex((s) => s.stage === stage);
  return (
    <View>
      <View style={styles.rounds}>
        <Text style={styles.roundLabel}>Раунд {round}</Text>
        <View style={styles.pips}>
          {Array.from({ length: totalRounds }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                i < round - 1 && styles.pipDone,
                i === round - 1 && styles.pipNow,
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.steps}>
        {STEPS.map((s, i) => {
          const done = i < activeIndex;
          const now = i === activeIndex;
          return (
            <View key={s.stage} style={[styles.step, now && styles.stepNow]}>
              <Text style={[styles.stepText, (now || done) && styles.stepTextOn]}>
                {i + 1}. {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rounds: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundLabel: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  pips: { flexDirection: 'row', gap: 6 },
  pip: { width: 18, height: 6, borderRadius: 1, backgroundColor: colors.line },
  pipDone: { backgroundColor: colors.muted },
  pipNow: { backgroundColor: colors.amber },
  steps: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs },
  step: {
    flex: 1,
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
  },
  stepNow: { borderBottomColor: colors.amber },
  stepText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  stepTextOn: { color: colors.text },
});
