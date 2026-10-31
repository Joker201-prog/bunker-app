import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { HazardStripe } from '../components/HazardStripe';
import { PlayerCards } from '../components/PlayerCards';
import { StageBar } from '../components/StageBar';
import { TAG_LABEL } from '../data/cards';
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
import { colors, fonts, radius, spacing } from '../theme';
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

export function GameScreen({ initial, onExit }: Props) {
  const [state, setState] = useState<GameState>(initial);
  const [secondsLeft, setSecondsLeft] = useState(DISCUSSION_SECONDS);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showSituation, setShowSituation] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const human = state.players.find((p) => p.isHuman)!;

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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerMeta}>
            {alive.length} у двери · {state.seats} мест
          </Text>
          <Pressable onPress={onExit} hitSlop={12}>
            <Text style={styles.exit}>Выйти</Text>
          </Pressable>
        </View>
        <StageBar round={state.round} totalRounds={state.totalRounds} stage={state.stage} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.situation} onPress={() => setShowSituation((v) => !v)}>
          <View style={styles.situationHead}>
            <Text style={styles.catTitle}>{state.catastrophe.title}</Text>
            <Text style={styles.toggle}>{showSituation ? 'Свернуть' : 'Подробнее'}</Text>
          </View>
          {showSituation && (
            <View style={styles.situationBody}>
              <Text style={styles.body}>{state.catastrophe.text}</Text>
              <Text style={styles.body}>Ждать снаружи придётся около {state.catastropheYears} лет.</Text>
              <Text style={styles.subhead}>Что понадобится</Text>
              <View style={styles.needs}>
                {state.catastrophe.needs.map((n) => (
                  <Text key={n} style={styles.need}>
                    {TAG_LABEL[n]}
                  </Text>
                ))}
              </View>
              <Text style={styles.subhead}>Что есть в бункере</Text>
              {state.bunker.map((b) => (
                <View key={b.title} style={styles.bunkerRow}>
                  <View
                    style={[styles.dot, { backgroundColor: b.bonus >= 0 ? colors.good : colors.bad }]}
                  />
                  <Text style={styles.bunkerText}>
                    <Text style={styles.bunkerTitle}>{b.title}.</Text> {b.text}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Pressable>

        {state.stage === 'table' && (
          <TableStage
            state={state}
            others={others}
            onReveal={(kind) => setState((s) => revealCard(s, 'human', kind))}
            onContinue={goDiscussion}
          />
        )}

        {state.stage === 'discussion' && (
          <View>
            <View style={styles.timerRow}>
              <Text style={styles.sectionTitle}>Обсуждение</Text>
              <Text style={[styles.timer, secondsLeft <= 10 && styles.timerLow]}>{clock(secondsLeft)}</Text>
            </View>
            <View style={styles.chat}>
              {state.chat.slice(-30).map((m) => {
                if (m.authorId === null) {
                  return (
                    <Text key={m.id} style={styles.systemMsg}>
                      {m.text}
                    </Text>
                  );
                }
                const mine = m.authorId === 'human';
                return (
                  <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    {!mine && <Text style={styles.author}>{playerById(state, m.authorId).name}</Text>}
                    <Text style={styles.msgText}>{m.text}</Text>
                  </View>
                );
              })}
            </View>
            {human.alive ? (
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Чем вы полезны бункеру?"
                  placeholderTextColor={colors.neutral}
                  style={styles.input}
                  onSubmitEditing={sendMessage}
                  maxLength={200}
                />
                <Button label="Сказать" onPress={sendMessage} style={styles.send} />
              </View>
            ) : (
              <Text style={styles.muted}>Вы за дверью и только наблюдаете.</Text>
            )}
            <Button
              label={elims > 0 ? 'Перейти к голосованию' : 'Завершить раунд'}
              variant="secondary"
              onPress={goVoting}
              style={styles.block}
            />
            <Text style={styles.sectionTitle}>Досье</Text>
            {state.players.map((p) => (
              <PlayerCards key={p.id} player={p} showAll={p.isHuman} onlyOpen={!p.isHuman} />
            ))}
          </View>
        )}

        {state.stage === 'voting' && (
          <View>
            <Text style={styles.sectionTitle}>Кого не пускаем?</Text>
            <Text style={styles.hint}>
              {human.alive
                ? elims === 1
                  ? 'В этом раунде за дверью останется один человек. Выберите, против кого голосуете.'
                  : `В этом раунде за дверью останутся ${elims} ${peopleWord(elims)}. Выберите, против кого голосуете.`
                : 'Вы за дверью. Остальные голосуют без вас.'}
            </Text>
            {alive
              .filter((p) => !p.isHuman)
              .map((p) => (
                <PlayerCards
                  key={p.id}
                  player={p}
                  onlyOpen
                  highlight={selected === p.id}
                  onPress={human.alive ? () => setSelected(p.id) : undefined}
                />
              ))}
            <Button
              label={human.alive ? 'Проголосовать' : 'Подсчитать голоса'}
              onPress={submitVote}
              disabled={human.alive && !selected}
              style={styles.block}
            />
          </View>
        )}

        {state.stage === 'result' && (
          <ResultStage state={state} last={isLastRound(state)} onNext={() => setState((s) => nextRound(s))} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TableStage({
  state,
  others,
  onReveal,
  onContinue,
}: {
  state: GameState;
  others: GameState['players'];
  onReveal: (kind: CardKind) => void;
  onContinue: () => void;
}) {
  const human = state.players.find((p) => p.isHuman)!;
  const revealable = human.alive ? revealableKinds(state, human) : [];
  const done = canLeaveTable(state);
  let hint: string;
  if (!human.alive) hint = 'Вы за дверью и наблюдаете за игрой.';
  else if (done) hint = 'Карта открыта. Остальные покажут свои, когда начнётся обсуждение.';
  else if (state.round === 1) hint = 'Первый раунд: покажите всем свою профессию.';
  else hint = 'Выберите одну карту, которую увидят все.';

  return (
    <View>
      <Text style={styles.sectionTitle}>Ваше досье</Text>
      <Text style={styles.hint}>{hint}</Text>
      <PlayerCards player={human} showAll revealable={revealable} onReveal={onReveal} />
      <Button label="Начать обсуждение" onPress={onContinue} disabled={!done} style={styles.block} />
      <Text style={styles.sectionTitle}>Остальные</Text>
      {others.map((p) => (
        <PlayerCards key={p.id} player={p} onlyOpen />
      ))}
    </View>
  );
}

function ResultStage({ state, last, onNext }: { state: GameState; last: boolean; onNext: () => void }) {
  const result = state.results[state.results.length - 1];
  const leaving = result.eliminated.map((id) => playerById(state, id));
  const tally = Object.entries(result.tally)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxVotes = tally.length ? tally[0][1] : 1;

  return (
    <View>
      {leaving.length === 0 ? (
        <Text style={styles.hint}>В этом раунде голосования не было — все остаются у двери.</Text>
      ) : (
        <View style={styles.verdict}>
          <HazardStripe height={6} />
          <View style={styles.verdictBody}>
            <Text style={styles.muted}>Дверь закрывается перед</Text>
            <Text style={styles.verdictNames}>{leaving.map((p) => p.name).join(', ')}</Text>
            {result.tieBroken && <Text style={styles.muted}>Голоса разделились поровну — решил жребий.</Text>}
            {result.shieldBlocked.length > 0 && (
              <Text style={styles.muted}>
                «Неприкосновенность» спасла:{' '}
                {result.shieldBlocked.map((id) => playerById(state, id).name).join(', ')}.
              </Text>
            )}
          </View>
        </View>
      )}

      {tally.length > 0 && (
        <View style={styles.tally}>
          <Text style={styles.subhead}>Голоса</Text>
          {tally.map(([id, n]) => (
            <View key={id} style={styles.tallyRow}>
              <Text style={styles.tallyName} numberOfLines={1}>
                {playerById(state, id).name}
              </Text>
              <View style={styles.tallyTrack}>
                <View
                  style={[
                    styles.tallyBar,
                    { width: `${(n / maxVotes) * 100}%` },
                    result.eliminated.includes(id) && styles.tallyBarOut,
                  ]}
                />
              </View>
              <Text style={styles.tallyNum}>{n}</Text>
            </View>
          ))}
        </View>
      )}

      {leaving.map((p) => (
        <PlayerCards key={p.id} player={p} showAll />
      ))}

      <Button label={last ? 'Узнать судьбу бункера' : 'Следующий раунд'} onPress={onNext} style={styles.block} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.panel,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  exit: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  situation: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  situationHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  catTitle: { flex: 1, color: colors.amber, fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  toggle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  situationBody: { marginTop: spacing.sm },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginBottom: 4 },
  subhead: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13, marginTop: spacing.md, marginBottom: 6 },
  needs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  need: {
    color: colors.amber,
    fontFamily: fonts.bold,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bunkerRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 4, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  bunkerText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bunkerTitle: { fontFamily: fonts.bold },

  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.sm, marginTop: spacing.sm },
  hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  block: { marginTop: spacing.sm, marginBottom: spacing.xl },

  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  timer: { color: colors.amber, fontFamily: fonts.mono, fontSize: 24 },
  timerLow: { color: colors.bad },
  chat: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 140,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  systemMsg: { color: colors.amber, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  bubble: { maxWidth: '86%', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.raised },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.amberDeep },
  author: { color: colors.amber, fontFamily: fonts.bold, fontSize: 12, marginBottom: 2 },
  msgText: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch', marginBottom: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: radius.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  send: { paddingHorizontal: 16 },

  verdict: { backgroundColor: colors.panel, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.lg },
  verdictBody: { padding: spacing.lg },
  verdictNames: { color: colors.text, fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginVertical: 6 },
  tally: { marginBottom: spacing.lg },
  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  tallyName: { width: 96, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  tallyTrack: { flex: 1, height: 8, backgroundColor: colors.panel, borderRadius: 2, overflow: 'hidden' },
  tallyBar: { height: 8, backgroundColor: colors.neutral },
  tallyBarOut: { backgroundColor: colors.bad },
  tallyNum: { width: 22, textAlign: 'right', color: colors.muted, fontFamily: fonts.mono, fontSize: 13 },
});
