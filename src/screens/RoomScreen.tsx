import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeskButton, Paper, Stamp, Tape } from '../components/Desk';
import { secondsLeft } from '../game/actions';
import { MIN_PLAYERS } from '../game/engine';
import { lobbyAdmin, type RoomAction, type RoomView } from '../game/room';
import type { Session } from '../net/api';
import { useRoom } from '../net/useRoom';
import { colors, fonts, spacing } from '../theme';
import { GameScreen } from './GameScreen';

const MODE_TEXT = {
  creator: 'ведёт создатель комнаты',
  random: 'ведущий выбирается жребием при старте',
  vote: 'ведущего выбирают голосованием',
};

export function RoomScreen({
  session,
  onLeave,
}: {
  session: Session;
  /** Выйти на главный экран. reason — если комнату закрыли или выгнали. */
  onLeave: (reason?: string) => void;
}) {
  const { view, link, clockOffset, send } = useRoom(session, (reason) => onLeave(reason));
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const inDiscussion = view?.game?.stage === 'discussion';
  useEffect(() => {
    if (!inDiscussion) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [inDiscussion]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4500);
    return () => clearTimeout(id);
  }, [error]);

  async function run(a: RoomAction): Promise<string | null> {
    const err = await send(a);
    if (err) setError(err);
    return err;
  }

  async function leave() {
    await send({ type: 'leave' });
    onLeave();
  }

  if (!view) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.onWood} size="large" />
        <Text style={styles.loadingText}>
          {link === 'offline' ? 'Нет связи с сервером, пробуем снова…' : `Подключаемся к комнате ${session.code}…`}
        </Text>
        <DeskButton label="На главный экран" variant="secondary" onPress={() => onLeave()} style={styles.loadingBtn} />
      </View>
    );
  }

  if (view.game) {
    const host = view.members.find((m) => m.id === view.hostId);
    const isHost = view.hostId === view.you;
    return (
      <GameScreen
        game={view.game}
        viewerId={view.you}
        send={(a) => run(a)}
        secondsLeft={secondsLeft(view.game, now + clockOffset)}
        onExit={leave}
        exitWarning={
          isHost
            ? 'Роль ведущего перейдёт другому игроку, а за вас доиграет бот.'
            : 'За вас доиграет бот. Вернуться в эту партию будет нельзя.'
        }
        online={{ code: view.code, hostName: host ? host.name : null, linkOk: link !== 'offline' }}
        finalActions={
          <>
            {isHost ? (
              <DeskButton label="Вернуть всех в лобби" onPress={() => run({ type: 'toLobby' })} />
            ) : (
              <Text style={styles.woodNote}>Ждём, пока ведущий вернёт всех в лобби для новой партии.</Text>
            )}
            <DeskButton label="Выйти из комнаты" variant="secondary" onPress={leave} />
          </>
        }
      />
    );
  }

  return <Lobby view={view} linkOk={link !== 'offline'} error={error} run={run} onLeave={leave} />;
}

function Lobby({
  view,
  linkOk,
  error,
  run,
  onLeave,
}: {
  view: RoomView;
  linkOk: boolean;
  error: string | null;
  run: (a: RoomAction) => Promise<string | null>;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const admin = lobbyAdmin(view as any) === view.you;
  const isHost = view.hostId === view.you;
  const voteMode = view.settings.hostMode === 'vote';
  const participants = view.members.length - (view.settings.hostPlays ? 0 : 1);
  const canStart = participants >= MIN_PLAYERS;

  function confirmLeave() {
    Alert.alert('Выйти из комнаты?', 'Чтобы вернуться, понадобится снова ввести код.', [
      { text: 'Остаться', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: onLeave },
    ]);
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmLeave();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function memberActions(m: RoomView['members'][number]) {
    const out: { label: string; onPress: () => void }[] = [];
    if (voteMode && !m.isBot) {
      out.push({ label: view.myHostVote === m.id ? 'Ваш выбор' : 'Выбрать', onPress: () => run({ type: 'voteHost', id: m.id }) });
    }
    if (isHost && view.settings.hostMode === 'creator' && !m.isBot && m.id !== view.you) {
      out.push({
        label: 'Сделать ведущим',
        onPress: () =>
          Alert.alert('Передать роль ведущего?', `${m.name} будет вести партию.`, [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Передать', onPress: () => run({ type: 'transferHost', id: m.id }) },
          ]),
      });
    }
    if (admin && m.id !== view.you) out.push({ label: 'Убрать', onPress: () => run({ type: 'kick', id: m.id }) });
    return out;
  }

  let waitText: string;
  if (admin) {
    waitText = canStart
      ? 'Когда все соберутся, начните партию.'
      : `Нужно хотя бы ${MIN_PLAYERS} игрока${view.settings.hostPlays ? '' : ' без учёта ведущего'}. Позовите друзей или добавьте ботов.`;
  } else if (view.settings.hostMode === 'random') {
    waitText = 'Ведущий будет выбран жребием, когда создатель начнёт партию.';
  } else if (voteMode) {
    waitText = 'Проголосуйте, кто будет вести. Партию начнёт создатель комнаты.';
  } else {
    waitText = 'Ждём, пока ведущий начнёт партию.';
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
    >
      <Pressable onPress={confirmLeave} hitSlop={12} style={styles.back} accessibilityRole="button">
        <Text style={styles.backText}>← Выйти из комнаты</Text>
      </Pressable>

      <Text style={styles.heading}>Комната</Text>
      <Tape label={`Код: ${view.code}`} size={36} rotate="-2deg" style={styles.codeTape} />
      <Text style={styles.woodNote}>Сообщите код друзьям: в приложении «Войти по коду».</Text>
      {!linkOk && <Text style={styles.offline}>Нет связи с сервером, переподключаемся…</Text>}

      <Paper rotate="-0.5deg" style={styles.list}>
        <Stamp label="У двери" size={17} rotate="-3deg" />
        <Text style={styles.settings}>
          {MODE_TEXT[view.settings.hostMode]}; ведущий {view.settings.hostPlays ? 'тоже играет' : 'не играет'}; на
          обсуждение {view.settings.discussionSeconds} с.
        </Text>
        {view.members.map((m, i) => {
          const marks = [
            m.id === view.you ? 'вы' : null,
            m.id === view.hostId ? 'ведущий' : null,
            m.id === view.creatorId && m.id !== view.hostId ? 'создатель' : null,
            m.isBot ? 'бот' : null,
          ].filter(Boolean);
          const actions = memberActions(m);
          return (
            <View key={m.id} style={styles.member}>
              <View style={styles.memberHead}>
                <Text style={[styles.dot, { color: m.online ? colors.good : colors.paperLine }]}>●</Text>
                <Text style={styles.memberName} numberOfLines={1}>
                  {i + 1}. {m.name}
                </Text>
                {marks.length > 0 && <Text style={styles.memberMarks}>{marks.join(', ')}</Text>}
              </View>
              {voteMode && !m.isBot && (
                <Text style={styles.memberVotes}>Голосов за ведущего: {m.hostVotes}</Text>
              )}
              {actions.length > 0 && (
                <View style={styles.memberActions}>
                  {actions.map((a) => (
                    <Pressable key={a.label} onPress={a.onPress} hitSlop={6} accessibilityRole="button">
                      <Text style={styles.memberAction}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </Paper>

      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.woodText}>{waitText}</Text>

      {admin && (
        <>
          <DeskButton label="Добавить бота" variant="secondary" onPress={() => run({ type: 'addBot' })} style={styles.btn} />
          <DeskButton label="Начать партию" disabled={!canStart} onPress={() => run({ type: 'start' })} style={styles.btn} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { fontFamily: fonts.type, fontSize: 15, color: colors.onWood, marginTop: spacing.lg, textAlign: 'center' },
  loadingBtn: { marginTop: spacing.xl, alignSelf: 'stretch' },
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.onWoodMuted },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.onWood,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  codeTape: { marginTop: spacing.md },
  woodText: { fontFamily: fonts.type, fontSize: 15, lineHeight: 22, color: colors.onWood, marginTop: spacing.lg },
  woodNote: { fontFamily: fonts.type, fontSize: 13, lineHeight: 19, color: colors.onWoodMuted, marginTop: spacing.md, textAlign: 'center' },
  offline: { fontFamily: fonts.body, fontSize: 14, color: '#ffb3a8', textAlign: 'center', marginTop: spacing.sm },
  list: { marginTop: spacing.xl },
  settings: { fontFamily: fonts.type, fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: spacing.md, marginBottom: spacing.sm },
  member: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.paperLine },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { fontSize: 12 },
  memberName: { flexShrink: 1, fontFamily: fonts.type, fontSize: 16, color: colors.ink },
  memberMarks: { fontFamily: fonts.type, fontSize: 13, color: colors.stamp },
  memberVotes: { fontFamily: fonts.type, fontSize: 13, color: colors.inkSoft, marginLeft: 20, marginTop: 2 },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginLeft: 20, marginTop: 4 },
  memberAction: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.stampBlue,
    textTransform: 'uppercase',
    borderWidth: 1.5,
    borderColor: colors.stampBlue,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#fff',
    backgroundColor: colors.stamp,
    padding: spacing.md,
    borderRadius: 3,
    marginTop: spacing.lg,
  },
  btn: { marginTop: spacing.md },
});
