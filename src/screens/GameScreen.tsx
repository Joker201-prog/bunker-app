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
import { PlayerCards } from '../components/PlayerCards';
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
import { colors, spacing } from '../theme';
import { FinalScreen } from './FinalScreen';

const DISCUSSION_SECONDS = 60;
const BOT_CHAT_INTERVAL_MS = 4000;

interface Props {
  initial: GameState;
  onExit: () => void;
}

export function GameScreen({ initial, onExit }: Props) {
  const [state, setState] = useState<GameState>(initial);
  const [secondsLeft, setSecondsLeft] = useState(DISCUSSION_SECONDS);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showSituation, setShowSituation] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const human = state.players.find((p) => p.isHuman)!;

  // Discussion: countdown and bot chatter. The timer is reset by goDiscussion().
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
    if (state.stage === 'discussion' && secondsLeft <= 0) {
      goVoting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, state.stage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
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
  const nameOf = (id: string | null) => (id ? playerById(state, id).name : 'Система');
  const needsLabel = state.catastrophe.needs.map((n) => TAG_LABEL[n]).join(', ');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.round}>
            Раунд {state.round} из {state.totalRounds}
          </Text>
          <Text style={styles.stage}>
            {state.stage === 'table' && 'Стол: раскрытие карт'}
            {state.stage === 'discussion' && `Обсуждение · ${Math.max(0, secondsLeft)} с`}
            {state.stage === 'voting' && 'Голосование'}
            {state.stage === 'result' && 'Итоги раунда'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.seats}>
            В игре {alive.length} · мест {state.seats}
          </Text>
          <Pressable onPress={onExit}>
            <Text style={styles.exit}>Выйти</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.situation} onPress={() => setShowSituation((v) => !v)}>
          <Text style={styles.situationTitle}>
            ☢ {state.catastrophe.title} {showSituation ? '▾' : '▸'}
          </Text>
          {showSituation && (
            <View>
              <Text style={styles.text}>{state.catastrophe.text}</Text>
              <Text style={styles.text}>Снаружи придётся ждать около {state.catastropheYears} лет.</Text>
              <Text style={styles.needs}>Что понадобится: {needsLabel}</Text>
              <Text style={styles.bunkerTitle}>Бункер:</Text>
              {state.bunker.map((b) => (
                <Text
                  key={b.title}
                  style={[styles.bunkerLine, { color: b.bonus >= 0 ? colors.good : colors.bad }]}
                >
                  • {b.title}: {b.text}
                </Text>
              ))}
            </View>
          )}
        </Pressable>

        {state.stage === 'table' && (
          <TableStage
            state={state}
            onReveal={(kind) => setState((s) => revealCard(s, 'human', kind))}
            onContinue={goDiscussion}
            others={others}
          />
        )}

        {state.stage === 'discussion' && (
          <View>
            <View style={styles.chat}>
              {state.chat.slice(-30).map((m) => (
                <View key={m.id} style={styles.msg}>
                  <Text style={[styles.msgAuthor, m.authorId === null && { color: colors.accent }]}>
                    {nameOf(m.authorId)}
                  </Text>
                  <Text style={styles.msgText}>{m.text}</Text>
                </View>
              ))}
            </View>
            {human.alive ? (
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ваш аргумент…"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  onSubmitEditing={sendMessage}
                  maxLength={200}
                />
                <Button label="Отправить" onPress={sendMessage} style={{ paddingHorizontal: 14 }} />
              </View>
            ) : (
              <Text style={styles.muted}>Вы исключены и наблюдаете за обсуждением.</Text>
            )}
            <Button
              label={eliminationsThisRound(state) > 0 ? 'К голосованию' : 'Завершить раунд'}
              variant="secondary"
              onPress={goVoting}
              style={{ marginVertical: spacing.md }}
            />
            {state.players.map((p) => (
              <PlayerCards key={p.id} player={p} />
            ))}
          </View>
        )}

        {state.stage === 'voting' && (
          <View>
            <Text style={styles.hint}>
              {human.alive
                ? `Кого исключить? Нужно исключить игроков: ${eliminationsThisRound(state)}. Выберите одного.`
                : 'Вы исключены. Остальные голосуют без вас.'}
            </Text>
            {alive
              .filter((p) => !p.isHuman)
              .map((p) => (
                <PlayerCards
                  key={p.id}
                  player={p}
                  highlight={selected === p.id}
                  onPress={human.alive ? () => setSelected(p.id) : undefined}
                />
              ))}
            <Button
              label={human.alive ? 'Проголосовать' : 'Подсчитать голоса'}
              onPress={submitVote}
              disabled={human.alive && !selected}
              style={{ marginVertical: spacing.md }}
            />
          </View>
        )}

        {state.stage === 'result' && (
          <ResultStage state={state} onNext={() => setState((s) => nextRound(s))} last={isLastRound(state)} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TableStage({
  state,
  onReveal,
  onContinue,
  others,
}: {
  state: GameState;
  onReveal: (kind: CardKind) => void;
  onContinue: () => void;
  others: GameState['players'];
}) {
  const human = state.players.find((p) => p.isHuman)!;
  const revealable = revealableKinds(state, human);
  const done = canLeaveTable(state);
  return (
    <View>
      {human.alive ? (
        <Text style={styles.hint}>
          {done
            ? 'Карта раскрыта. Остальные откроют свои, когда вы начнёте обсуждение.'
            : state.round === 1
              ? 'Раунд 1: раскройте профессию.'
              : 'Выберите одну карту, которую раскроете остальным.'}
        </Text>
      ) : (
        <Text style={styles.hint}>Вы исключены и наблюдаете за игрой.</Text>
      )}
      <PlayerCards
        player={human}
        showAll
        revealable={human.alive ? revealable : []}
        onReveal={onReveal}
      />
      <Button
        label="Начать обсуждение"
        onPress={onContinue}
        disabled={!done}
        style={{ marginBottom: spacing.md }}
      />
      {others.map((p) => (
        <PlayerCards key={p.id} player={p} />
      ))}
    </View>
  );
}

function ResultStage({
  state,
  onNext,
  last,
}: {
  state: GameState;
  onNext: () => void;
  last: boolean;
}) {
  const result = state.results[state.results.length - 1];
  const leaving = result.eliminated.map((id) => playerById(state, id));
  const tally = Object.entries(result.tally).sort((a, b) => b[1] - a[1]);
  return (
    <View>
      {leaving.length === 0 ? (
        <Text style={styles.hint}>В этом раунде голосования не было, никто не выбыл.</Text>
      ) : (
        <View>
          <Text style={styles.hint}>
            {leaving.length === 1 ? 'Бункер покидает:' : 'Бункер покидают:'}{' '}
            {leaving.map((p) => p.name).join(', ')}
          </Text>
          {result.tieBroken && <Text style={styles.muted}>Были равные голоса, исход решил жребий.</Text>}
          {result.shieldBlocked.length > 0 && (
            <Text style={styles.muted}>
              «Неприкосновенность» спасла: {result.shieldBlocked.map((id) => playerById(state, id).name).join(', ')}.
            </Text>
          )}
          {leaving.map((p) => (
            <PlayerCards key={p.id} player={p} showAll />
          ))}
        </View>
      )}
      {leaving.length > 0 && (
        <View style={styles.tally}>
          <Text style={styles.situationTitle}>Голоса</Text>
          {tally.map(([id, n]) => (
            <Text key={id} style={styles.text}>
              {playerById(state, id).name}: {n}
            </Text>
          ))}
        </View>
      )}
      <Button
        label={last ? 'Узнать судьбу бункера' : 'Следующий раунд'}
        onPress={onNext}
        style={{ marginVertical: spacing.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.panel,
  },
  round: { color: colors.accent, fontWeight: '800', fontSize: 16 },
  stage: { color: colors.text, fontSize: 14, marginTop: 2 },
  seats: { color: colors.muted, fontSize: 13 },
  exit: { color: colors.bad, fontSize: 13, marginTop: 4 },
  content: { padding: spacing.lg },
  situation: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  situationTitle: { color: colors.accent, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 2 },
  needs: { color: colors.accent, fontSize: 14, marginTop: 6 },
  bunkerTitle: { color: colors.text, fontWeight: '700', marginTop: 8 },
  bunkerLine: { fontSize: 13, lineHeight: 19 },
  hint: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  muted: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  chat: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  msg: { marginBottom: spacing.sm },
  msgAuthor: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  msgText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.panelAlt,
    color: colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
  },
  tally: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
