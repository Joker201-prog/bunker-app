import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && (primary ? styles.primaryPressed : styles.secondaryPressed),
        style,
      ]}
    >
      <Text style={[styles.label, primary && styles.labelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.amber },
  primaryPressed: { backgroundColor: '#d38d26' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  secondaryPressed: { backgroundColor: colors.raised },
  disabled: { opacity: 0.35 },
  label: { color: colors.text, fontSize: 17, fontFamily: fonts.bold },
  labelPrimary: { color: colors.onAmber },
});
