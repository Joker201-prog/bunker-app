/**
 * Движение «как вещи на столе»: бумага падает и ложится, печать бьёт, лампа мигает.
 * Здесь общие длительности, три кривые, вибрация и флаг «Убрать анимацию».
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

export const DUR = {
  press: 120,
  pressUp: 180,
  stamp: 280,
  stage: 300,
  sheet: 350,
  sheetGap: 60,
  card: 500,
  door: 1200,
  vote: 300,
  letter: 40,
  letterMax: 1200,
};

/** «Бумага ложится». */
export const EASE_PAPER = Easing.bezier(0.2, 0.8, 0.2, 1);
/** «Удар» — с перелётом. */
export const EASE_HIT = Easing.bezier(0.34, 1.56, 0.64, 1);
/** «Лампа» — рывками. */
export const EASE_LAMP = Easing.step0;

export type HapticKind = 'light' | 'medium' | 'heavy' | 'double';

/** Вибрация. Ошибки (нет моторчика, веб) молча пропускаются. */
export function haptic(kind: HapticKind) {
  try {
    if (kind === 'double') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 140);
      return;
    }
    const style =
      kind === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : kind === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
    Haptics.impactAsync(style).catch(() => {});
  } catch {
    // вибрация недоступна
  }
}

let reduceMotion = false;
const listeners = new Set<(v: boolean) => void>();

AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v: boolean) => {
    reduceMotion = !!v;
    listeners.forEach((l) => l(reduceMotion));
  })
  .catch(() => {});
try {
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
    reduceMotion = !!v;
    listeners.forEach((l) => l(reduceMotion));
  });
} catch {
  // старые версии без события
}

/** Включено ли в телефоне «Убрать анимацию». */
export function isReduceMotion(): boolean {
  return reduceMotion;
}

export function useReduceMotion(): boolean {
  const [v, setV] = useState(reduceMotion);
  useEffect(() => {
    listeners.add(setV);
    setV(reduceMotion);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

/**
 * Одновременно — одна крупная анимация (дверь, подсчёт голосов, сводка катастрофы).
 * Возвращает false, если сейчас уже идёт другая: тогда показываем сразу итог.
 */
let bigBusyUntil = 0;
export function claimBig(ms: number): boolean {
  const now = Date.now();
  if (now < bigBusyUntil) return false;
  bigBusyUntil = now + ms;
  return true;
}
