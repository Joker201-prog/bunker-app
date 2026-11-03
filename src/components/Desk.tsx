import React, { useRef } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, fonts, images, spacing } from '../theme';
import { DUR, haptic } from '../ui/motion';

/** Лист бумаги с тенью. Наклон задаётся через rotate. */
export function Paper({
  children,
  style,
  rotate,
  padded = true,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  rotate?: string;
  padded?: boolean;
}) {
  return (
    <View style={[styles.paperShadow, rotate ? { transform: [{ rotate }] } : null, style as any]}>
      <ImageBackground
        source={images.paper}
        resizeMode="repeat"
        style={[styles.paper, padded && styles.paperPad]}
        imageStyle={styles.paperImage}
      >
        {children}
      </ImageBackground>
    </View>
  );
}

/** Печать: рамка и текст одного цвета, слегка повёрнута. */
export function Stamp({
  label,
  color = colors.stamp,
  size = 18,
  rotate = '-8deg',
  style,
}: {
  label: string;
  color?: string;
  size?: number;
  rotate?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      pointerEvents="none"
      style={[styles.stamp, { borderColor: color, transform: [{ rotate }] }, style]}
    >
      <Text style={[styles.stampText, { color, fontSize: size, lineHeight: size * 1.2 }]}>{label}</Text>
    </View>
  );
}

/** Кусок изоленты с надписью. */
export function Tape({
  label,
  size = 24,
  rotate = '-1.5deg',
  style,
}: {
  label: string;
  size?: number;
  rotate?: string;
  style?: ViewStyle;
}) {
  return (
    <ImageBackground
      source={images.tape}
      resizeMode="stretch"
      style={[styles.tape, { transform: [{ rotate }] }, style]}
    >
      <Text style={[styles.tapeText, { fontSize: size }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </ImageBackground>
  );
}

/**
 * Кнопки как на столе: основная — бумажная плашка, вторичная — рамка по дереву.
 * При нажатии бумага опускается на 3 px и пружинит обратно, рамка заливается бумагой.
 */
export function DeskButton({
  label,
  sub,
  onPress,
  variant = 'primary',
  disabled,
  style,
  arrow,
  size,
}: {
  label: string;
  /** Мелкая подпись под текстом кнопки. */
  sub?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  /** Красная стрелка справа (главная кнопка экрана). */
  arrow?: boolean;
  size?: number;
}) {
  const primary = variant === 'primary';
  const press = useRef(new Animated.Value(0)).current;
  const to = (v: number, ms: number) =>
    Animated.timing(press, { toValue: v, duration: ms, useNativeDriver: false }).start();
  const text = (
    <View style={[styles.btnInner, (arrow || sub) && styles.btnInnerRow]}>
      <View style={(arrow || sub) && styles.btnTextCol}>
        <Text
          style={[styles.btnText, primary && styles.btnTextPrimary, size ? { fontSize: size } : null, (arrow || sub) && styles.btnTextLeft]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
        {sub ? <Text style={[styles.btnSub, !primary && styles.btnSubWood]}>{sub}</Text> : null}
      </View>
      {arrow ? <Text style={styles.btnArrow}>→</Text> : null}
    </View>
  );
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      onPressIn={() => to(1, DUR.press)}
      onPressOut={() => to(0, DUR.pressUp)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[disabled && styles.btnDisabled, style as any]}
    >
      <Animated.View
        style={[
          styles.btn,
          primary ? styles.btnPrimary : styles.btnSecondary,
          {
            transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }],
          },
          primary && {
            shadowOpacity: press.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.15] }),
            elevation: press.interpolate({ inputRange: [0, 1], outputRange: [6, 1] }),
          },
        ]}
      >
        {primary ? (
          <ImageBackground source={images.paper} resizeMode="repeat" style={styles.btnFill} imageStyle={styles.btnImage}>
            {text}
          </ImageBackground>
        ) : (
          <View style={styles.btnFill}>
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.btnFlash, { opacity: press.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}
            />
            {text}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Подзаголовок прямо на дереве. */
export function WoodHeading({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.woodHeading, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  paperShadow: {
    backgroundColor: colors.paper,
    borderRadius: 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  paper: { borderRadius: 2, overflow: 'hidden' },
  paperPad: { padding: spacing.lg },
  paperImage: { borderRadius: 2 },

  stamp: {
    alignSelf: 'flex-start',
    borderWidth: 3,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    opacity: 0.88,
  },
  stampText: { fontFamily: fonts.display, letterSpacing: 1.5, textTransform: 'uppercase' },

  tape: {
    alignSelf: 'center',
    minWidth: 220,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapeText: {
    fontFamily: fonts.display,
    color: colors.tapeInk,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  btn: { minHeight: 54, borderRadius: 3, overflow: 'hidden' },
  btnPrimary: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    backgroundColor: colors.paper,
  },
  btnSecondary: { borderWidth: 2, borderColor: colors.onWood, backgroundColor: 'rgba(20, 12, 6, 0.35)' },
  btnFlash: { backgroundColor: colors.paper },
  btnDisabled: { opacity: 0.4 },
  btnFill: { flexGrow: 1, minHeight: 54, justifyContent: 'center', paddingHorizontal: 16 },
  btnInner: { alignItems: 'center', justifyContent: 'center' },
  btnInnerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  btnTextCol: { flex: 1 },
  btnImage: { borderRadius: 3 },
  btnText: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 1.4,
    color: colors.onWood,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  btnTextLeft: { textAlign: 'left', fontSize: 20, letterSpacing: 1.5 },
  btnTextPrimary: { color: colors.ink },
  btnSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  btnSubWood: { color: colors.onWoodSoft },
  btnArrow: { fontFamily: fonts.display, fontSize: 24, color: colors.stamp, marginLeft: spacing.md },

  woodHeading: {
    fontFamily: fonts.display,
    color: colors.onWood,
    fontSize: 20,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
