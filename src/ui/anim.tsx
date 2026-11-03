/**
 * Готовые движения для листов и печатей. Всё на встроенном Animated (нативный драйвер),
 * без дополнительных библиотек: анимация только показывает уже пришедшее состояние.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';
import { DUR, EASE_HIT, EASE_PAPER, haptic, isReduceMotion, type HapticKind } from './motion';

/**
 * Лист падает на стол: сверху, крупнее и с поворотом, тень сжимается, ложится под своим наклоном.
 * index — очередь: листы ложатся друг за другом.
 */
export function DropIn({
  children,
  index = 0,
  rotate = '0deg',
  style,
  fast,
}: {
  children?: React.ReactNode;
  index?: number;
  rotate?: string;
  style?: ViewStyle | ViewStyle[];
  /** Ход бота: вдвое быстрее. */
  fast?: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReduceMotion()) {
      Animated.timing(t, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      return;
    }
    const k = fast ? 0.5 : 1;
    Animated.timing(t, {
      toValue: 1,
      duration: DUR.sheet * k,
      delay: Math.min(index, 10) * DUR.sheetGap * k,
      easing: EASE_PAPER,
      useNativeDriver: true,
    }).start();
  }, [t, index, fast]);
  const deg = parseFloat(rotate) || 0;
  const reduce = isReduceMotion();
  return (
    <Animated.View
      style={[
        style as any,
        {
          opacity: t,
          transform: reduce
            ? [{ rotate }]
            : [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: [`${deg - 6}deg`, `${deg}deg`] }) },
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] }) },
              ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Удар печати: налетает крупной и прозрачной, бьёт с перелётом и доворачивается.
 * play=false — печать стоит на месте без анимации (уже стояла раньше).
 */
export function StampHit({
  label,
  color = colors.stampDark,
  size = 19,
  rotate = '-13deg',
  play = true,
  feel,
  style,
  fill,
}: {
  label: string;
  color?: string;
  size?: number;
  rotate?: string;
  play?: boolean;
  feel?: HapticKind;
  style?: ViewStyle;
  /** Полупрозрачная бумажная подложка под надписью. */
  fill?: boolean;
}) {
  const t = useRef(new Animated.Value(play && !isReduceMotion() ? 0 : 1)).current;
  useEffect(() => {
    if (!play || isReduceMotion()) {
      t.setValue(1);
      if (play && feel) haptic(feel);
      return;
    }
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: DUR.stamp, easing: EASE_HIT, useNativeDriver: true }).start();
    const id = setTimeout(() => feel && haptic(feel), DUR.stamp * 0.6);
    return () => clearTimeout(id);
  }, [t, play, feel]);
  const deg = parseFloat(rotate) || 0;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stamp,
        { borderColor: color },
        fill && styles.stampFill,
        style,
        {
          opacity: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0.92] }),
          transform: [
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: [`${deg + 11}deg`, `${deg}deg`] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.stampText, { color, fontSize: size, lineHeight: size * 1.2 }]}>{label}</Text>
    </Animated.View>
  );
}

/** Неровное мигание лампы (рывками). Цикл 2,2 с. */
export function useLampFlicker(active: boolean) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || isReduceMotion()) {
      v.setValue(1);
      return;
    }
    const step = (to: number, ms: number) =>
      Animated.timing(v, { toValue: to, duration: ms, easing: Easing.step0, useNativeDriver: true });
    const loop = Animated.loop(
      Animated.sequence([step(1, 700), step(0.35, 90), step(1, 160), step(0.6, 70), step(1, 1180)]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, active]);
  return v;
}

/** Покачивание бирки на гвоздике: −5° ↔ 5°. */
export function useSwing(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || isReduceMotion()) {
      v.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, active]);
  return v.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] });
}

const styles = StyleSheet.create({
  stamp: {
    alignSelf: 'flex-start',
    borderWidth: 3,
    borderRadius: 2,
    paddingHorizontal: 8,
  },
  stampFill: { backgroundColor: 'rgba(240, 228, 200, 0.7)' },
  stampText: { fontFamily: fonts.display, letterSpacing: 2, textTransform: 'uppercase' },
});
