import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeskButton, Paper, Stamp, Tape } from '../components/Desk';
import { DoorSketch } from '../components/DoorSketch';
import { MAX_PLAYERS, MIN_PLAYERS, seatsFor } from '../game/engine';
import type { HostMode, RoomSettings } from '../game/room';
import { colors, fonts, images, spacing } from '../theme';
import { DropIn, StampHit } from '../ui/anim';

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
  resumeCode,
  onResume,
  onCreate,
  onJoin,
  onLocal,
  onInfo,
}: {
  name: string;
  onName: (v: string) => void;
  resumeCode: string | null;
  onResume: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onLocal: () => void;
  onInfo: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sketchW = Math.min(width - 2 * 22 - 18 - 40, 300);
  return (
    <ScrollView
      contentContainerStyle={[home.container, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={home.caseRow}>
        <Text style={home.caseText}>ДЕЛО № 042</Text>
        <Text style={home.caseText}>ДЛЯ СЛУЖЕБНОГО ПОЛЬЗОВАНИЯ</Text>
      </View>

      <DropIn rotate="-3deg" style={home.polaroidWrap}>
        <View style={home.polaroid}>
          <DoorSketch width={sketchW} />
          <Text style={home.caption}>схема входа, лист 1</Text>
        </View>
        <Image source={images.tape} style={home.tape} resizeMode="stretch" />
      </DropIn>

      <Text style={home.title} accessibilityRole="header">
        УБЕЖИЩЕ
      </Text>
      <Text style={home.lead}>Мест в бункере вдвое меньше, чем людей у двери. Докажите, что вы нужнее.</Text>

      <DropIn index={1} rotate="-1deg" style={home.formWrap}>
        <Paper padded={false}>
          <View style={home.form}>
            <View style={home.formHead}>
              <StampHit label="Заявка на место" color={colors.stamp} size={15} rotate="-3deg" />
              <Text style={home.formNo}>форма 7-Б</Text>
            </View>
            <Text style={home.label}>Фамилия, имя:</Text>
            <TextInput
              value={name}
              onChangeText={onName}
              placeholder="как вас называть"
              placeholderTextColor={colors.paperLine}
              style={home.nameInput}
              maxLength={16}
              accessibilityLabel="Фамилия, имя"
            />
          </View>
        </Paper>
      </DropIn>

      <View style={home.spacer} />

      {resumeCode && (
        <DeskButton label={`Вернуться в комнату ${resumeCode}`} variant="secondary" onPress={onResume} style={home.resume} />
      )}
      <DeskButton label="Создать комнату" sub="Wi-Fi или интернет, вы — ведущий" arrow onPress={onCreate} />
      <View style={home.twoCols}>
        <DeskButton label="Войти по коду" variant="secondary" size={16} onPress={onJoin} style={home.col} />
        <DeskButton label="Игра с ботами" variant="secondary" size={16} onPress={onLocal} style={home.col} />
      </View>
      <Pressable onPress={onInfo} accessibilityRole="button" hitSlop={8} style={home.infoLink}>
        <Text style={home.infoText}>Картотека: события и карты</Text>
      </Pressable>
    </ScrollView>
  );
}

const home = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 22 },
  caseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  caseText: { fontFamily: fonts.type, fontSize: 11, letterSpacing: 1, color: colors.onWoodSoft },
  polaroidWrap: { alignSelf: 'center', marginTop: 26 },
  polaroid: {
    backgroundColor: colors.paperWhite,
    padding: 9,
    paddingBottom: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 10 },
  },
  caption: { fontFamily: fonts.hand, fontSize: 19, color: '#3a4f7a', textAlign: 'right', marginTop: 4 },
  tape: { position: 'absolute', top: -14, alignSelf: 'center', width: 120, height: 30, opacity: 0.92, transform: [{ rotate: '4deg' }] },
  title: {
    marginTop: 22,
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 60,
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.onWoodBright,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 3 },
  },
  lead: { marginTop: 10, marginHorizontal: 8, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.paper },
  formWrap: { marginTop: 20 },
  form: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formNo: { fontFamily: fonts.type, fontSize: 12, color: colors.inkSoft },
  label: { marginTop: 12, fontFamily: fonts.type, fontSize: 13, color: colors.inkSoft },
  nameInput: {
    marginTop: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 30,
    lineHeight: 36,
    color: colors.stampBlue,
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  spacer: { flexGrow: 1, minHeight: 24 },
  resume: { marginBottom: 10 },
  twoCols: { flexDirection: 'row', gap: 10, marginTop: 10 },
  col: { flex: 1 },
  infoLink: { alignSelf: 'center', marginTop: 14, minHeight: 44, justifyContent: 'center' },
  infoText: {
    fontFamily: fonts.type,
    fontSize: 14,
    color: colors.onWood,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: 'rgba(234, 220, 191, 0.6)',
  },
});

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

export type RoomPlace = 'lan' | 'online';

export function CreateRoomScreen({
  busy,
  error,
  onCreate,
  onBack,
}: {
  busy: boolean;
  error: string | null;
  onCreate: (place: RoomPlace, settings: Partial<RoomSettings>) => void;
  onBack: () => void;
}) {
  const [place, setPlace] = useState<RoomPlace>('lan');
  const [hostMode, setHostMode] = useState<HostMode>('creator');
  const [hostPlays, setHostPlays] = useState(true);
  const [seconds, setSeconds] = useState(60);
  const [voteSeconds, setVoteSeconds] = useState(30);
  return (
    <MenuLayout onBack={onBack}>
      <Text style={styles.heading}>Новая комната</Text>

      <Paper rotate="0.6deg" style={styles.form}>
        <Text style={styles.label}>Где играем:</Text>
        <Choice
          title="В этой Wi-Fi сети"
          text="Все рядом, в одной Wi-Fi сети или на точке доступа этого телефона. Комнату держит этот телефон — не сворачивайте приложение."
          selected={place === 'lan'}
          onPress={() => setPlace('lan')}
        />
        <Choice
          title="Через интернет"
          text="Игроки могут быть где угодно — нужен только интернет. Друзей можно позвать ссылкой из лобби."
          selected={place === 'online'}
          onPress={() => setPlace('online')}
        />
      </Paper>

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

        <Text style={[styles.label, styles.gapTop]}>Время на голосование:</Text>
        <View style={styles.row}>
          {[30, 45, 60].map((v) => (
            <Pressable
              key={v}
              onPress={() => setVoteSeconds(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: voteSeconds === v }}
              style={[styles.pill, voteSeconds === v && styles.pillOn]}
            >
              <Text style={[styles.pillText, voteSeconds === v && styles.pillTextOn]}>{v} с</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Таймеры запускает и продлевает ведущий.</Text>
      </Paper>

      <ErrorLine text={error} />
      <DeskButton
        label={busy ? 'Создаём…' : 'Создать комнату'}
        disabled={busy}
        onPress={() => onCreate(place, { hostMode, hostPlays, discussionSeconds: seconds, votingSeconds: voteSeconds })}
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
  initialCode,
  invited,
  name,
  onName,
  busy,
  progress,
  error,
  onJoin,
  onBack,
}: {
  /** Код из ссылки-приглашения. */
  initialCode?: string;
  /** Открыто по ссылке-приглашению. */
  invited?: boolean;
  name: string;
  onName: (v: string) => void;
  busy: boolean;
  /** Текст хода поиска комнаты в сети. */
  progress: string | null;
  error: string | null;
  onJoin: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState(initialCode ?? '');
  const lan = code.length === 5;
  const online = code.length === 4;
  return (
    <MenuLayout onBack={onBack}>
      <Text style={styles.heading}>Вход в комнату</Text>
      <Paper rotate="0.8deg" style={styles.form}>
        {invited && (
          <>
            <Text style={styles.label}>Фамилия, имя:</Text>
            <TextInput
              value={name}
              onChangeText={onName}
              placeholder="как вас называть"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, styles.gapBottom]}
              maxLength={16}
            />
          </>
        )}
        <Text style={styles.label}>Код комнаты:</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 5))}
          placeholder="00000"
          placeholderTextColor={colors.paperLine}
          keyboardType="number-pad"
          maxLength={5}
          style={styles.codeInput}
          autoFocus={!initialCode}
        />
        <Text style={styles.hint}>
          {invited && online && code === initialCode
            ? 'Вас пригласили в эту комнату. Впишите имя и нажмите «Войти».'
            : lan
            ? 'Пять цифр — комната в Wi-Fi сети. Подключитесь к той же сети, что и ведущий.'
            : online
              ? 'Четыре цифры — комната через интернет.'
              : 'Код показывает создатель комнаты: пять цифр — игра в Wi-Fi сети, четыре — через интернет.'}
        </Text>
      </Paper>
      <ErrorLine text={error} />
      <DeskButton
        label={busy ? (lan ? 'Ищем комнату…' : 'Входим…') : 'Войти'}
        disabled={!(lan || online) || busy}
        onPress={() => onJoin(code)}
        style={styles.btnBig}
      />
      {busy && progress && <Text style={styles.wake}>{progress}</Text>}
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
  gapBottom: { marginBottom: spacing.lg },
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
    letterSpacing: 10,
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
  wake: { fontFamily: fonts.type, fontSize: 13, lineHeight: 19, color: colors.onWoodMuted, textAlign: 'center', marginTop: spacing.md },
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
