/**
 * Шапка партии: «‹» выход, «РАУНД 2 / 5» с полосками раундов, ⓘ «положение дел»;
 * под ней три этапа раунда: 1 СТОЛ · 2 СПОР · 3 ГОЛОС.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Stage } from '../game/types';
import { colors, fonts, images, spacing } from '../theme';
import { DUR, EASE_PAPER, haptic, isReduceMotion } from '../ui/motion';

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'table', label: 'Стол' },
  { stage: 'discussion', label: 'Спор' },
  { stage: 'voting', label: 'Голос' },
];

export function GameHeader({
  round,
  totalRounds,
  stage,
  onExit,
  onInfo,
}: {
  round: number;
  totalRounds: number;
  stage: Stage;
  onExit: () => void;
  onInfo?: () => void;
}) {
  const activeIndex = stage === 'result' ? 3 : STEPS.findIndex((s) => s.stage === stage);
  const flip = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // Смена этапа: плашка переходит, цифра перелистывается как на табло.
  useEffect(() => {
    if (first.current) return;
    haptic('light');
    if (isReduceMotion()) return;
    flip.setValue(0);
    Animated.timing(flip, { toValue: 1, duration: DUR.stage, easing: EASE_PAPER, useNativeDriver: true }).start();
  }, [stage, flip]);

  // Новый раунд: полоска наливается янтарём.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isReduceMotion()) return;
    fill.setValue(0);
    Animated.timing(fill, { toValue: 1, duration: DUR.stage * 2, easing: EASE_PAPER, useNativeDriver: false }).start();
  }, [round, fill]);

  return (
    <View>
      <View style={styles.top}>
        <Pressable onPress={onExit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Выйти из партии" style={styles.iconBtn}>
          <Text style={styles.icon}>‹</Text>
        </Pressable>
        <View style={styles.roundBox} accessibilityLabel={`Раунд ${round} из ${totalRounds}`}>
          <Text style={styles.round}>
            РАУНД {round} <Text style={styles.roundOf}>/ {totalRounds}</Text>
          </Text>
          <View style={styles.bars}>
            {Array.from({ length: totalRounds }, (_, i) => {
              const n = i + 1;
              if (n === round) {
                return (
                  <View key={n} style={[styles.bar, styles.barTodo]}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                      ]}
                    />
                  </View>
                );
              }
              return <View key={n} style={[styles.bar, n < round ? styles.barDone : styles.barTodo]} />;
            })}
          </View>
        </View>
        {onInfo ? (
          <Pressable onPress={onInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel="Положение дел: катастрофа и бункер" style={styles.iconBtn}>
            <View style={styles.infoCircle}>
              <Text style={styles.infoI}>i</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <View style={styles.tabs}>
        {STEPS.map((s, i) => {
          const now = i === activeIndex;
          const done = i < activeIndex;
          if (now) {
            return (
              <Animated.View
                key={s.stage}
                style={[styles.tabWrap, { opacity: flip.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}
              >
                <ImageBackground source={images.paper} resizeMode="repeat" style={[styles.tab, styles.tabNow]}>
                  <Animated.View style={[styles.num, styles.numNow, { transform: [{ scaleY: flip }] }]}>
                    <Text style={styles.numTextNow}>{i + 1}</Text>
                  </Animated.View>
                  <Text style={[styles.tabText, styles.tabTextNow]}>{s.label}</Text>
                </ImageBackground>
              </Animated.View>
            );
          }
          return (
            <View key={s.stage} style={[styles.tabWrap, styles.tab, done && styles.tabDone]}>
              {done ? (
                <Text style={[styles.tabText, styles.tabTextDone]}>✓ {s.label}</Text>
              ) : (
                <>
                  <View style={styles.num}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.tabText}>{s.label}</Text>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontFamily: fonts.body, fontSize: 34, lineHeight: 38, color: colors.onWood },
  infoCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: colors.onWood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoI: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.onWood },
  roundBox: { flex: 1, alignItems: 'center' },
  round: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.onWood },
  roundOf: { fontFamily: fonts.displayMed, color: colors.onWoodMuted },
  bars: { flexDirection: 'row', gap: 5, marginTop: 3 },
  bar: { width: 18, height: 4, overflow: 'hidden' },
  barDone: { backgroundColor: colors.onWood },
  barTodo: { backgroundColor: 'rgba(234, 220, 191, 0.3)' },
  barFill: { height: 4, backgroundColor: colors.amber },
  tabs: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  tabWrap: { flex: 1 },
  tab: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(234, 220, 191, 0.45)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  tabNow: { borderColor: colors.paper },
  tabDone: { borderColor: 'rgba(234, 220, 191, 0.75)' },
  num: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.onWoodSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numNow: { backgroundColor: colors.ink, borderColor: colors.ink },
  numText: { fontFamily: fonts.displayMed, fontSize: 11, lineHeight: 14, color: colors.onWoodSoft },
  numTextNow: { fontFamily: fonts.display, fontSize: 11, lineHeight: 14, color: colors.paper },
  tabText: {
    fontFamily: fonts.displayMed,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.onWoodSoft,
    textTransform: 'uppercase',
  },
  tabTextNow: { fontFamily: fonts.display, color: colors.ink },
  tabTextDone: { color: colors.onWood },
});
