/**
 * Игровой экран (дизайн v2): шапка партии, стол с сеткой мини-досье, спор, голосование
 * «полароидами», протокол раунда. Главное действие — в нижней панели под большим пальцем.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse } from 'react-native-svg';
import { DeskButton, Paper } from '../components/Desk';
import { Dossier } from '../components/Dossier';
import { EventDetails } from '../components/EventSheet';
import { GameHeader } from '../components/StageBar';
import {
  BottomBar,
  CatastropheCard,
  clock,
  photoFor,
  PlayerGrid,
  SeatsStrip,
  TimerStamp,
} from '../components/TableParts';
import type { Action } from '../game/actions';
import {
  alivePlayers,
  canLeaveTable,
  currentTurn,
  eliminationsThisRound,
  isLastRound,
  pendingReveals,
  playerById,
  revealableKinds,
} from '../game/engine';
import type { CardKind, GameState, Player } from '../game/types';
import { useNotes } from '../hooks/useNotes';
import { colors, fonts, images, spacing } from '../theme';
import { DropIn, StampHit } from '../ui/anim';
import { claimBig, DUR, EASE_PAPER, haptic, isReduceMotion } from '../ui/motion';
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

function peopleWord(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'человека';
  return 'человек';
}

function votesWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'голос';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'голоса';
  return 'голосов';
}

function confirm(title: string, message: string, ok: string, onOk: () => void) {
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: ok, onPress: onOk },
  ]);
}

/** Высота нижней панели, чтобы содержимое не пряталось под ней. */
const BAR_SPACE = 120;

export function GameScreen({ game, viewerId, send, secondsLeft, onExit, exitWarning, online, finalActions }: Props) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const scrollRef = useRef<any>(null);
  const chatRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const me = game.players.find((p) => p.id === viewerId) ?? null;
  const isHost = game.hostId === viewerId;
  const numberOf = (id: string) => game.players.findIndex((p) => p.id === id) + 1;
  const { notes, setNote } = useNotes(game.id);
  const turn = game.stage === 'table' ? currentTurn(game) : null;
  const myTurn = !!me && me.alive && turn === me.id;

  // «Назад»: закрыть досье или сводку, иначе — спросить про выход из партии.
  const overlayRef = useRef({ viewing, showInfo });
  overlayRef.current = { viewing, showInfo };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlayRef.current.viewing) setViewing(null);
      else if (overlayRef.current.showInfo) setShowInfo(false);
      else confirmExit();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, exitWarning]);

  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setSelected(null);
    setViewing(null);
  }, [game.stage, game.round]);

  // Настал ваш ход — телефон вздрагивает, внизу появляется «Ваш ход».
  const wasMyTurn = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) haptic('medium');
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  function confirmExit() {
    Alert.alert('Выйти из партии?', exitWarning, [
      { text: 'Остаться', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: onExit },
    ]);
  }

  async function run(a: Action): Promise<boolean> {
    const err = await send(a);
    if (err) setNotice(err);
    return !err;
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

  const elims = eliminationsThisRound(game);
  const hostLabel = online ? (isHost ? 'вы ведущий' : `ведущий: ${online.hostName ?? '—'}`) : null;
  const grid = (
    <>
      <View style={styles.doorHead}>
        <Text style={styles.doorTitle}>У ДВЕРИ</Text>
        <Text style={styles.doorHint}>нажмите на досье</Text>
      </View>
      <PlayerGrid state={game} viewerId={viewerId} turnId={turn} notes={notes} onOpen={setViewing} />
      <OutsideLine game={game} onOpen={setViewing} />
    </>
  );
  const myDossierBtn = me ? (
    <DeskButton label="Моё досье" variant="secondary" size={15} onPress={() => setViewing(me.id)} style={styles.myBtn} />
  ) : null;

  let body: React.ReactNode = null;
  let bar: React.ReactNode = null;

  if (game.stage === 'table') {
    const turnPlayer = turn ? playerById(game, turn) : null;
    const done = canLeaveTable(game, viewerId);
    const waiting = pendingReveals(game);
    const hostCanGo = online ? true : done;
    let hint: string;
    if (!me) hint = turnPlayer ? `Ходит: ${turnPlayer.name}` : 'Все раскрыли карты.';
    else if (!me.alive) hint = 'Вы за дверью и наблюдаете за игрой.';
    else if (myTurn) hint = 'Ваш ход: раскройте одну карту в своём досье.';
    else if (turnPlayer) hint = `Ходит: ${turnPlayer.name}. Карты раскрывают по очереди.`;
    else hint = isHost ? 'Все раскрыли карты. Можно начинать спор.' : 'Все раскрыли карты. Ждём ведущего.';
    body = (
      <>
        <CatastropheCard state={game} />
        <SeatsStrip state={game} />
        <Text style={[styles.hint, myTurn && styles.hintMine]}>{hint}</Text>
        {isHost && online && turnPlayer && turnPlayer.isHuman && turnPlayer.id !== viewerId && (
          <Pressable onPress={() => run({ type: 'skipTurn' })} style={styles.smallLink} accessibilityRole="button">
            <Text style={styles.smallLinkText}>Пропустить ход: {turnPlayer.name}</Text>
          </Pressable>
        )}
        {grid}
      </>
    );
    bar = myTurn && me ? (
      <DeskButton label="Ваш ход — открыть досье" arrow onPress={() => setViewing(me.id)} />
    ) : (
      <View style={styles.barRow}>
        {myDossierBtn}
        {isHost ? (
          <DeskButton
            label="К обсуждению"
            disabled={!hostCanGo}
            style={styles.flex}
            onPress={() => {
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
        ) : (
          <Text style={[styles.barNote, styles.flex]}>Спор начнёт ведущий</Text>
        )}
      </View>
    );
  }

  if (game.stage === 'discussion') {
    body = (
      <>
        <View style={styles.timerRow}>
          <TimerStamp seconds={secondsLeft} size={68} />
          <View style={styles.flex}>
            <Text style={styles.question}>Кто нужнее бункеру?</Text>
            <TimerButtons
              isHost={isHost}
              seconds={secondsLeft}
              defaultSeconds={game.discussionSeconds}
              extendBy={30}
              onStart={() => run({ type: 'startTimer' })}
              onExtend={(sec) => run({ type: 'extend', seconds: sec })}
              idle="Таймер запустит ведущий."
            />
          </View>
        </View>

        <DropIn rotate="-0.4deg" style={styles.chatWrap}>
          <Paper padded={false}>
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
        </DropIn>

        {(me && me.alive) || isHost ? (
          <View style={styles.inputRow}>
            <Paper padded={false} style={styles.flex}>
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
            <DeskButton label="Сказать" onPress={sendMessage} style={styles.send} size={15} />
          </View>
        ) : (
          <Text style={styles.hint}>Вы за дверью и только наблюдаете.</Text>
        )}
        {grid}
      </>
    );
    bar = (
      <View style={styles.barRow}>
        {myDossierBtn}
        {isHost ? (
          <DeskButton label={elims > 0 ? 'К голосованию' : 'Завершить раунд'} style={styles.flex} onPress={() => run({ type: 'advance' })} />
        ) : (
          <Text style={[styles.barNote, styles.flex]}>Голосование откроет ведущий или таймер</Text>
        )}
      </View>
    );
  }

  if (game.stage === 'voting') {
    const canVote = !!me && me.alive;
    const myVote = game.votes[viewerId] && game.votes[viewerId] !== '?' ? game.votes[viewerId] : null;
    const humansAlive = alivePlayers(game).filter((p) => p.isHuman);
    const aliveCount = alivePlayers(game).length;
    const voted = humansAlive.filter((p) => !!game.votes[p.id]).length;
    const pending = humansAlive.length - voted;
    const marked = selected ?? myVote;
    const target = marked ? playerById(game, marked) : null;
    body = (
      <>
        <View style={styles.timerRow}>
          <TimerStamp seconds={secondsLeft} />
          <View style={styles.flex}>
            <Text style={styles.question}>Кто останется за дверью?</Text>
            <Text style={styles.sub}>
              {canVote ? 'Голос можно сменить до подсчёта. ' : me ? 'Вы за дверью и не голосуете. ' : ''}
              {online ? `Проголосовали ${voted} из ${humansAlive.length}.` : ''}
              {elims > 1 ? ` За дверью останутся ${elims} ${peopleWord(elims)}.` : ''}
            </Text>
            <TimerButtons
              isHost={isHost}
              seconds={secondsLeft}
              defaultSeconds={game.votingSeconds}
              extendBy={15}
              onStart={() => run({ type: 'startTimer' })}
              onExtend={(sec) => run({ type: 'extend', seconds: sec })}
            />
          </View>
        </View>
        <View style={styles.polaroids}>
          {alivePlayers(game)
            .filter((p) => p.id !== viewerId)
            .map((p, i) => (
              <Polaroid
                key={p.id}
                player={p}
                number={numberOf(p.id)}
                index={i}
                picked={marked === p.id}
                onPress={canVote ? () => setSelected(p.id) : undefined}
                onLongPress={() => setViewing(p.id)}
              />
            ))}
        </View>
        <Text style={styles.footNote}>Долгое нажатие на фото — открыть досье. Всего у двери {aliveCount}.</Text>
      </>
    );
    bar = (
      <>
        {canVote && (
          <DeskButton
            label={
              !target ? 'Выберите, против кого' : marked === myVote ? `Ваш голос: против ${target.name}` : `Голосую против: ${target.name}`
            }
            disabled={!selected || selected === myVote}
            onPress={() => {
              if (selected) {
                haptic('medium');
                run({ type: 'vote', target: selected });
              }
            }}
          />
        )}
        {isHost && online ? (
          <DeskButton
            label="Подсчитать голоса"
            variant="secondary"
            size={15}
            onPress={() => {
              if (pending > 0) {
                confirm('Подсчитать голоса?', `Ещё не проголосовали: ${pending}. Их голоса не будут учтены.`, 'Подсчитать', () =>
                  run({ type: 'advance' }),
                );
              } else run({ type: 'advance' });
            }}
          />
        ) : (
          <Text style={styles.barNote}>
            {online ? 'Голоса подсчитает ведущий или таймер' : 'Голоса подсчитаются, когда вы проголосуете'}
          </Text>
        )}
      </>
    );
  }

  if (game.stage === 'result') {
    const last = isLastRound(game);
    body = <ResultStage game={game} viewerId={viewerId} numberOf={numberOf} onOpen={setViewing} />;
    bar = isHost ? (
      <DeskButton label={last ? 'Узнать судьбу бункера' : 'Следующий раунд'} onPress={() => run({ type: 'advance' })} />
    ) : (
      <Text style={styles.barNote}>Ждём, пока ведущий продолжит</Text>
    );
  }

  const viewed = viewing ? game.players.find((p) => p.id === viewing) ?? null : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <GameHeader
          round={game.round}
          totalRounds={game.totalRounds}
          stage={game.stage}
          onExit={confirmExit}
          onInfo={() => setShowInfo(true)}
        />
        {online && (
          <Text style={styles.roomLine}>
            комната {online.code} · {hostLabel}
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BAR_SPACE }]}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>

      {!keyboard && bar && <BottomBar>{bar}</BottomBar>}

      {viewed && (
        <DossierOverlay
          game={game}
          player={viewed}
          number={numberOf(viewed.id)}
          mine={viewed.id === viewerId}
          myTurn={myTurn && viewed.id === viewerId}
          secondsLeft={secondsLeft}
          revealable={myTurn && viewed.id === viewerId && me ? revealableKinds(game, me) : []}
          note={notes[viewed.id]}
          onNote={(text) => setNote(viewed.id, text)}
          onReveal={async (kind) => {
            if (await run({ type: 'reveal', kind })) setTimeout(() => setViewing(null), 1100);
          }}
          onClose={() => setViewing(null)}
        />
      )}
      {showInfo && <InfoOverlay game={game} onClose={() => setShowInfo(false)} />}
    </KeyboardAvoidingView>
  );
}

/** Кто уже за дверью: одной строкой под сеткой. */
function OutsideLine({ game, onOpen }: { game: GameState; onOpen: (id: string) => void }) {
  const out = game.players.filter((p) => !p.alive);
  if (!out.length) return null;
  return (
    <View style={styles.outside}>
      <Text style={styles.outsideLabel}>За дверью: </Text>
      {out.map((p, i) => (
        <Pressable key={p.id} onPress={() => onOpen(p.id)} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.outsideName}>
            {p.name}
            {i < out.length - 1 ? ', ' : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Кнопки таймера для ведущего: запустить или добавить время. */
function TimerButtons({
  isHost,
  seconds,
  defaultSeconds,
  extendBy,
  onStart,
  onExtend,
  idle,
}: {
  isHost: boolean;
  seconds: number | null;
  defaultSeconds: number;
  extendBy: number;
  onStart: () => void;
  onExtend: (seconds: number) => void;
  idle?: string;
}) {
  if (!isHost) return seconds === null && idle ? <Text style={styles.sub}>{idle}</Text> : null;
  return (
    <Pressable
      onPress={() => (seconds === null ? onStart() : onExtend(extendBy))}
      accessibilityRole="button"
      style={({ pressed }) => [styles.timerBtn, pressed && styles.timerBtnPressed]}
    >
      <Text style={styles.timerBtnText}>{seconds === null ? `Запустить таймер · ${defaultSeconds} с` : `Добавить ${extendBy} с`}</Text>
    </Pressable>
  );
}

const POLA_TILTS = ['-1.5deg', '1deg', '-0.5deg', '2deg', '-1deg', '0.8deg', '-1.8deg', '1.2deg'];

/** Кандидат на голосовании: фото-«полароид», выбранный — красная рамка и штамп «ПРОТИВ». */
function Polaroid({
  player,
  number,
  index,
  picked,
  onPress,
  onLongPress,
}: {
  player: Player;
  number: number;
  index: number;
  picked: boolean;
  onPress?: () => void;
  onLongPress: () => void;
}) {
  const shake = useRef(new Animated.Value(0)).current;
  const wasPicked = useRef(picked);
  useEffect(() => {
    if (picked && !wasPicked.current && !isReduceMotion()) {
      // лист вздрагивает от удара печати
      Animated.sequence([
        Animated.delay(DUR.stamp * 0.6),
        Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
    wasPicked.current = picked;
  }, [picked, shake]);
  return (
    <DropIn index={index} rotate={POLA_TILTS[index % POLA_TILTS.length]} style={styles.polaWrap}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityState={{ selected: picked }}
        accessibilityLabel={`${number}, ${player.name}${picked ? ', выбран: против' : ''}`}
        accessibilityHint="Долгое нажатие открывает досье"
      >
        <Animated.View
          style={[
            styles.pola,
            picked && styles.polaPicked,
            { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) }] },
          ]}
        >
          <Image source={photoFor(player)} style={styles.polaPhoto} />
          <Text style={styles.polaName} numberOfLines={1}>
            {number} · {player.name}
          </Text>
        </Animated.View>
        {picked && <StampHit label="Против" size={17} rotate="-14deg" feel="medium" fill style={styles.polaStamp} />}
      </Pressable>
    </DropIn>
  );
}

/** Протокол раунда: палочки подсчёта ставятся по одной, потом — выбывший. */
function ResultStage({
  game,
  viewerId,
  numberOf,
  onOpen,
}: {
  game: GameState;
  viewerId: string;
  numberOf: (id: string) => number;
  onOpen: (id: string) => void;
}) {
  const result = game.results[game.results.length - 1];
  const leaving = result.eliminated.map((id) => playerById(game, id));
  const tally = Object.entries(result.tally)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalVotes = tally.reduce((s, [, n]) => s + n, 0);
  const myVote = game.votes[viewerId] && game.votes[viewerId] !== '?' ? game.votes[viewerId] : null;
  const alive = alivePlayers(game).length;

  // Порядок палочек: вперемешку по строкам.
  const order: Record<string, number[]> = {};
  let k = 0;
  const maxN = Math.max(0, ...tally.map(([, n]) => n));
  for (let i = 0; i < maxN; i++) {
    for (const [id, n] of tally) {
      if (i < n) (order[id] ||= []).push(k++);
    }
  }
  const total = k;
  const animRef = useRef<boolean | null>(null);
  if (animRef.current === null) animRef.current = total > 0 && !isReduceMotion() && claimBig(3500);
  const animate = animRef.current;
  const progress = useRef(new Animated.Value(animate ? 0 : total)).current;
  const circle = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [done, setDone] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const per = Math.min(DUR.vote, 3000 / Math.max(1, total));
    Animated.sequence([
      Animated.timing(progress, { toValue: total, duration: per * total, useNativeDriver: false }),
      Animated.delay(250),
      Animated.timing(circle, { toValue: 1, duration: 350, easing: EASE_PAPER, useNativeDriver: false }),
    ]).start(() => setDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const leaderId = tally.length ? tally[0][0] : null;
  const noVote = leaving.length === 0;

  return (
    <View>
      <View style={styles.resultHead}>
        <Text style={styles.resultTitle}>ИТОГИ РАУНДА {game.round}</Text>
        <Text style={styles.resultSub}>
          у двери {alive} · мест {game.seats}
        </Text>
      </View>

      <DropIn rotate="0.5deg" style={styles.protoWrap}>
        <Paper padded={false}>
          <View style={styles.proto}>
            <View style={styles.protoHead}>
              <Text style={styles.protoMeta}>ПРОТОКОЛ № {game.round}</Text>
              <Text style={styles.protoMeta}>{time}, бункер 7-Б</Text>
            </View>

            {noVote && <Text style={styles.protoText}>В этом раунде голосования не было — все остаются у двери.</Text>}

            {done &&
              leaving.map((p) => (
                <OutBlock
                  key={p.id}
                  game={game}
                  player={p}
                  number={numberOf(p.id)}
                  votes={result.tally[p.id] ?? 0}
                  totalVotes={totalVotes}
                  onOpen={() => onOpen(p.id)}
                />
              ))}
            {done && result.tieBroken && <Text style={styles.protoNote}>Голоса разделились поровну — решил жребий.</Text>}
            {done && result.shieldBlocked.length > 0 && (
              <Text style={styles.protoNote}>
                «Неприкосновенность» спасла: {result.shieldBlocked.map((id) => playerById(game, id).name).join(', ')}.
              </Text>
            )}

            {tally.length > 0 && (
              <View style={styles.votes}>
                <Text style={styles.protoMeta}>ГОЛОСА</Text>
                {tally.map(([id, n]) => {
                  const lead = id === leaderId || result.eliminated.includes(id);
                  const ink = done && lead ? colors.stamp : colors.ink;
                  return (
                    <View key={id} style={styles.tallyRow}>
                      <Text style={styles.tallyName} numberOfLines={1}>
                        {playerById(game, id).name}
                      </Text>
                      <View style={styles.marks}>
                        {(order[id] ?? []).map((idx, j) => (
                          <Animated.View
                            key={j}
                            style={[
                              styles.markStick,
                              {
                                backgroundColor: ink,
                                opacity: progress.interpolate({ inputRange: [idx, idx + 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
                                transform: [
                                  { rotate: `${[-4, 3, -2, 5, -3][j % 5]}deg` },
                                  { scaleY: progress.interpolate({ inputRange: [idx, idx + 1], outputRange: [0, 1], extrapolate: 'clamp' }) },
                                ],
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.tallyNumBox}>
                        {lead && (
                          <Svg width={34} height={28} style={StyleSheet.absoluteFill}>
                            <AnimatedEllipse
                              cx={17}
                              cy={14}
                              rx={14}
                              ry={11}
                              fill="none"
                              stroke={colors.stamp}
                              strokeWidth={1.8}
                              strokeDasharray="80 80"
                              strokeDashoffset={circle.interpolate({ inputRange: [0, 1], outputRange: [80, 0] })}
                              transform="rotate(-8 17 14)"
                            />
                          </Svg>
                        )}
                        <Text style={[styles.tallyNum, { color: ink }]}>{n}</Text>
                      </View>
                    </View>
                  );
                })}
                {myVote && <Text style={[styles.protoMeta, styles.gapTop]}>Вы голосовали против: {playerById(game, myVote).name}</Text>}
              </View>
            )}
          </View>
        </Paper>
        <Image source={images.tape} style={styles.protoTape} resizeMode="stretch" />
      </DropIn>

      {done && !isLastRound(game) && (
        <Text style={styles.nextLine}>Раунд {game.round + 1}: каждый раскрывает ещё одну карту.</Text>
      )}
    </View>
  );
}

const AnimatedEllipse: any = Animated.createAnimatedComponent(Ellipse as any);

/** Выбывший: фото выцветает в ч/б, бьёт печать «ВЫБЫЛ». */
function OutBlock({
  game,
  player,
  number,
  votes,
  totalVotes,
  onOpen,
}: {
  game: GameState;
  player: Player;
  number: number;
  votes: number;
  totalVotes: number;
  onOpen: () => void;
}) {
  const grey = useRef(new Animated.Value(isReduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (isReduceMotion()) return;
    Animated.timing(grey, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [grey]);
  // Что он успел показать до вылета — по журналу раскрытий.
  const shown: CardKind[] = [];
  for (const r of game.revealLog) if (r.playerId === player.id && !shown.includes(r.kind)) shown.push(r.kind);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityHint="Открывает досье" style={styles.outBlock}>
      <View style={styles.outPhotoWrap}>
        <View style={styles.outFrame}>
          <Image source={photoFor(player)} style={styles.outPhoto} />
          <Animated.Image source={photoFor(player)} style={[styles.outPhoto, styles.outPhotoGrey, { opacity: grey }]} />
          <Animated.View style={[styles.outTint, { opacity: grey }]} />
        </View>
        <StampHit label="Выбыл" size={21} rotate="-16deg" feel="double" fill style={styles.outStamp} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.outName}>
          № {number} · {player.name}
        </Text>
        <Text style={styles.protoText}>
          Остаётся за дверью.{totalVotes ? ` Против — ${votes} ${votesWord(votes)} из ${totalVotes}.` : ''}
        </Text>
        {shown.length > 0 && (
          <>
            <Text style={[styles.protoMeta, styles.gapTopSm]}>ЧТО УСПЕЛ ПОКАЗАТЬ</Text>
            {shown.slice(0, 5).map((k) => {
              const c = player.cards[k];
              return (
                <Text key={k} style={styles.shownLine} numberOfLines={1}>
                  — {c.title}
                </Text>
              );
            })}
          </>
        )}
      </View>
    </Pressable>
  );
}

/** Полное досье поверх стола. Своё — с полосой «Ваш ход». */
function DossierOverlay({
  game,
  player,
  number,
  mine,
  myTurn,
  secondsLeft,
  revealable,
  note,
  onNote,
  onReveal,
  onClose,
}: {
  game: GameState;
  player: Player;
  number: number;
  mine: boolean;
  myTurn: boolean;
  secondsLeft: number | null;
  revealable: CardKind[];
  note?: string;
  onNote: (text: string) => void;
  onReveal: (kind: CardKind) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <ImageBackground source={images.wood} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.overlayShade]} />
      <View style={[styles.overlayHead, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" style={styles.backBtn}>
          <Text style={styles.backText}>‹ Стол</Text>
        </Pressable>
        <Text style={styles.overlayTitle}>{mine ? 'ВАШЕ ДОСЬЕ' : `ДОСЬЕ № ${number}`}</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={[styles.overlayBody, { paddingBottom: insets.bottom + 32 }]}>
        {myTurn && (
          <View style={styles.turnStrip}>
            <Text style={styles.turnStripText}>
              <Text style={styles.bold}>Ваш ход.</Text> Раскройте одну карту — её увидят все.
            </Text>
            {secondsLeft !== null && <Text style={styles.turnClock}>{clock(secondsLeft)}</Text>}
          </View>
        )}
        <Dossier
          player={player}
          number={number}
          mine={mine}
          revealable={revealable}
          onReveal={onReveal}
          revealLog={game.revealLog}
          note={note}
          onNote={onNote}
        />
        {!mine && <Text style={styles.footNote}>Заметка видна только вам. Нажмите на карту, чтобы прочитать её описание.</Text>}
      </ScrollView>
    </View>
  );
}

/** «Положение дел»: катастрофа и бункер целиком. */
function InfoOverlay({ game, onClose }: { game: GameState; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <ImageBackground source={images.wood} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.overlayShade]} />
      <View style={[styles.overlayHead, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" style={styles.backBtn}>
          <Text style={styles.backText}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.overlayTitle}>ПОЛОЖЕНИЕ ДЕЛ</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={[styles.overlayBody, { paddingBottom: insets.bottom + 32 }]}>
        <DropIn rotate="0.5deg">
          <Paper>
            <Text style={styles.infoTitle}>{game.catastrophe.title}</Text>
            <EventDetails state={game} />
          </Paper>
        </DropIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  gapTop: { marginTop: spacing.sm },
  gapTopSm: { marginTop: 8 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 8 },
  roomLine: { fontFamily: fonts.type, fontSize: 12, color: colors.onWoodMuted, marginTop: 6, textAlign: 'center' },
  notice: { backgroundColor: colors.stamp, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  noticeText: { fontFamily: fonts.body, fontSize: 14, color: '#fff' },
  content: { paddingHorizontal: spacing.lg, paddingTop: 10 },

  hint: { fontFamily: fonts.type, fontSize: 13, lineHeight: 19, color: colors.onWoodSoft, marginTop: 12 },
  hintMine: { color: colors.onWoodBright, fontFamily: fonts.bold, fontSize: 14 },
  smallLink: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' },
  smallLinkText: { fontFamily: fonts.type, fontSize: 13, color: colors.onWood, textDecorationLine: 'underline' },
  doorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 },
  doorTitle: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5, color: colors.onWood },
  doorHint: { fontFamily: fonts.type, fontSize: 12, color: colors.onWoodSoft },
  outside: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  outsideLabel: { fontFamily: fonts.type, fontSize: 13, color: colors.onWoodSoft },
  outsideName: { fontFamily: fonts.type, fontSize: 13, color: colors.onWood, textDecorationLine: 'underline' },

  barRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  myBtn: { flexShrink: 0 },
  barNote: { fontFamily: fonts.type, fontSize: 12, color: colors.onWoodSoft, textAlign: 'center' },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  question: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, letterSpacing: 0.5, color: colors.onWoodBright },
  sub: { marginTop: 4, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.paper },
  timerBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.amber,
    borderRadius: 2,
  },
  timerBtnPressed: { backgroundColor: 'rgba(224, 164, 58, 0.25)' },
  timerBtnText: { fontFamily: fonts.displayMed, fontSize: 13, letterSpacing: 1, color: colors.amber, textTransform: 'uppercase' },

  chatWrap: { marginTop: 14 },
  chat: { height: 240 },
  chatContent: { padding: spacing.lg, gap: spacing.sm },
  systemMsg: { fontFamily: fonts.type, fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  msg: { fontFamily: fonts.type, fontSize: 14, lineHeight: 20, color: colors.ink },
  author: { fontFamily: fonts.bold, color: colors.stampBlue },
  authorMine: { color: colors.stamp },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch', marginTop: spacing.md },
  input: { fontFamily: fonts.type, fontSize: 15, color: colors.ink, paddingHorizontal: spacing.md, minHeight: 54 },
  send: { width: 112 },

  polaroids: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, marginHorizontal: -5 },
  polaWrap: { width: '33.33%', paddingHorizontal: 5, paddingBottom: 14 },
  pola: {
    backgroundColor: colors.paperWhite,
    padding: 5,
    paddingBottom: 0,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 3,
    borderColor: 'transparent',
  },
  polaPicked: { borderColor: colors.stampDark },
  polaPhoto: { width: '100%', height: 96 },
  polaName: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, textAlign: 'center', paddingVertical: 5, letterSpacing: 0.5 },
  polaStamp: { position: 'absolute', top: 36, alignSelf: 'center' },
  footNote: { fontFamily: fonts.type, fontSize: 12, lineHeight: 17, color: colors.onWoodSoft, marginTop: 4, textAlign: 'center' },

  resultHead: { alignItems: 'center', marginTop: 4 },
  resultTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.onWood },
  resultSub: { fontFamily: fonts.type, fontSize: 12, color: colors.onWoodSoft },
  protoWrap: { marginTop: 22 },
  proto: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 },
  protoTape: { position: 'absolute', top: -14, alignSelf: 'center', width: 130, height: 28, transform: [{ rotate: '-3deg' }] },
  protoHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  protoMeta: { fontFamily: fonts.type, fontSize: 11, color: colors.inkSoft },
  protoText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.ink, marginTop: 4 },
  protoNote: { fontFamily: fonts.type, fontSize: 12, lineHeight: 17, color: colors.inkSoft, marginTop: 6 },
  outBlock: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  outPhotoWrap: { alignItems: 'center' },
  outFrame: {
    backgroundColor: colors.paperWhite,
    padding: 5,
    paddingBottom: 16,
    transform: [{ rotate: '-2deg' }],
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
  },
  outPhoto: { width: 94, height: 112 },
  outPhotoGrey: { position: 'absolute', left: 5, top: 5, filter: [{ grayscale: 1 }], opacity: 0 } as any,
  outStamp: { position: 'absolute', top: 44 },
  outTint: { position: 'absolute', left: 5, top: 5, width: 94, height: 112, backgroundColor: 'rgba(110, 104, 96, 0.28)' },
  outName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 27, color: colors.ink },
  shownLine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  votes: { marginTop: 8, borderTopWidth: 1.5, borderTopColor: colors.ink, paddingTop: 10 },
  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34, borderBottomWidth: 1, borderBottomColor: colors.paperLine },
  tallyName: { width: 92, fontFamily: fonts.type, fontSize: 14, color: colors.ink },
  marks: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
  markStick: { width: 3, height: 18, borderRadius: 1 },
  tallyNumBox: { width: 34, height: 28, alignItems: 'center', justifyContent: 'center' },
  tallyNum: { fontFamily: fonts.display, fontSize: 16 },
  nextLine: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.paper, marginTop: 18, paddingHorizontal: 4 },

  overlay: { zIndex: 20, elevation: 20 },
  overlayShade: { backgroundColor: 'rgba(18, 10, 5, 0.5)' },
  overlayHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 48 },
  backBtn: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  backText: { fontFamily: fonts.type, fontSize: 15, color: colors.onWood },
  overlayTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.onWood },
  overlayBody: { paddingHorizontal: 14, paddingTop: 6 },
  turnStrip: {
    marginTop: 6,
    backgroundColor: colors.stampBlue,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 4,
  },
  turnStripText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 18, color: colors.onWoodBright },
  turnClock: { fontFamily: fonts.type, fontSize: 16, color: colors.onWoodBright },
  infoTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.ink },
});
