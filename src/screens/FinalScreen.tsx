import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { PlayerCards } from '../components/PlayerCards';
import { TAG_LABEL } from '../data/cards';
import type { GameState } from '../game/types';
import { colors, spacing } from '../theme';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export function FinalScreen({ state, onRestart }: Props) {
  const report = state.final;
  if (!report) return null;
  const survivors = state.players.filter((p) => report.survivors.includes(p.id));
  const human = state.players.find((p) => p.isHuman);
  const humanIn = !!human && report.survivors.includes(human.id);
  const color =
    report.verdict === 'thrive' ? colors.good : report.verdict === 'survive' ? colors.accent : colors.bad;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.verdict, { color }]}>
        {report.verdict === 'thrive' ? 'Победа' : report.verdict === 'survive' ? 'Выжили' : 'Поражение'}
      </Text>
      <Text style={styles.headline}>{report.headline}</Text>
      <Text style={styles.personal}>
        {humanIn ? 'Вы остались в бункере и пережили катастрофу вместе с группой.' : 'Вы не попали в бункер.'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Катастрофа: {state.catastrophe.title}</Text>
        <Text style={styles.text}>Нужно было закрыть темы:</Text>
        {state.catastrophe.needs.map((n) => (
          <Text
            key={n}
            style={[styles.need, { color: report.covered.includes(n) ? colors.good : colors.bad }]}
          >
            {report.covered.includes(n) ? '✔' : '✖'} {TAG_LABEL[n]}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Что произошло</Text>
        {report.lines.map((line, i) => (
          <Text key={i} style={styles.text}>
            • {line}
          </Text>
        ))}
        <Text style={styles.score}>
          Очки группы: {report.score} (ориентир для выживания: {Math.round(report.base * 0.8)}+)
        </Text>
      </View>

      <Text style={styles.section}>Выжившие</Text>
      {survivors.map((p) => (
        <PlayerCards key={p.id} player={p} showAll />
      ))}

      <Button label="Сыграть снова" onPress={onRestart} style={{ marginVertical: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 48 },
  verdict: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  headline: {
    color: colors.text,
    fontSize: 17,
    textAlign: 'center',
    marginVertical: spacing.md,
    lineHeight: 24,
  },
  personal: { color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTitle: { color: colors.accent, fontWeight: '700', fontSize: 16, marginBottom: spacing.sm },
  text: { color: colors.text, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  need: { fontSize: 15, marginTop: 2 },
  score: { color: colors.muted, marginTop: spacing.sm, fontSize: 13 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginVertical: spacing.md },
});
