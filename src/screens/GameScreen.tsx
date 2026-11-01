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
import type { Action } from '../game/actions';
import {
  alivePlayers,
  canLeaveTable,
  eliminationsThisRound,
  isLastRound,
  pendingReveals,
  playerById,
  revealableKinds,
} from '../game/engine';
import type { GameState } from '../game/types';
import { colors, fonts, spacing } from '../theme';
import { FinalScreen } from './FinalScreen';

export interface OnlineInfo {
  code: string;
  hostName: string | null;
  linkOk: boolean;
}

interface Props {
  game: GameState;
  /** Кто смотрит на экран. Ведущий, который не играет, тоже здесь, но его нет среди игроков. */
  viewerId: string;
  send: (a: Action) => Promise<string | null>;
  secondsLeft: number | null;
  /** Выйти из партии (одиночная — на главный экран, сетевая — из комнаты). */
  onExit: () => void;
  exitWarning: string;
  online?: OnlineInfo;
  /** Кнопки под итоговым отчётом. */
  finalActions: React.ReactNode;
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

function confirm(title: string, message: string, ok: string, onOk: () => void) {
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: ok, onPress: onOk },
  ]);
}

export function GameScreen({ game, viewerId, send, secondsLeft, onExit, exitWarning, online, finalActions }: Props) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showSituation, setShowSituation] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const chatRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const me = game.players.find((p) => p.id === viewerId) ?? null;
  const isHost = game.hostId === viewerId;
  const numberOf = (id: string) => game.players.findIndex((p) => p.id === id) + 1;

  function confirmExit() {
    Alert.alert('Выйти из партии?', exitWarning, [
      { text: 'Остаться', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: onExit },
    ]);
  }

  // «Назад» не закрывает приложение посреди партии.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmExit();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, exitWarning]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setSelected(null);
    if (game.stage !== 'table') setShowSituation(false);
  }, [game.stage, game.round]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  async function run(a: Action) {
    const err = await send(a);
    if (err) setNotice(err);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    run({ type: 'chat', text });
  }

  if (game.stage === 'final') {
    return <FinalScreen state={game} viewerId={viewerId} actions={finalActions} />;
  }

  const alive = alivePlayers(game);
  const elims = eliminationsThisRound(game);
  const hostLabel = online
    ? isHost
      ? 'Вы ведущий'
      : `Ведущий: ${online.hostName ?? '—'}`
    : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <GameHeader round={game.round} totalRounds={game.totalRounds} stage={game.stage} onExit={confirmExit} />
        {online && (
          <Text style={styles.roomLine}>
            Комната {online.code} · {hostLabel}
            {online.linkOk ? '' : ' · нет связи, переподключаемся…'}
          </Text>
        )}
      </View>

      {notice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <EventSheet state={game} expanded={showSituation} onToggle={() => setShowSituation((v) => !v)} />
        <Tape
          label={`Участники: ${alive.length} · ${game.seats} ${seatsWord(game.seats)}`}
          size={24}
          rotate="-2deg"
          style={styles.tape}
        />

        {game.stage === 'table' && (
          <TableStage
            game={game}
            viewerId={viewerId}
            isHost={isHost}
            online={!!online}
            numberOf={numberOf}
            onReveal={(kind) => run({ type: 'reveal', kind })}
            onContinue={() => {
              const waiting = pendingReveals(game);
              if (online && waiting.length) {
                confirm(
                  'Не все раскрыли карту',
                  `Ещё не выбрали: ${waiting.map((p) => p.name).join(', ')}. Им раскроется первая доступная карта.`,
                  'Начать',
                  () => run({ type: 'advance' }),
                );
              } else run({ type: 'advance' });
            }}
          />
        )}

        {game.stage === 'discussion' && (
          <View>
            <View style={styles.timerRow}>
              <WoodHeading style={styles.noMargin}>Обсуждение</WoodHeading>
              {secondsLeft !== null && (
                <Text style={[styles.timer, secondsLeft <= 10 && styles.timerLow]}>{clock(secondsLeft)}</Text>
              )}
            </View>

            <Paper rotate="-0.4deg" padded={false}>
              <ScrollView
                ref={chatRef}
                style={styles.chat}
                contentContainerStyle={styles.chatContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: false })}
              >
                {game.chat.map((m) => {
                  if (m.authorId === null) {
                    return (
                      <Text key={m.id} style={styles.systemMsg}>
                        — {m.text} —
                      </Text>
                    );
                  }
                  const author = game.players.find((p) => p.id === m.authorId);
                  const mine = m.authorId === viewerId;
                  const name = mine ? 'Вы' : author ? author.name : m.authorId === game.hostId ? 'Ведущий' : 'Игрок';
                  return (
                    <Text key={m.id} style={styles.msg}>
                      <Text style={[styles.author, mine && styles.authorMine]}>
                        {name}
                        {m.authorId === game.hostId && !mine ? ' (ведущий)' : ''}:{' '}
                      </Text>
                      {m.text}
                    </Text>
                  );
                })}
              </ScrollView>
            </Paper>

            {(me && me.alive) || isHost ? (
              <View style={styles.inputRow}>
                <Paper padded={false} style={styles.inputPaper}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={me && me.alive ? 'Чем вы полезны бункеру?' : 'Слово ведущего'}
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

            {isHost ? (
              <View style={styles.hostRow}>
                <DeskButton
                  label={elims > 0 ? 'Голосовать' : 'Завершить раунд'}
                  variant="secondary"
                  onPress={() => run({ type: 'advance' })}
                  style={styles.flex}
                />
                <DeskButton
                  label="+30 с"
                  variant="secondary"
                  onPress={() => run({ type: 'extend', seconds: 30 })}
                  style={styles.extend}
                />
              </View>
            ) : (
              <Text style={styles.woodNote}>Голосование откроет ведущий или таймер.</Text>
            )}

            <WoodHeading>Досье</WoodHeading>
            {game.players.map((p) => (
              <Dossier
                key={p.id}
                player={p}
                number={numberOf(p.id)}
                showAll={p.id === viewerId}
                secretHint={p.id === viewerId}
              />
            ))}
          </View>
        )}

        {game.stage === 'voting' && (
          <VotingStage
            game={game}
            viewerId={viewerId}
            isHost={isHost}
            online={!!online}
            elims={elims}
            selected={selected}
            onSelect={setSelected}
            numberOf={numberOf}
            onVote={(target) => run({ type: 'vote', target })}
            onCount={(pending) => {
              if (pending > 0) {
                confirm(
                  'Подсчитать голоса?',
                  `Ещё не проголосовали: ${pending}. Их голоса не будут учтены.`,
                  'Подсчитать',
                  () => run({ type: 'advance' }),
                );
              } else run({ type: 'advance' });
            }}
          />
        )}

        {game.stage === 'result' && (
          <ResultStage
            game={game}
            isHost={isHost}
            numberOf={numberOf}
            last={isLastRound(game)}
            onNext={() => run({ type: 'advance' })}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TableStage({
  game,
  viewerId,
  isHost,
  online,
  numberOf,
  onReveal,
  onContinue,
}: {
  game: GameState;
  viewerId: string;
  isHost: boolean;
  online: boolean;
  numberOf: (id: string) => number;
  onReveal: (kind: any) => void;
  onContinue: () => void;
}) {
  const me = game.players.find((p) => p.id === viewerId) ?? null;
  const revealable = me && me.alive ? revealableKinds(game, me) : [];
  const done = canLeaveTable(game, viewerId);
  const humansAlive = alivePlayers(game).filter((p) => p.isHuman);
  const waiting = pendingReveals(game);

  let hint: string;
  if (!me) hint = 'Вы ведущий и не играете. Начните обсуждение, когда все раскроют карты.';
  else if (!me.alive) hint = 'Вы за дверью и наблюдаете за игрой.';
  else if (done) hint = isHost ? 'Карта открыта.' : 'Карта открыта. Ждём, пока ведущий начнёт обсуждение.';
  else if (game.round === 1) hint = 'Первый раунд: нажмите «Раскрыть» у профессии.';
  else hint = 'Нажмите «Раскрыть» у одной карты — её увидят все.';

  const others = game.players.filter((p) => p.id !== viewerId);
  // В одиночной игре ведущий — сам игрок: сначала он раскрывает карту.
  const hostCanGo = online ? true : done;

  return (
    <View>
      <Text style={styles.woodText}>{hint}</Text>
      {me && (
        <>
          <WoodHeading>Ваше досье</WoodHeading>
          <Dossier player={me} number={numberOf(me.id)} showAll secretHint revealable={revealable} onReveal={onReveal} />
        </>
      )}
      {isHost && (
        <>
          {online && (
            <Text style={styles.woodNote}>
              Раскрыли карту: {humansAlive.length - waiting.length} из {humansAlive.length}
            </Text>
          )}
          <DeskButton label="Начать обсуждение" onPress={onContinue} disabled={!hostCanGo} style={styles.block} />
        </>
      )}
      <WoodHeading>{me ? 'Остальные' : 'Игроки'}</WoodHeading>
      {others.map((p) => (
        <Dossier key={p.id} player={p} number={numberOf(p.id)} />
      ))}
    </View>
  );
}

function VotingStage({
  game,
  viewerId,
  isHost,
  online,
  elims,
  selected,
  onSelect,
  numberOf,
  onVote,
  onCount,
}: {
  game: GameState;
  viewerId: string;
  isHost: boolean;
  online: boolean;
  elims: number;
  selected: string | null;
  onSelect: (id: string) => void;
  numberOf: (id: string) => number;
  onVote: (target: string) => void;
  onCount: (pending: number) => void;
}) {
  const me = game.players.find((p) => p.id === viewerId) ?? null;
  const canVote = !!me && me.alive;
  const myVote = game.votes[viewerId] && game.votes[viewerId] !== '?' ? game.votes[viewerId] : null;
  const humansAlive = alivePlayers(game).filter((p) => p.isHuman);
  const voted = humansAlive.filter((p) => !!game.votes[p.id]).length;
  const pending = humansAlive.length - voted;
  const marked = selected ?? myVote;

  let hint: string;
  if (!canVote) hint = me ? 'Вы за дверью. Остальные голосуют без вас.' : 'Игроки голосуют. Подсчитайте голоса, когда все будут готовы.';
  else if (elims === 1) hint = 'В этом раунде за дверью останется один человек. Нажмите на досье того, против кого голосуете.';
  else hint = `В этом раунде за дверью останутся ${elims} ${peopleWord(elims)}. Нажмите на досье того, против кого голосуете.`;

  return (
    <View>
      <WoodHeading>Кого не пускаем?</WoodHeading>
      <Text style={styles.woodText}>{hint}</Text>
      {online && (
        <Text style={styles.woodNote}>
          Проголосовали: {voted} из {humansAlive.length}
          {myVote ? ` · ваш голос против: ${playerById(game, myVote).name}` : ''}
        </Text>
      )}
      {alivePlayers(game)
        .filter((p) => p.id !== viewerId)
        .map((p) => (
          <Dossier
            key={p.id}
            player={p}
            number={numberOf(p.id)}
            marked={marked === p.id}
            onPress={canVote ? () => onSelect(p.id) : undefined}
          />
        ))}
      {canVote && (
        <DeskButton
          label={myVote ? 'Изменить голос' : 'Проголосовать'}
          onPress={() => selected && onVote(selected)}
          disabled={!selected || selected === myVote}
          style={styles.block}
        />
      )}
      {isHost && online && (
        <DeskButton label="Подсчитать голоса" variant="secondary" onPress={() => onCount(pending)} style={styles.block} />
      )}
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
  game,
  isHost,
  numberOf,
  last,
  onNext,
}: {
  game: GameState;
  isHost: boolean;
  numberOf: (id: string) => number;
  last: boolean;
  onNext: () => void;
}) {
  const result = game.results[game.results.length - 1];
  const leaving = result.eliminated.map((id) => playerById(game, id));
  const tally = Object.entries(result.tally)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <View>
      {leaving.length === 0 ? (
        <Text style={styles.woodText}>В этом раунде голосования не было — все остаются у двери.</Text>
      ) : (
        <Paper rotate="-0.8deg" style={styles.protocol}>
          <Stamp label={`Протокол раунда ${game.round}`} size={17} rotate="-3deg" />
          <Text style={[styles.protoLine, styles.gapTop]}>
            Дверь закрывается перед: <Text style={styles.protoStrong}>{leaving.map((p) => p.name).join(', ')}</Text>
          </Text>
          {result.tieBroken && <Text style={styles.protoNote}>Голоса разделились поровну — решил жребий.</Text>}
          {result.shieldBlocked.length > 0 && (
            <Text style={styles.protoNote}>
              «Неприкосновенность» спасла: {result.shieldBlocked.map((id) => playerById(game, id).name).join(', ')}.
            </Text>
          )}
          <Text style={[styles.protoSub, styles.gapTop]}>Голоса:</Text>
          {tally.map(([id, n]) => (
            <View key={id} style={styles.tallyRow}>
              <Text style={[styles.tallyName, result.eliminated.includes(id) && styles.tallyOut]} numberOfLines={1}>
                {playerById(game, id).name}
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

      {isHost ? (
        <DeskButton label={last ? 'Узнать судьбу бункера' : 'Следующий раунд'} onPress={onNext} style={styles.block} />
      ) : (
        <Text style={styles.woodNote}>Ждём, пока ведущий продолжит.</Text>
      )}
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
  roomLine: { fontFamily: fonts.type, fontSize: 13, color: colors.onWoodMuted, marginTop: spacing.sm, textAlign: 'center' },
  notice: { backgroundColor: colors.stamp, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  noticeText: { fontFamily: fonts.body, fontSize: 14, color: '#fff' },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  tape: { marginTop: spacing.lg, marginBottom: spacing.xs },
  noMargin: { marginTop: 0, marginBottom: 0 },
  woodText: { fontFamily: fonts.type, fontSize: 15, lineHeight: 22, color: colors.onWood, marginTop: spacing.md },
  woodNote: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.onWoodMuted, marginTop: spacing.md },
  block: { marginTop: spacing.md, marginBottom: spacing.md },
  gapTop: { marginTop: spacing.md },
  hostRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  extend: { width: 96 },

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
