import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Полоса «опасность»: единственный декоративный элемент интерфейса. */
export function HazardStripe({ height = 8 }: { height?: number }) {
  return (
    <View style={[styles.wrap, { height }]}>
      {Array.from({ length: 48 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height, backgroundColor: i % 2 === 0 ? colors.amber : colors.bg },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', flexDirection: 'row', marginLeft: -12 },
  bar: { width: 14, transform: [{ skewX: '-40deg' }] },
});
