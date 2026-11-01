import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeskButton, Paper, Stamp, Tape, WoodHeading } from '../components/Desk';
import { Dossier } from '../components/Dossier';
import { EventSheet } from '../components/EventSheet';
import { GameHeader } from '../components/StageBar';
import {
  addChat,
  alivePlayers,
  botMessage,
  canLeaveTable,
  castVote,
  eliminationsThisRound,
  isLastRound,
  nextRound,
  playerById,
  resolveRound,
  revealCard,
  revealableKinds,
  startDiscussion,
  startVoting,
} from '../game/engine';
import type { CardKind, GameState } from '../game/types';
import { colors, fonts, spacing } from '../theme';
import { FinalScreen } from './FinalScreen';

const DISCUSSION_SECONDS = 60;
const BOT_CHAT_INTERVAL_MS = 4000;

interface Props {
  initial: GameState;
  onExit: () => void;
}

function clock(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function peopleWord(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'человека';
  return 'человек';
}

function seatsWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'место';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'места';
  return 'мест';
}

export function GameScreen({ initial, onExit }: Props) {
  const [state, setState] = useState<GameState>(initial);
  const [secondsLeft, setSecondsLeft] = useState(DISCUSSION_SECONDS);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showSituation, setShowSituation] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const chatRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const human = state.players.find((p) => p.isHuman)!;
  const numberOf = (id: string) => state.players.findIndex((p) => p.id === id) + 1;

  function confirmExit() {
    Alert.alert('Выйти из партии?', 'Прогресс партии будет потерян.', [
      { text: 'Остаться', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: onExit },
    ]);
  }

  // Кнопка «Назад» не закрывает приложение посреди партии: иначе Android
  // пересоздаёт экран, и партия сбрасывается на стартовое меню.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.stage === 'final') onExit();
      else confirmExit();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, onExit]);

  useEffect(() => {
    if (state.stage !== 'discussion') return;
    const tick = setInterval(() => setSecondsLeft((v) => v - 1), 1000);
    const chat = setInterval(
      () => setState((s) => (s.stage === 'discussion' ? botMessage(s) : s)),
      BOT_CHAT_INTERVAL_MS,
    );
    return () => {
      clearInterval(tick);
      clearInterval(chat);
    };
  }, [state.stage, state.round]);

  useEffect(() => {
    if (state.stage === 'discussion' && secondsLeft <= 0) goVoting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, state.stage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (state.stage !== 'table') setShowSituation(false);
  }, [state.stage, state.round]);

  function goDiscussion() {
    setSecondsLeft(DISCUSSION_SECONDS);
    setState((s) => startDiscussion(s));
  }

  function goVoting() {
    setSelected(null);
    setState((s) => startVoting(s));
  }

  function submitVote() {
    setState((s) => {
      let cur = s;
      if (human.alive && selected) cur = castVote(cur, 'human', selected);
      return resolveRound(cur);
    });
    setSelected(null);
  }

  function sendMessage() {
    if (!draft.trim()) return;
    setState((s) => addChat(s, 'human', draft));
    setDraft('');
  }

  if (state.stage === 'final') {
    return <FinalScreen state={state} onRestart={onExit} />;
  }

  const alive = alivePlayers(state);
  const others = state.players.filter((p) => !p.isHuman);
  const elims = eliminationsThisRound(state);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <GameHeader round={state.round} totalRounds={state.totalRounds} stage={state.stage} onExit={confirmExit} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <EventSheet state={state} expanded={showSituation} onToggle={() => setShowSituation((v) => !v)} />
        <Tape
          label={`Участники: ${alive.length} · ${state.seats} ${seatsWord(state.seats)}`}
          size={24}
          rotate="-2deg"
          style={styles.tape}
        />

        {state.stage === 'table' && (
          <TableStage
            state={state}
            others={others}
            numberOf={numberOf}
            onReveal={(kind) => setState((s) => revealCard(s, 'human', kind))}
            onContinue={goDiscussion}
          />
        )}

        {state.stage === 'discussion' && (
          <View>
            <View style={styles.timerRow}>
              <WoodHeading style={styles.noMargin}>Обсуждение</WoodHeading>
              <Text style={[styles.timer, secondsLeft <= 10 && styles.timerLow]}>{clock(secondsLeft)}</Text>
            </View>

            {/* Блокнот фиксированной высоты: новые реплики прокручивают его, поле ввода не сдвигается. */}
            <Paper rotate="-0.4deg" padded={false}>
              <ScrollView
                ref={chatRef}
                style={styles.chat}
                contentContainerStyle={styles.chatContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: false })}
              >
                {state.chat.map((m) =>
                  m.authorId === null ? (
                    <Text key={m.id} style={styles.systemMsg}>
                      — {m.text} —
                    </Text>
                  ) : (
                    <Text key={m.id} style={styles.msg}>
                      <Text style={[styles.author, m.authorId === 'human' && styles.authorMine]}>
                        {m.authorId === 'human' ? 'Вы' : playerById(state, m.authorId).name}:{' '}
                      </Text>
                      {m.text}
                    </Text>
                  ),
                )}
              </ScrollView>
            </Paper>

            {human.alive ? (
              <View style={styles.inputRow}>
                <Paper padded={false} style={styles.inputPaper}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Чем вы полезны бункеру?"
                    placeholderTextColor={colors.inkSoft}
                    style={styles.input}
                    onSubmitEditing={sendMessage}
                    maxLength={200}
                  />
                </Paper>
                <DeskButton label="Сказать" onPress={sendMessage} style={styles.send} />
              </View>
            ) : (
              <Text style={styles.woodNote}>Вы за дверью и только наблюдаете.</Text>
            )}
            <DeskButton
              label={elims > 0 ? 'Голосовать' : 'Завершить раунд'}
              variant="secondary"
              onPress={goVoting}
              style={styles.block}
            />

            <WoodHeading>Досье</WoodHeading>
            {state.players.map((p) => (
              <Dossier key={p.id} player={p} number={numberOf(p.id)} showAll={p.isHuman} secretHint={p.isHuman} />
            ))}
          </View>
        )}

        {state.stage === 'voting' && (
          <View>
            <WoodHeading>Кого не пускаем?</WoodHeading>
            <Text style={styles.woodText}>
              {human.alive
                ? elims === 1
                  ? 'В этом раунде за дверью останется один человек. Нажмите на досье того, против кого голосуете.'
                  : `В этом раунде за дверью останутся ${elims} ${peopleWord(elims)}. Нажмите на досье того, против кого голосуете.`
                : 'Вы за дверью. Остальные голосуют без вас.'}
            </Text>
            {alive
              .filter((p) => !p.isHuman)
              .map((p) => (
                <Dossier
                  key={p.id}
                  player={p}
                  number={numberOf(p.id)}
                  marked={selected === p.id}
                  onPress={human.alive ? () => setSelected(p.id) : undefined}
                />
              ))}
            <DeskButton
              label={human.alive ? 'Проголосовать' : 'Подсчитать голоса'}
              onPress={submitVote}
              disabled={human.alive && !selected}
              style={styles.block}
            />
          </View>
        )}

        {state.stage === 'result' && (
          <ResultStage
            state={state}
            numberOf={numberOf}
            last={isLastRound(state)}
            onNext={() => setState((s) => nextRound(s))}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TableStage({
  state,
  others,
  numberOf,
  onReveal,
  onContinue,
}: {
  state: GameState;
  others: GameState['players'];
  numberOf: (id: string) => number;
  onReveal: (kind: CardKind) => void;
  onContinue: () => void;
}) {
  const human = state.players.find((p) => p.isHuman)!;
  const revealable = human.alive ? revealableKinds(state, human) : [];
  const done = canLeaveTable(state);
  let hint: string;
  if (!human.alive) hint = 'Вы за дверью и наблюдаете за игрой.';
  else if (done) hint = 'Карта открыта. Остальные покажут свои, когда начнётся обсуждение.';
  else if (state.round === 1) hint = 'Первый раунд: нажмите «Раскрыть» у профессии.';
  else hint = 'Нажмите «Раскрыть» у одной карты — её увидят все.';

  return (
    <View>
      <WoodHeading>Ваше досье</WoodHeading>
      <Text style={styles.woodText}>{hint}</Text>
      <Dossier
        player={human}
        number={numberOf(human.id)}
        showAll
        secretHint
        revealable={revealable}
        onReveal={onReveal}
      />
      <DeskButton label="Начать обсуждение" onPress={onContinue} disabled={!done} style={styles.block} />
      <WoodHeading>Остальные</WoodHeading>
      {others.map((p) => (
        <Dossier key={p.id} player={p} number={numberOf(p.id)} />
      ))}
    </View>
  );
}

/** Палочки для подсчёта голосов группами по пять: «||||| ||». */
function tallyMarks(n: number): string {
  const groups: string[] = [];
  for (let left = n; left > 0; left -= 5) groups.push('|'.repeat(Math.min(5, left)));
  return groups.join(' ');
}

function ResultStage({
  state,
  numberOf,
  last,
  onNext,
}: {
  state: GameState;
  numberOf: (id: string) => number;
  last: boolean;
  onNext: () => void;
}) {
  const result = state.results[state.results.length - 1];
  const leaving = result.eliminated.map((id) => playerById(state, id));
  const tally = Object.entries(result.tally)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <View>
      {leaving.length === 0 ? (
        <Text style={styles.woodText}>В этом раунде голосования не было — все остаются у двери.</Text>
      ) : (
        <Paper rotate="-0.8deg" style={styles.protocol}>
          <Stamp label={`Протокол раунда ${state.round}`} size={17} rotate="-3deg" />
          <Text style={[styles.protoLine, styles.gapTop]}>
            Дверь закрывается перед: <Text style={styles.protoStrong}>{leaving.map((p) => p.name).join(', ')}</Text>
          </Text>
          {result.tieBroken && <Text style={styles.protoNote}>Голоса разделились поровну — решил жребий.</Text>}
          {result.shieldBlocked.length > 0 && (
            <Text style={styles.protoNote}>
              «Неприкосновенность» спасла: {result.shieldBlocked.map((id) => playerById(state, id).name).join(', ')}.
            </Text>
          )}
          <Text style={[styles.protoSub, styles.gapTop]}>Голоса:</Text>
          {tally.map(([id, n]) => (
            <View key={id} style={styles.tallyRow}>
              <Text
                style={[styles.tallyName, result.eliminated.includes(id) && styles.tallyOut]}
                numberOfLines={1}
              >
                {playerById(state, id).name}
              </Text>
              <Text style={styles.tallyMarks}>{tallyMarks(n)}</Text>
              <Text style={styles.tallyNum}>{n}</Text>
            </View>
          ))}
        </Paper>
      )}

      {leaving.map((p) => (
        <Dossier key={p.id} player={p} number={numberOf(p.id)} showAll />
      ))}

      <DeskButton label={last ? 'Узнать судьбу бункера' : 'Следующий раунд'} onPress={onNext} style={styles.block} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(20, 13, 8, 0.55)',
  },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  tape: { marginTop: spacing.lg, marginBottom: spacing.xs },
  noMargin: { marginTop: 0, marginBottom: 0 },
  woodText: { fontFamily: fonts.type, fontSize: 15, lineHeight: 22, color: colors.onWood, marginBottom: spacing.xs },
  woodNote: { fontFamily: fonts.type, fontSize: 14, color: colors.onWoodMuted, marginTop: spacing.md },
  block: { marginTop: spacing.md, marginBottom: spacing.md },
  gapTop: { marginTop: spacing.md },

  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  timer: { fontFamily: fonts.display, fontSize: 28, color: colors.onWood, letterSpacing: 1 },
  timerLow: { color: '#ff8a7a' },
  chat: { height: 280 },
  chatContent: { padding: spacing.lg, gap: spacing.sm },
  systemMsg: { fontFamily: fonts.type, fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  msg: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.ink },
  author: { fontFamily: fonts.bold, color: colors.stampBlue },
  authorMine: { color: colors.stamp },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch', marginTop: spacing.md },
  inputPaper: { flex: 1 },
  input: { fontFamily: fonts.type, fontSize: 15, color: colors.ink, paddingHorizontal: spacing.md, minHeight: 52 },
  send: { width: 120 },

  protocol: { marginTop: spacing.lg },
  protoLine: { fontFamily: fonts.type, fontSize: 15, lineHeight: 22, color: colors.ink },
  protoStrong: { fontFamily: fonts.display, fontSize: 18, color: colors.stamp, letterSpacing: 0.5 },
  protoNote: { fontFamily: fonts.type, fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: spacing.xs },
  protoSub: { fontFamily: fonts.type, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.xs },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperLine,
  },
  tallyName: { width: 110, fontFamily: fonts.type, fontSize: 14, color: colors.ink },
  tallyOut: { color: colors.stamp, textDecorationLine: 'line-through' },
  tallyMarks: { flex: 1, fontFamily: fonts.type, fontSize: 16, color: colors.ink, letterSpacing: 1 },
  tallyNum: { width: 26, textAlign: 'right', fontFamily: fonts.type, fontSize: 14, color: colors.inkSoft },
});
