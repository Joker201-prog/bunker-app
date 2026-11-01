import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Paper, Stamp, WoodHeading } from '../components/Desk';
import { Dossier } from '../components/Dossier';
import { TAG_LABEL } from '../data/cards';
import type { GameState } from '../game/types';
import { colors, fonts, spacing } from '../theme';

interface Props {
  state: GameState;
  viewerId: string;
  /** Кнопки под отчётом: «Сыграть ещё раз», «Вернуть всех в лобби» и т. п. */
  actions: React.ReactNode;
}

const VERDICT = {
  thrive: { word: 'Выжили и процветают', color: colors.stampBlue },
  survive: { word: 'Выжили', color: colors.stampBlue },
  fall: { word: 'Бункер пал', color: colors.stamp },
};

export function FinalScreen({ state, viewerId, actions }: Props) {
  const insets = useSafeAreaInsets();
  const report = state.final;
  if (!report) return null;
  const survivors = state.players.filter((p) => report.survivors.includes(p.id));
  const me = state.players.find((p) => p.id === viewerId);
  const humanIn = !!me && report.survivors.includes(me.id);
  const v = VERDICT[report.verdict];
  const numberOf = (id: string) => state.players.findIndex((p) => p.id === id) + 1;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Text style={styles.title}>Итоговый отчёт</Text>

      <Paper rotate="-0.6deg" style={styles.report}>
        <Text style={styles.label}>Катастрофа:</Text>
        <Text style={styles.catTitle}>{state.catastrophe.title}</Text>
        <Stamp label={v.word} color={v.color} size={30} rotate="-7deg" style={styles.verdict} />
        <Text style={styles.text}>{report.headline}</Text>
        <Text style={[styles.text, styles.personal]}>
          {!me
            ? 'Вы вели эту партию.'
            : humanIn
              ? 'Вы были внутри и пережили катастрофу вместе с группой.'
              : 'Вы остались за дверью.'}
        </Text>

        <Text style={styles.label}>Что требовала катастрофа:</Text>
        {state.catastrophe.needs.map((n) => {
          const ok = report.covered.includes(n);
          return (
            <View key={n} style={styles.needRow}>
              <Text style={[styles.needMark, { color: ok ? colors.good : colors.bad }]}>{ok ? '✓' : '✗'}</Text>
              <Text style={styles.needText}>{TAG_LABEL[n]}</Text>
              <Text style={[styles.needState, { color: ok ? colors.good : colors.bad }]}>
                {ok ? 'было' : 'не было'}
              </Text>
            </View>
          );
        })}

        <Text style={[styles.label, styles.gapTop]}>Как это было:</Text>
        {report.lines.map((line, i) => (
          <Text key={i} style={styles.text}>
            — {line}
          </Text>
        ))}
        <Text style={[styles.label, styles.gapTop]}>
          Очки группы: {report.score}. Для выживания нужно от {Math.round(report.base * 0.8)}.
        </Text>
      </Paper>

      <WoodHeading>Кто был внутри</WoodHeading>
      {survivors.map((p) => (
        <Dossier key={p.id} player={p} number={numberOf(p.id)} showAll />
      ))}

      <View style={styles.restart}>{actions}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 2,
    color: colors.onWood,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  report: { marginBottom: spacing.md },
  label: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  catTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, letterSpacing: 0.5 },
  verdict: { marginVertical: spacing.lg, alignSelf: 'center' },
  text: { fontFamily: fonts.type, fontSize: 15, lineHeight: 22, color: colors.ink, marginBottom: spacing.xs },
  personal: { color: colors.inkSoft, marginBottom: spacing.lg },
  gapTop: { marginTop: spacing.lg },
  needRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperLine,
  },
  needMark: { width: 16, fontFamily: fonts.bold, fontSize: 16 },
  needText: { flex: 1, fontFamily: fonts.type, fontSize: 15, color: colors.ink },
  needState: { fontFamily: fonts.type, fontSize: 14 },
  restart: { marginTop: spacing.lg, gap: spacing.md },
});
