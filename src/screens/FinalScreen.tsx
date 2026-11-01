import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { HazardStripe } from '../components/HazardStripe';
import { PlayerCards } from '../components/PlayerCards';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAG_LABEL } from '../data/cards';
import type { GameState } from '../game/types';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  state: GameState;
  onRestart: () => void;
}

const VERDICT = {
  thrive: { word: 'Выжили и процветают', color: colors.good },
  survive: { word: 'Выжили', color: colors.amber },
  fall: { word: 'Бункер пал', color: colors.bad },
};

export function FinalScreen({ state, onRestart }: Props) {
  const insets = useSafeAreaInsets();
  const report = state.final;
  if (!report) return null;
  const survivors = state.players.filter((p) => report.survivors.includes(p.id));
  const human = state.players.find((p) => p.isHuman);
  const humanIn = !!human && report.survivors.includes(human.id);
  const v = VERDICT[report.verdict];

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <HazardStripe />
      <Text style={styles.kicker}>{state.catastrophe.title}</Text>
      <Text style={[styles.verdict, { color: v.color }]}>{v.word}</Text>
      <Text style={styles.headline}>{report.headline}</Text>
      <Text style={styles.personal}>
        {humanIn ? 'Вы были внутри и пережили катастрофу вместе с группой.' : 'Вы остались за дверью.'}
      </Text>

      <View style={styles.panel}>
        <Text style={styles.subhead}>Что требовала катастрофа</Text>
        {state.catastrophe.needs.map((n) => {
          const ok = report.covered.includes(n);
          return (
            <View key={n} style={styles.needRow}>
              <View style={[styles.mark, { backgroundColor: ok ? colors.good : colors.bad }]} />
              <Text style={styles.needText}>{TAG_LABEL[n]}</Text>
              <Text style={[styles.needState, { color: ok ? colors.good : colors.bad }]}>
                {ok ? 'было' : 'не было'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.panel}>
        <Text style={styles.subhead}>Как это было</Text>
        {report.lines.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}
        <Text style={styles.score}>
          Очки группы: {report.score}. Для выживания нужно от {Math.round(report.base * 0.8)}.
        </Text>
      </View>

      <Text style={styles.section}>Кто был внутри</Text>
      {survivors.map((p) => (
        <PlayerCards key={p.id} player={p} showAll />
      ))}

      <Button label="Сыграть ещё раз" onPress={onRestart} style={styles.restart} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.xxl },
  kicker: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, marginTop: spacing.xxl },
  verdict: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, marginTop: spacing.xs },
  headline: { color: colors.text, fontFamily: fonts.body, fontSize: 18, lineHeight: 26, marginTop: spacing.md },
  personal: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.xl },
  panel: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  subhead: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13, marginBottom: spacing.sm },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  mark: { width: 8, height: 8, borderRadius: 1 },
  needText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  needState: { fontFamily: fonts.bold, fontSize: 14 },
  line: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  score: { color: colors.muted, fontFamily: fonts.mono, fontSize: 13, marginTop: spacing.xs },
  section: { color: colors.text, fontFamily: fonts.display, fontSize: 18, marginTop: spacing.lg, marginBottom: spacing.sm },
  restart: { marginTop: spacing.lg },
});
