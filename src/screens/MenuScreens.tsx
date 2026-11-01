import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeskButton, Paper, Stamp, Tape } from '../components/Desk';
import { MAX_PLAYERS, MIN_PLAYERS, seatsFor } from '../game/engine';
import type { HostMode, RoomSettings } from '../game/room';
import { colors, fonts, spacing } from '../theme';

function seatsWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'место';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'места';
  return 'мест';
}

/** Общая раскладка экранов меню: прокрутка поверх стола и кнопка «Назад». */
function MenuLayout({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
      )}
      {children}
    </ScrollView>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return <Text style={styles.error}>{text}</Text>;
}

/* ---------------- Главная ---------------- */

export function HomeScreen({
  name,
  onName,
  server,
  onServer,
  resumeCode,
  onResume,
  onCreate,
  onJoin,
  onLocal,
}: {
  name: string;
  onName: (v: string) => void;
  server: string;
  onServer: (v: string) => void;
  resumeCode: string | null;
  onResume: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onLocal: () => void;
}) {
  const [showServer, setShowServer] = useState(!server);
  return (
    <MenuLayout>
      <Text style={styles.title}>«Убежище»</Text>
      <Text style={styles.lead}>
        Мест в бункере вдвое меньше, чем людей у двери. Докажите, что вы нужнее остальных.
      </Text>

      <Paper rotate="-1deg" style={styles.form}>
        <Stamp label="Заявка на место" size={17} rotate="-4deg" />
        <Text style={[styles.label, styles.gapTop]}>Фамилия, имя:</Text>
        <TextInput
          value={name}
          onChangeText={onName}
          placeholder="как вас называть"
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          maxLength={16}
        />
      </Paper>

      {resumeCode && <DeskButton label={`Вернуться в комнату ${resumeCode}`} onPress={onResume} style={styles.btn} />}
      <DeskButton label="Создать комнату" onPress={onCreate} style={styles.btn} />
      <DeskButton label="Войти по коду" onPress={onJoin} style={styles.btn} />
      <DeskButton label="Игра с ботами" variant="secondary" onPress={onLocal} style={styles.btn} />

      <Pressable onPress={() => setShowServer((v) => !v)} style={styles.serverToggle} hitSlop={8}>
        <Text style={styles.serverToggleText}>
          {server ? `Сервер: ${server.replace(/^https?:\/\//, '')}` : 'Сервер не указан — нужен для игры по сети'}
        </Text>
      </Pressable>
      {showServer && (
        <Paper rotate="0.5deg" style={styles.serverBox}>
          <Text style={styles.label}>Адрес игрового сервера:</Text>
          <TextInput
            value={server}
            onChangeText={onServer}
            placeholder="например, ubezhishe-pavel.amvera.io"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <Text style={styles.hint}>
            Его даёт тот, кто запустил сервер. Для сервера на компьютере в домашней сети пишите с http://, например
            http://192.168.1.10:8080. Для игры с ботами адрес не нужен.
          </Text>
        </Paper>
      )}
    </MenuLayout>
  );
}

/* ---------------- Игра с ботами ---------------- */

export function LocalSetupScreen({ onStart, onBack }: { onStart: (players: number) => void; onBack: () => void }) {
  const [count, setCount] = useState(8);
  const seats = seatsFor(count);
  return (
    <MenuLayout onBack={onBack}>
      <Text style={styles.heading}>Игра с ботами</Text>
      <Text style={styles.woodText}>Вы и боты. Вы же ведёте партию.</Text>
      <View style={styles.counter}>
        <RoundButton label="−" onPress={() => setCount((c) => Math.max(MIN_PLAYERS, c - 1))} a11y="Меньше игроков" />
        <Tape label={`Участники: ${count}`} size={28} style={styles.tape} />
        <RoundButton label="+" onPress={() => setCount((c) => Math.min(MAX_PLAYERS, c + 1))} a11y="Больше игроков" />
      </View>
      <Text style={[styles.woodText, styles.center]}>
        В убежище {seats} {seatsWord(seats)}
      </Text>
      <DeskButton label="Открыть дверь" onPress={() => onStart(count)} style={styles.btnBig} />
    </MenuLayout>
  );
}

function RoundButton({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- Создание комнаты ---------------- */

const HOST_MODES: { mode: HostMode; title: string; text: string }[] = [
  { mode: 'creator', title: 'Создатель комнаты', text: 'Ведёте вы. Роль можно передать другому игроку.' },
  { mode: 'random', title: 'Случайный игрок', text: 'Ведущий выбирается жребием при старте.' },
  { mode: 'vote', title: 'Голосование', text: 'В лобби все голосуют, кто будет вести.' },
];

export function CreateRoomScreen({
  busy,
  error,
  onCreate,
  onBack,
}: {
  busy: boolean;
  error: string | null;
  onCreate: (settings: Partial<RoomSettings>) => void;
  onBack: () => void;
}) {
  const [hostMode, setHostMode] = useState<HostMode>('creator');
  const [hostPlays, setHostPlays] = useState(true);
  const [seconds, setSeconds] = useState(60);
  return (
    <MenuLayout onBack={onBack}>
      <Text style={styles.heading}>Новая комната</Text>

      <Paper rotate="-0.6deg" style={styles.form}>
        <Text style={styles.label}>Кто ведущий:</Text>
        {HOST_MODES.map((m) => (
          <Choice
            key={m.mode}
            title={m.title}
            text={m.text}
            selected={hostMode === m.mode}
            onPress={() => setHostMode(m.mode)}
          />
        ))}

        <Text style={[styles.label, styles.gapTop]}>Ведущий тоже играет:</Text>
        <Choice title="Да" text="Получает карты и голосует, как все." selected={hostPlays} onPress={() => setHostPlays(true)} />
        <Choice
          title="Нет"
          text="Только ведёт партию: без карт и без голоса."
          selected={!hostPlays}
          onPress={() => setHostPlays(false)}
        />

        <Text style={[styles.label, styles.gapTop]}>Время на обсуждение:</Text>
        <View style={styles.row}>
          {[60, 90, 120].map((s) => (
            <Pressable
              key={s}
              onPress={() => setSeconds(s)}
              accessibilityRole="button"
              accessibilityState={{ selected: seconds === s }}
              style={[styles.pill, seconds === s && styles.pillOn]}
            >
              <Text style={[styles.pillText, seconds === s && styles.pillTextOn]}>{s} с</Text>
            </Pressable>
          ))}
        </View>
      </Paper>

      <ErrorLine text={error} />
      <DeskButton
        label={busy ? 'Создаём…' : 'Создать комнату'}
        disabled={busy}
        onPress={() => onCreate({ hostMode, hostPlays, discussionSeconds: seconds })}
        style={styles.btnBig}
      />
    </MenuLayout>
  );
}

function Choice({ title, text, selected, onPress }: { title: string; text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={styles.choice}
    >
      <Text style={[styles.box, selected && styles.boxOn]}>{selected ? '✗' : ' '}</Text>
      <View style={styles.flex}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceText}>{text}</Text>
      </View>
    </Pressable>
  );
}

/* ---------------- Вход по коду ---------------- */

export function JoinScreen({
  busy,
  error,
  onJoin,
  onBack,
}: {
  busy: boolean;
  error: string | null;
  onJoin: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const valid = /^\d{4}$/.test(code);
  return (
    <MenuLayout onBack={onBack}>
      <Text style={styles.heading}>Вход в комнату</Text>
      <Paper rotate="0.8deg" style={styles.form}>
        <Text style={styles.label}>Код комнаты:</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
          placeholder="0000"
          placeholderTextColor={colors.paperLine}
          keyboardType="number-pad"
          maxLength={4}
          style={styles.codeInput}
          autoFocus
        />
        <Text style={styles.hint}>Четыре цифры — их видно у создателя комнаты.</Text>
      </Paper>
      <ErrorLine text={error} />
      <DeskButton
        label={busy ? 'Входим…' : 'Войти'}
        disabled={!valid || busy}
        onPress={() => onJoin(code)}
        style={styles.btnBig}
      />
    </MenuLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: spacing.xl },
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.onWoodMuted },
  title: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 66,
    letterSpacing: 3,
    color: colors.onWood,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.onWood,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  lead: {
    fontFamily: fonts.type,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onWood,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  woodText: { fontFamily: fonts.type, fontSize: 15, lineHeight: 22, color: colors.onWood, marginBottom: spacing.lg },
  center: { textAlign: 'center', marginTop: spacing.md },
  form: { marginBottom: spacing.lg },
  gapTop: { marginTop: spacing.lg },
  label: { fontFamily: fonts.type, fontSize: 14, color: colors.inkSoft, marginBottom: 2 },
  hint: { fontFamily: fonts.type, fontSize: 12, lineHeight: 17, color: colors.inkSoft, marginTop: spacing.sm },
  input: {
    fontFamily: fonts.type,
    fontSize: 18,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  codeInput: {
    fontFamily: fonts.display,
    fontSize: 48,
    letterSpacing: 14,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    textAlign: 'center',
    paddingVertical: 4,
  },
  btn: { marginTop: spacing.md },
  btnBig: { marginTop: spacing.xl },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#fff',
    backgroundColor: colors.stamp,
    padding: spacing.md,
    borderRadius: 3,
    marginTop: spacing.sm,
  },
  serverToggle: { marginTop: spacing.xl, alignSelf: 'center' },
  serverToggleText: { fontFamily: fonts.type, fontSize: 13, color: colors.onWoodMuted, textDecorationLine: 'underline', textAlign: 'center' },
  serverBox: { marginTop: spacing.md },

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

  choice: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start' },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.ink,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.stamp,
    marginTop: 2,
  },
  boxOn: { borderColor: colors.stamp },
  choiceTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  choiceText: { fontFamily: fonts.type, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  pill: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 3 },
  pillOn: { borderColor: colors.stamp, backgroundColor: 'rgba(168, 40, 31, 0.08)' },
  pillText: { fontFamily: fonts.type, fontSize: 15, color: colors.ink },
  pillTextOn: { color: colors.stamp, fontFamily: fonts.bold },
});
