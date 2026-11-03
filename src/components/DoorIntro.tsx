/**
 * Заставка при запуске: штурвал гермодвери проворачивается с отдачей, дверь уходит на петлях,
 * за ней тёплый свет — и открывается главная. Касание пропускает. Один раз за запуск.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg from 'react-native-svg';
import { colors, images } from '../theme';
import { DUR, EASE_HIT, EASE_PAPER, haptic, isReduceMotion } from '../ui/motion';
import { DoorLeaf, PortalLines, SKETCH_H, SKETCH_W, Wheel, WheelCircle } from './DoorSketch';

export function DoorIntro({ onDone }: { onDone: () => void }) {
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW - 32, 420);
  const k = width / SKETCH_W;
  const height = SKETCH_H * k;

  const wheel = useRef(new Animated.Value(0)).current;
  const door = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const done = useRef(false);

  function finish(fast = false) {
    if (done.current) return;
    done.current = true;
    Animated.timing(fade, { toValue: 0, duration: fast ? 150 : 280, useNativeDriver: true }).start(() => onDone());
  }

  useEffect(() => {
    if (isReduceMotion()) {
      onDone();
      return;
    }
    const total = DUR.door;
    Animated.sequence([
      Animated.delay(total * 0.1),
      Animated.timing(wheel, { toValue: 1, duration: total * 0.24, easing: EASE_HIT, useNativeDriver: true }),
      Animated.delay(total * 0.04),
      Animated.timing(door, { toValue: 1, duration: total * 0.36, easing: EASE_PAPER, useNativeDriver: true }),
    ]).start(() => finish());
    const click = setTimeout(() => haptic('light'), total * 0.3);
    return () => clearTimeout(click);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Дверь: круг 72…176 по x; петли слева — вращаем вокруг левого края.
  const leafBox = { x: 66, y: 32, w: 114, h: 112 };
  const leafW = leafBox.w * k;
  const wheelBox = 48;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <Pressable style={styles.center} onPress={() => finish(true)} accessibilityLabel="Пропустить заставку">
        <Animated.Image source={images.wood} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, styles.shade]} />
        <View style={{ width, height }}>
          <Svg width={width} height={height} viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`} style={styles.sheet}>
            <PortalLines />
          </Svg>
          {/* тёплый свет за дверью */}
          <Animated.View
            style={[
              styles.light,
              {
                left: 72 * k,
                top: 36 * k,
                width: 104 * k,
                height: 104 * k,
                borderRadius: 52 * k,
                opacity: door,
              },
            ]}
          />
          <Animated.View
            style={{
              position: 'absolute',
              left: leafBox.x * k,
              top: leafBox.y * k,
              width: leafW,
              height: leafBox.h * k,
              transform: [
                { perspective: 900 },
                { translateX: -leafW / 2 },
                { rotateY: door.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-78deg'] }) },
                { translateX: leafW / 2 },
              ],
            }}
          >
            <Svg
              width={leafW}
              height={leafBox.h * k}
              viewBox={`${leafBox.x} ${leafBox.y} ${leafBox.w} ${leafBox.h}`}
            >
              <DoorLeaf />
              <WheelCircle />
            </Svg>
            <Animated.View
              style={{
                position: 'absolute',
                left: (124 - leafBox.x - wheelBox / 2) * k,
                top: (88 - leafBox.y - wheelBox / 2) * k,
                width: wheelBox * k,
                height: wheelBox * k,
                transform: [{ rotate: wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-160deg'] }) }],
              }}
            >
              <Svg width={wheelBox * k} height={wheelBox * k} viewBox={`${124 - wheelBox / 2} ${88 - wheelBox / 2} ${wheelBox} ${wheelBox}`}>
                <Wheel />
              </Svg>
            </Animated.View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, elevation: 100, backgroundColor: colors.wood },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shade: { backgroundColor: 'rgba(18, 10, 5, 0.5)' },
  sheet: { backgroundColor: '#ebe2cc' },
  light: { position: 'absolute', backgroundColor: '#f2c46b' },
});
