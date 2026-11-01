import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeskButton, Paper, Stamp, Tape } from '../components/Desk';
import { MAX_PLAYERS, MIN_PLAYERS, seatsFor } from '../game/engine';
import { colors, fonts, spacing } from '../theme';

interface Props {
  onStart: (name: string, players: number) => void;
}

const RULES = [
  'Пять раундов. В каждом: раскрыть карту, обсудить, проголосовать.',
  'В первом раунде все показывают профессию, дальше — любую карту на выбор.',
  'Голосуйте против тех, кто меньше всех поможет выжить при этой катастрофе.',
  'В конце станет ясно, переживёт ли катастрофу та группа, что осталась.',
];

function seatsWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'место';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'места';
  return 'мест';
}

export function HomeScreen({ onStart }: Props) {
  const [name, setName] = useState('');
  const [count, setCount] = useState(8);
  const [showRules, setShowRules] = useState(false);
  const seats = seatsFor(count);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>«Убежище»</Text>
      <Text style={styles.lead}>
        Мест в бункере вдвое меньше, чем людей у двери. Докажите, что вы нужнее остальных.
      </Text>

      <Paper rotate="-1deg" style={styles.form}>
        <Stamp label="Заявка на место" size={17} rotate="-4deg" />
        <Text style={[styles.label, styles.gapTop]}>Фамилия, имя:</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="как вас называть"
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          maxLength={16}
        />
        <Text style={[styles.label, styles.gapTop]}>Мест в убежище:</Text>
        <Text style={styles.value}>
          {seats} {seatsWord(seats)} на {count} человек
        </Text>
      </Paper>

      <View style={styles.counter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Меньше игроков"
          onPress={() => setCount((c) => Math.max(MIN_PLAYERS, c - 1))}
          style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Tape label={`Участники: ${count}`} size={28} style={styles.tape} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Больше игроков"
          onPress={() => setCount((c) => Math.min(MAX_PLAYERS, c + 1))}
          style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <DeskButton label="Открыть дверь" onPress={() => onStart(name.trim(), count)} style={styles.start} />
      <Text style={styles.note}>Остальных игроков пока изображают боты.</Text>

      <DeskButton
        label={showRules ? 'Скрыть правила' : 'Как играть'}
        variant="secondary"
        onPress={() => setShowRules((v) => !v)}
        style={styles.rulesBtn}
      />
      {showRules && (
        <Paper rotate="0.6deg" style={styles.rules}>
          {RULES.map((r, i) => (
            <Text key={i} style={styles.rule}>
              {i + 1}. {r}
            </Text>
          ))}
        </Paper>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl },
  title: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 66,
    letterSpacing: 3,
    color: colors.onWood,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
  lead: {
    fontFamily: fonts.type,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onWood,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  form: { marginBottom: spacing.xl },
  gapTop: { marginTop: spacing.lg },
  label: { fontFamily: fonts.type, fontSize: 14, color: colors.inkSoft },
  input: {
    fontFamily: fonts.type,
    fontSize: 18,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  value: { fontFamily: fonts.type, fontSize: 18, color: colors.ink, marginTop: 4 },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tape: { flex: 1, minWidth: 0 },
  step: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.onWood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { backgroundColor: 'rgba(234, 220, 191, 0.15)' },
  stepText: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.onWood },
  start: { marginTop: spacing.xxl },
  note: {
    fontFamily: fonts.type,
    fontSize: 13,
    color: colors.onWoodMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  rulesBtn: { marginTop: spacing.xl },
  rules: { marginTop: spacing.lg },
  rule: { fontFamily: fonts.type, fontSize: 14, lineHeight: 21, color: colors.ink, marginBottom: spacing.sm },
});
