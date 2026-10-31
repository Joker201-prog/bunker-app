import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { MAX_PLAYERS, MIN_PLAYERS, seatsFor } from '../game/engine';
import { colors, spacing } from '../theme';

interface Props {
  onStart: (name: string, players: number) => void;
}

export function HomeScreen({ onStart }: Props) {
  const [name, setName] = useState('');
  const [count, setCount] = useState(8);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.logo}>☢</Text>
      <Text style={styles.title}>Убежище</Text>
      <Text style={styles.subtitle}>
        Апокалипсис близко, а мест в бункере не хватает на всех. Докажите, что именно вы
        достойны выжить.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Ваше имя</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Например, Павел"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={16}
        />

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Игроков в партии</Text>
        <View style={styles.stepper}>
          <Button
            label="−"
            variant="secondary"
            style={styles.stepBtn}
            onPress={() => setCount((c) => Math.max(MIN_PLAYERS, c - 1))}
          />
          <View style={styles.countBox}>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.countHint}>мест в бункере: {seatsFor(count)}</Text>
          </View>
          <Button
            label="+"
            variant="secondary"
            style={styles.stepBtn}
            onPress={() => setCount((c) => Math.min(MAX_PLAYERS, c + 1))}
          />
        </View>
        <Text style={styles.note}>Остальные игроки — боты. Это прототип: сетевой игры пока нет.</Text>

        <Button
          label="Начать игру"
          onPress={() => onStart(name.trim(), count)}
          style={{ marginTop: spacing.lg }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Как играть</Text>
        <Text style={styles.rule}>1. В игре 5 раундов: стол, обсуждение, голосование.</Text>
        <Text style={styles.rule}>
          2. В первом раунде все раскрывают профессию, дальше — по одной карте на выбор.
        </Text>
        <Text style={styles.rule}>
          3. Обсуждайте, кто нужнее бункеру при этой катастрофе, и голосуйте за исключение.
        </Text>
        <Text style={styles.rule}>
          4. В конце оценивается, переживёт ли катастрофу группа, которая осталась в бункере.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 48 },
  logo: { fontSize: 48, textAlign: 'center' },
  title: { color: colors.accent, fontSize: 36, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
    marginVertical: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  label: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.panelAlt,
    color: colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 64 },
  countBox: { alignItems: 'center' },
  count: { color: colors.text, fontSize: 32, fontWeight: '800' },
  countHint: { color: colors.muted, fontSize: 12 },
  note: { color: colors.muted, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
  rule: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 },
});
