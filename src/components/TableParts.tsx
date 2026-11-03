/**
 * Детали стола (дизайн v2): сводка катастрофы, полоса мест, мини-досье игроков,
 * нижняя панель действий и таймеры.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutAnimation, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIND_LABEL, KIND_ORDER, TAG_LABEL } from '../data/cards';
import { monthsText } from '../game/engine';
import type { CardKind, GameState, Player } from '../game/types';
import { colors, fonts, hashIndex, images, spacing } from '../theme';
import { DropIn, useLampFlicker, useSwing } from '../ui/anim';
import { claimBig, DUR, EASE_PAPER, haptic, isReduceMotion } from '../ui/motion';
import { Paper } from './Desk';
import { EventDetails } from './EventSheet';

export function photoFor(p: Player) {
  const set = p.photo && p.photo[0] === 'f' ? images.photos.f : images.photos.m;
  const idx = Number(p.photo ? p.photo.slice(1) : hashIndex(p.id, set.length)) || 0;
  return set[idx % set.length];
}

const TILTS = ['-0.8deg', '0.7deg', '0.5deg', '-0.6deg', '-0.4deg', '0.9deg', '0.6deg', '-0.7deg'];
export function gridTilt(i: number): string {
  return TILTS[i % TILTS.length];
}

export function seatsWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'место';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'места';
  return 'мест';
}

/* ---------- Сводка катастрофы ---------- */

/** Партии, у которых сводка уже разворачивалась (анимация — один раз за партию). */
const unfolded = new Set<string>();

export function CatastropheCard({ state }: { state: GameState }) {
  const c = state.catastrophe;
  const [open, setOpen] = useState(false);
  const play = state.round === 1 && state.stage === 'table' && !unfolded.has(state.id) && !isReduceMotion();
  const unfold = useRef(new Animated.Value(play ? 0 : 1)).current;
  const [typed, setTyped] = useState(play ? 0 : c.title.length);

  useEffect(() => {
    if (!play || !claimBig(2000)) {
      unfolded.add(state.id);
      unfold.setValue(1);
      setTyped(c.title.length);
      return;
    }
    unfolded.add(state.id);
    Animated.timing(unfold, { toValue: 1, duration: 300, easing: EASE_PAPER, useNativeDriver: true }).start();
    // Машинка допечатывает название.
    const step = Math.max(25, Math.min(60, 1400 / Math.max(1, c.title.length)));
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= c.title.length) clearInterval(id);
    }, step);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.create(DUR.sheet, 'easeInEaseOut', 'opacity'));
    setOpen((v) => !v);
  }

  return (
    <Animated.View style={{ transform: [{ scaleY: unfold }], opacity: unfold }}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Paper rotate="0.6deg" padded={false}>
          <View style={styles.cat}>
            <View style={styles.catHead}>
              <View style={styles.catStamp}>
                <Text style={styles.catStampText}>КАТАСТРОФА</Text>
              </View>
              <Text style={styles.more}>{open ? 'свернуть' : 'подробнее'}</Text>
            </View>
            <Text style={styles.catTitle}>{c.title.slice(0, typed)}</Text>
            <View style={styles.chips}>
              <Text style={styles.chip}>сложность {'■'.repeat(c.difficulty)}{'□'.repeat(3 - c.difficulty)}</Text>
              <Text style={styles.chip}>{monthsText(c.months)} внутри</Text>
              <Text style={[styles.chip, styles.chipNeed]}>нужны: {c.needs.map((n) => TAG_LABEL[n]).join(', ')}</Text>
            </View>
            {open && <EventDetails state={state} />}
          </View>
        </Paper>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- Полоса мест ---------- */

export function SeatsStrip({ state }: { state: GameState }) {
  const alive = state.players.filter((p) => p.alive).length;
  const out = state.players.length - alive;
  return (
    <View style={styles.seats} accessibilityLabel={`Мест в бункере: ${state.seats}. У двери ${alive}, выбыло ${out}.`}>
      <View style={styles.seatsText}>
        <Text style={styles.seatsBig}>
          {state.seats} {seatsWord(state.seats).toUpperCase()}
        </Text>
        <Text style={styles.seatsSmall}>у двери {alive}</Text>
      </View>
      <View style={styles.seatBox}>
        {Array.from({ length: state.seats }, (_, i) => (
          <View key={i} style={styles.seat} />
        ))}
      </View>
      <Text style={styles.seatsSmall}>выбыло {out}</Text>
    </View>
  );
}

/* ---------- Мини-досье ---------- */

/** Последняя открытая карта игрока: по журналу раскрытий, иначе — последняя по порядку. */
export function lastOpened(state: GameState, p: Player): CardKind | null {
  const log = state.revealLog.filter((r) => r.playerId === p.id);
  if (log.length) return log[log.length - 1].kind;
  for (let i = KIND_ORDER.length - 1; i >= 0; i--) if (p.revealed[KIND_ORDER[i]]) return KIND_ORDER[i];
  return null;
}

export function MiniDossier({
  state,
  player,
  number,
  index,
  me,
  turn,
  note,
  onPress,
}: {
  state: GameState;
  player: Player;
  number: number;
  index: number;
  me: boolean;
  turn: boolean;
  note?: string;
  onPress: () => void;
}) {
  const open = KIND_ORDER.filter((k) => player.revealed[k]).length;
  const last = lastOpened(state, player);
  const card = last ? player.cards[last] : null;
  const glow = useLampFlicker(turn);
  const swing = useSwing(turn);
  const rot = gridTilt(index);

  return (
    <DropIn index={index} rotate={rot} style={styles.miniWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Досье № ${number}, ${player.name}${me ? ', это вы' : ''}${turn ? ', сейчас ходит' : ''}. Открыто карт: ${open} из 9.`}
      >
        {turn && <Animated.View pointerEvents="none" style={[styles.turnRing, { opacity: glow }]} />}
        <Paper padded={false}>
          <View style={styles.mini}>
            <View style={styles.miniHead}>
              <View style={styles.miniPhotoFrame}>
                <Image source={photoFor(player)} style={styles.miniPhoto} />
              </View>
              <View style={styles.miniInfo}>
                <Text style={styles.miniNum}>№ {number}</Text>
                <Text style={styles.miniName} numberOfLines={1}>
                  {player.name}
                </Text>
                <View style={styles.ticks}>
                  {KIND_ORDER.map((k) => (
                    <View key={k} style={[styles.tick, player.revealed[k] && styles.tickOn]} />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.miniLast}>
              {card && last ? (
                <>
                  <Text style={styles.miniKind}>{KIND_LABEL[last]}</Text>
                  <Text style={styles.miniCard} numberOfLines={2}>
                    {card.title}
                  </Text>
                </>
              ) : (
                <Text style={styles.miniKind}>ещё ничего не открыто</Text>
              )}
            </View>
          </View>
        </Paper>
        {note ? (
          <Text style={styles.miniNote} numberOfLines={1}>
            {note.length > 14 ? note.slice(0, 13) + '…' : note}
          </Text>
        ) : null}
        {me && (
          <View style={[styles.tag, styles.tagMe]}>
            <Text style={styles.tagText}>ЭТО ВЫ</Text>
          </View>
        )}
        {turn && (
          <Animated.View style={[styles.tag, styles.tagTurn, me && styles.tagTurnShift, { transform: [{ rotate: swing }] }]}>
            <Text style={styles.tagText}>ХОДИТ</Text>
          </Animated.View>
        )}
      </Pressable>
    </DropIn>
  );
}

/** Сетка мини-досье в 2 столбца. Выбывшие уходят со стола, остальные съезжаются. */
export function PlayerGrid({
  state,
  viewerId,
  turnId,
  notes,
  onOpen,
}: {
  state: GameState;
  viewerId: string;
  turnId: string | null;
  notes: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  const alive = state.players.filter((p) => p.alive);
  const key = alive.map((p) => p.id).join(',');
  const prev = useRef(key);
  if (prev.current !== key) {
    prev.current = key;
    if (!isReduceMotion()) LayoutAnimation.configureNext(LayoutAnimation.create(DUR.sheet, 'easeInEaseOut', 'opacity'));
  }
  return (
    <View style={styles.grid}>
      {alive.map((p, i) => (
        <View key={p.id} style={styles.cell}>
          <MiniDossier
            state={state}
            player={p}
            number={state.players.indexOf(p) + 1}
            index={i}
            me={p.id === viewerId}
            turn={turnId === p.id}
            note={notes[p.id]}
            onPress={() => onOpen(p.id)}
          />
        </View>
      ))}
    </View>
  );
}

/* ---------- Нижняя панель ---------- */

export function BottomBar({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['rgba(22,13,7,0)', 'rgba(22,13,7,0.92)', 'rgba(22,13,7,0.96)']}
      locations={[0, 0.34, 1]}
      style={[styles.bottom, { paddingBottom: insets.bottom + 18 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

/* ---------- Таймеры ---------- */

export function clock(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Вибрация «3, 2, 1» в конце таймера. */
function useCountdownHaptics(seconds: number | null) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (seconds !== null && seconds !== last.current && seconds >= 1 && seconds <= 3) haptic('heavy');
    last.current = seconds;
  }, [seconds]);
}

/** Максимум секунд, виденный с запуска таймера: от него считается кольцо. */
function useTotal(seconds: number | null): number {
  const total = useRef(0);
  if (seconds === null) total.current = 0;
  else if (seconds > total.current) total.current = seconds;
  return Math.max(1, total.current);
}

/**
 * Круглый штамп-таймер: кольцо убывает линейно; за 10 с янтарь сменяется красным,
 * цифры пульсируют; если ведущий добавил время — кольцо отматывается назад.
 */
export function TimerStamp({ seconds, size = 78 }: { seconds: number | null; size?: number }) {
  const total = useTotal(seconds);
  const frac = seconds === null ? 1 : Math.max(0, Math.min(1, seconds / total));
  const ring = useRef(new Animated.Value(frac)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const prevSec = useRef<number | null>(seconds);
  useCountdownHaptics(seconds);

  useEffect(() => {
    const back = prevSec.current !== null && seconds !== null && seconds > prevSec.current;
    prevSec.current = seconds;
    if (isReduceMotion()) {
      ring.setValue(frac);
    } else {
      Animated.timing(ring, {
        toValue: frac,
        duration: back ? 450 : 1000,
        easing: back ? Easing.bezier(0.34, 1.56, 0.64, 1) : Easing.linear,
        useNativeDriver: false,
      }).start();
    }
    if (seconds !== null && seconds <= 10 && seconds > 0 && !isReduceMotion()) {
      pulse.setValue(1.12);
      Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [seconds, frac, ring, pulse]);

  const low = seconds !== null && seconds <= 10;
  const color = low ? colors.stampDark : colors.amber;
  const r = size / 2 - 3;
  const len = 2 * Math.PI * r;
  return (
    <View
      style={[styles.timerStamp, { width: size, height: size }]}
      accessibilityLabel={seconds === null ? 'Таймер не запущен' : `Осталось ${seconds} секунд`}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(234,220,191,0.2)" strokeWidth={3} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Animated.Text style={[styles.timerNum, low && styles.timerNumLow, { transform: [{ scale: pulse }] }]}>
        {seconds === null ? '—:—' : clock(seconds)}
      </Animated.Text>
      <Text style={[styles.timerLabel, { color }]}>{seconds === null ? 'ТАЙМЕР' : 'ОСТАЛОСЬ'}</Text>
    </View>
  );
}

const AnimatedCircle: any = Animated.createAnimatedComponent(Circle as any);

const styles = StyleSheet.create({
  cat: { paddingHorizontal: 14, paddingVertical: 12 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  catStamp: { borderWidth: 2.5, borderColor: colors.stamp, paddingHorizontal: 7, transform: [{ rotate: '-3deg' }] },
  catStampText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.5, color: colors.stamp },
  more: { fontFamily: fonts.type, fontSize: 12, color: colors.inkSoft, textDecorationLine: 'underline' },
  catTitle: { marginTop: 8, fontFamily: fonts.display, fontSize: 25, lineHeight: 28, color: colors.ink, minHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    fontFamily: fonts.type,
    fontSize: 12,
    color: colors.ink,
    borderWidth: 1,
    borderColor: '#8f7f62',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipNeed: { color: colors.stamp, borderColor: colors.stamp },

  seats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  seatsText: { minWidth: 82 },
  seatsBig: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.2, color: colors.onWood },
  seatsSmall: { fontFamily: fonts.type, fontSize: 12, color: colors.onWoodSoft },
  seatBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    borderWidth: 1.5,
    borderColor: colors.amber,
    borderStyle: 'dashed',
    borderRadius: 3,
    flexShrink: 1,
  },
  seat: { width: 22, height: 22, backgroundColor: 'rgba(224, 164, 58, 0.18)', borderWidth: 1, borderColor: colors.amber },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '50%', paddingHorizontal: 5, paddingTop: 12 },
  miniWrap: {},
  mini: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 9 },
  miniHead: { flexDirection: 'row', gap: 9 },
  miniPhotoFrame: {
    backgroundColor: colors.paperWhite,
    padding: 3,
    paddingBottom: 7,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  miniPhoto: { width: 40, height: 46 },
  miniInfo: { flex: 1, minWidth: 0 },
  miniNum: { fontFamily: fonts.type, fontSize: 11, color: colors.inkSoft },
  miniName: { fontFamily: fonts.display, fontSize: 17, lineHeight: 21, color: colors.ink },
  ticks: { flexDirection: 'row', gap: 2, marginTop: 5 },
  tick: { width: 7, height: 9, borderWidth: 1, borderColor: colors.ink },
  tickOn: { backgroundColor: colors.ink },
  miniLast: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.paperLine, paddingTop: 5, minHeight: 44 },
  miniKind: { fontFamily: fonts.type, fontSize: 11, color: colors.inkSoft },
  miniCard: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.ink },
  miniNote: {
    position: 'absolute',
    right: 10,
    bottom: 4,
    fontFamily: fonts.hand,
    fontSize: 18,
    color: colors.stampBlue,
    transform: [{ rotate: '-6deg' }],
    backgroundColor: 'rgba(226, 211, 178, 0.85)',
    paddingHorizontal: 3,
  },
  turnRing: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: colors.amber,
    borderRadius: 3,
  },
  tag: { position: 'absolute', top: -9, right: 8, paddingHorizontal: 7, paddingVertical: 2 },
  tagMe: { backgroundColor: colors.stamp },
  tagTurn: { backgroundColor: colors.stampBlue },
  tagTurnShift: { right: 76 },
  tagText: { fontFamily: fonts.displayMed, fontSize: 11, letterSpacing: 1, color: colors.onWoodBright },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 30, paddingHorizontal: spacing.lg, gap: 8 },

  timerStamp: { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  timerNum: { fontFamily: fonts.type, fontSize: 21, color: colors.onWoodBright, lineHeight: 24 },
  timerNumLow: { color: '#ffb2a6' },
  timerLabel: { fontFamily: fonts.displayMed, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
});
