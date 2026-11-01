import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, fonts, images, spacing } from '../theme';

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
 */
export function DeskButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.btnPrimary : styles.btnSecondary,
        pressed && !disabled && styles.btnPressed,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {primary ? (
        <ImageBackground source={images.paper} resizeMode="repeat" style={styles.btnFill} imageStyle={styles.btnImage}>
          <Text style={[styles.btnText, styles.btnTextPrimary]}>{label}</Text>
        </ImageBackground>
      ) : (
        <View style={styles.btnFill}>
          <Text style={styles.btnText}>{label}</Text>
        </View>
      )}
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

  btn: { minHeight: 52, borderRadius: 3, overflow: 'hidden' },
  btnPrimary: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    backgroundColor: colors.paper,
  },
  btnSecondary: { borderWidth: 2, borderColor: colors.onWood },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.4 },
  btnFill: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnImage: { borderRadius: 3 },
  btnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1.5,
    color: colors.onWood,
    textTransform: 'uppercase',
  },
  btnTextPrimary: { color: colors.ink },

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
