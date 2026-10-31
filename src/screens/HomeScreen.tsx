import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { HazardStripe } from '../components/HazardStripe';
import { MAX_PLAYERS, MIN_PLAYERS, seatsFor } from '../game/engine';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  onStart: (name: string, players: number) => void;
}

const RULES = [
  'Пять раундов. В каждом: раскрыть карту, обсудить, проголосовать.',
  'В первом раунде все показывают профессию, дальше — любую карту на выбор.',
  'Голосуйте против тех, кто меньше всех поможет выжить при этой катастрофе.',
  'В конце станет ясно, переживёт ли катастрофу та группа, что осталась.',
];

export function HomeScreen({ onStart }: Props) {
  const [name, setName] = useState('');
  const [count, setCount] = useState(8);
  const [showRules, setShowRules] = useState(false);
  const seats = seatsFor(count);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <HazardStripe />

      <View style={styles.hero}>
        <Text style={styles.title}>Убежище</Text>
        <Text style={styles.lead}>
          Мест в бункере вдвое меньше, чем людей у двери. Докажите, что вы нужнее остальных.
        </Text>
      </View>

      <Text style={styles.label}>Ваше имя</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Как вас называть"
        placeholderTextColor={colors.neutral}
        style={styles.input}
        maxLength={16}
      />

      <Text style={[styles.label, styles.gap]}>Сколько человек у двери</Text>
      <View style={styles.counter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Меньше игроков"
          onPress={() => setCount((c) => Math.max(MIN_PLAYERS, c - 1))}
          style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <View style={styles.countBox}>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.seats}>
            {seats} {seats === 1 ? 'место' : seats < 5 ? 'места' : 'мест'} внутри
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Больше игроков"
          onPress={() => setCount((c) => Math.min(MAX_PLAYERS, c + 1))}
          style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <Button label="Открыть дверь" onPress={() => onStart(name.trim(), count)} style={styles.start} />
      <Text style={styles.note}>Остальных игроков пока изображают боты.</Text>

      <Pressable onPress={() => setShowRules((v) => !v)} style={styles.rulesToggle}>
        <Text style={styles.rulesToggleText}>{showRules ? 'Скрыть правила' : 'Как играть'}</Text>
      </Pressable>
      {showRules && (
        <View style={styles.rules}>
          {RULES.map((r, i) => (
            <View key={i} style={styles.rule}>
              <Text style={styles.ruleNum}>{i + 1}</Text>
              <Text style={styles.ruleText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: spacing.xxl },
  hero: { marginTop: spacing.xxl, marginBottom: spacing.xxl },
  title: { color: colors.amber, fontFamily: fonts.display, fontSize: 52, lineHeight: 60 },
  lead: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 26,
    marginTop: spacing.md,
    maxWidth: 340,
  },
  label: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, marginBottom: spacing.sm },
  gap: { marginTop: spacing.xl },
  input: {
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: radius.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 18,
    fontFamily: fonts.body,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
  },
  step: { width: 64, height: 72, alignItems: 'center', justifyContent: 'center' },
  stepPressed: { backgroundColor: colors.raised },
  stepText: { color: colors.amber, fontFamily: fonts.bold, fontSize: 28 },
  countBox: { flex: 1, alignItems: 'center' },
  count: { color: colors.text, fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  seats: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  start: { marginTop: spacing.xxl },
  note: {
    color: colors.neutral,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  rulesToggle: { alignSelf: 'flex-start', marginTop: spacing.xl, paddingVertical: spacing.sm },
  rulesToggleText: { color: colors.amber, fontFamily: fonts.bold, fontSize: 15 },
  rules: { marginTop: spacing.sm },
  rule: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  ruleNum: { color: colors.amber, fontFamily: fonts.mono, fontSize: 15, width: 14 },
  ruleText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
});
