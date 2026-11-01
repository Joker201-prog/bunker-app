import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Stage } from '../game/types';
import { colors, fonts, images, spacing } from '../theme';

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'table', label: 'Стол' },
  { stage: 'discussion', label: 'Обсуждение' },
  { stage: 'voting', label: 'Голосование' },
];

/** Шапка партии: название, кнопка выхода, номер раунда и три этапа раунда. */
export function GameHeader({
  round,
  totalRounds,
  stage,
  onExit,
}: {
  round: number;
  totalRounds: number;
  stage: Stage;
  onExit: () => void;
}) {
  const activeIndex = stage === 'result' ? 3 : STEPS.findIndex((s) => s.stage === stage);
  return (
    <View>
      <View style={styles.top}>
        <Pressable onPress={onExit} hitSlop={12} accessibilityRole="button" style={styles.side}>
          <Text style={styles.exit}>Выйти</Text>
        </Pressable>
        <Text style={styles.title}>«Убежище»</Text>
        <View style={[styles.side, styles.roundBox]} accessibilityLabel={`Раунд ${round} из ${totalRounds}`}>
          <View style={styles.roundCircle}>
            <Text style={styles.roundNum}>{round}</Text>
          </View>
          <Text style={styles.roundLabel}>
            Раунд {round}/{totalRounds}
          </Text>
        </View>
      </View>
      <View style={styles.tabs}>
        {STEPS.map((s, i) => {
          const now = i === activeIndex;
          const done = i < activeIndex;
          return now ? (
            <ImageBackground
              key={s.stage}
              source={images.paper}
              resizeMode="repeat"
              style={[styles.tab, styles.tabNow]}
            >
              <Text style={[styles.tabText, styles.tabTextNow]} numberOfLines={1} adjustsFontSizeToFit>
                {s.label}
              </Text>
            </ImageBackground>
          ) : (
            <View key={s.stage} style={[styles.tab, done && styles.tabDone]}>
              <Text style={[styles.tabText, done && styles.tabTextDone]} numberOfLines={1} adjustsFontSizeToFit>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  side: { width: 74 },
  exit: { fontFamily: fonts.body, fontSize: 14, color: colors.onWoodMuted },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 2,
    color: colors.onWood,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  roundBox: { alignItems: 'center' },
  roundCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.onWood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundNum: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.onWood },
  roundLabel: {
    fontFamily: fonts.displayMed,
    fontSize: 11,
    color: colors.onWood,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tab: {
    flex: 1,
    height: 38,
    borderWidth: 2,
    borderColor: 'rgba(234, 220, 191, 0.45)',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  tabNow: { borderColor: colors.onWood },
  tabDone: { borderColor: 'rgba(234, 220, 191, 0.7)' },
  tabText: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    color: 'rgba(234, 220, 191, 0.55)',
    textTransform: 'uppercase',
  },
  tabTextNow: { color: colors.ink },
  tabTextDone: { color: colors.onWood },
});
