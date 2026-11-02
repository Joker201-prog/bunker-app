import React, { useEffect, useRef, useState } from 'react';
import { Alert, ImageBackground, Linking, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Oswald_500Medium, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { PTSans_400Regular, PTSans_700Bold } from '@expo-google-fonts/pt-sans';
import { PTMono_400Regular } from '@expo-google-fonts/pt-mono';
import { DeskButton } from './src/components/Desk';
import { secondsLeft } from './src/game/actions';
import { newGame } from './src/game/engine';
import type { RoomSettings } from './src/game/room';
import type { GameState } from './src/game/types';
import { LOCAL_PLAYER, useLocalGame } from './src/hooks/useLocalGame';
import { createRoom, DEFAULT_SERVER, joinRoom, normalizeServer, type Session } from './src/net/api';
import { parseInvite } from './src/net/invite';
import { findLanRoom, startLanHost, stopLanHost } from './src/net/lan';
import { loadSaved, saveSaved } from './src/net/storage';
import { GameScreen } from './src/screens/GameScreen';
import { CreateRoomScreen, HomeScreen, JoinScreen, LocalSetupScreen, type RoomPlace } from './src/screens/MenuScreens';
import { InfoScreen } from './src/screens/InfoScreen';
import { RoomScreen } from './src/screens/RoomScreen';
import { colors, images } from './src/theme';

type Screen =
  | { name: 'home' }
  | { name: 'info' }
  | { name: 'localSetup' }
  | { name: 'local'; game: GameState; key: number; players: number }
  | { name: 'create' }
  | { name: 'join'; code?: string; invited?: boolean }
  | { name: 'room'; session: Session };

export default function App() {
  const [fontsLoaded] = useFonts({
    Oswald_500Medium,
    Oswald_700Bold,
    PTSans_400Regular,
    PTSans_700Bold,
    PTMono_400Regular,
  });
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [name, setName] = useState('');
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [saved, setSaved] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const screenRef = useRef<Screen>(screen);
  screenRef.current = screen;

  // Приглашение по ссылке: ubezhishe://join?server=…&code=1234 — открываем вход с готовым кодом и адресом.
  function openInvite(url: string | null) {
    const invite = parseInvite(url);
    if (!invite) return;
    const cur = screenRef.current.name;
    if (cur === 'room' || cur === 'local') {
      Alert.alert('Приглашение в комнату ' + invite.code, 'Сначала выйдите из текущей игры, затем откройте ссылку снова.');
      return;
    }
    setServer(invite.server);
    saveSaved({ server: invite.server });
    setError(null);
    setScreen({ name: 'join', code: invite.code, invited: true });
  }

  useEffect(() => {
    loadSaved()
      .then((s) => {
        if (s.name) setName(s.name);
        if (s.server) setServer(s.server);
        if (s.session) setSaved(s.session);
      })
      .then(() => Linking.getInitialURL())
      .then(openInvite)
      .catch(() => {});
    const sub = Linking.addEventListener('url', (e: { url: string }) => openInvite(e.url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(next: Screen) {
    setError(null);
    setScreen(next);
  }

  function enterRoom(session: Session) {
    // Комнату, которую держит этот телефон, после перезапуска приложения не вернуть: сервер останавливается.
    if (!session.lanHost) {
      setSaved(session);
      saveSaved({ session });
    }
    go({ name: 'room', session });
  }

  function updateServer(v: string) {
    setServer(v);
    saveSaved({ server: v.trim() });
  }

  async function attempt(fn: (playerName: string) => Promise<Session>) {
    setBusy(true);
    setProgress(null);
    setError(null);
    try {
      enterRoom(await fn(name.trim() || 'Игрок'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function onlineServer(): string {
    const srv = normalizeServer(server);
    if (!srv) throw new Error('Укажите адрес сервера.');
    return srv;
  }

  function create(place: RoomPlace, settings: Partial<RoomSettings>) {
    attempt(async (n) => {
      if (place === 'online') return createRoom(onlineServer(), n, settings);
      const base = await startLanHost();
      try {
        const session = await createRoom(base, n, settings);
        return { ...session, lan: true, lanHost: true };
      } catch (e) {
        stopLanHost();
        throw e;
      }
    });
  }

  function join(code: string) {
    attempt(async (n) => {
      if (code.length === 4) return joinRoom(onlineServer(), code, n);
      setProgress('Ищем комнату в вашей Wi-Fi сети…');
      const base = await findLanRoom(code, (checked, total) =>
        setProgress(`Ищем комнату в вашей Wi-Fi сети… проверено ${checked} из ${total} адресов`),
      );
      setProgress('Комната найдена, входим…');
      const session = await joinRoom(base, code, n);
      return { ...session, lan: true };
    });
  }

  if (!fontsLoaded) return <View style={styles.root} />;

  let content: React.ReactNode;
  switch (screen.name) {
    case 'home':
      content = (
        <HomeScreen
          name={name}
          onName={(v) => {
            setName(v);
            saveSaved({ name: v });
          }}
          resumeCode={saved ? saved.code : null}
          onResume={() => saved && go({ name: 'room', session: saved })}
          onCreate={() => go({ name: 'create' })}
          onJoin={() => go({ name: 'join' })}
          onLocal={() => go({ name: 'localSetup' })}
          onInfo={() => go({ name: 'info' })}
        />
      );
      break;
    case 'info':
      content = <InfoScreen onBack={() => go({ name: 'home' })} />;
      break;
    case 'localSetup':
      content = (
        <LocalSetupScreen
          onBack={() => go({ name: 'home' })}
          onStart={(players) =>
            go({ name: 'local', players, key: Date.now(), game: newGame({ humanName: name, players }) })
          }
        />
      );
      break;
    case 'local':
      content = (
        <LocalGame
          key={screen.key}
          initial={screen.game}
          onExit={() => go({ name: 'home' })}
          onAgain={() =>
            go({ ...screen, key: Date.now(), game: newGame({ humanName: name, players: screen.players }) })
          }
        />
      );
      break;
    case 'create':
      content = (
        <CreateRoomScreen
          busy={busy}
          error={error}
          server={server}
          onServer={updateServer}
          onBack={() => go({ name: 'home' })}
          onCreate={create}
        />
      );
      break;
    case 'join':
      content = (
        <JoinScreen
          key={screen.code ?? 'join'}
          initialCode={screen.code}
          invited={screen.invited}
          name={name}
          onName={(v) => {
            setName(v);
            saveSaved({ name: v });
          }}
          busy={busy}
          progress={progress}
          error={error}
          server={server}
          onServer={updateServer}
          onBack={() => go({ name: 'home' })}
          onJoin={join}
        />
      );
      break;
    case 'room':
      content = (
        <RoomScreen
          key={screen.session.token}
          session={screen.session}
          onLeave={(reason) => {
            if (screen.session.lanHost) stopLanHost();
            setSaved(null);
            saveSaved({ session: null });
            go({ name: 'home' });
            if (reason) Alert.alert('Комната', reason);
          }}
        />
      );
      break;
  }

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Деревянный стол лежит под всеми экранами и не прокручивается вместе с ними. */}
      <ImageBackground source={images.wood} resizeMode="cover" style={styles.root}>
        {content}
      </ImageBackground>
    </SafeAreaProvider>
  );
}

/** Одиночная партия: игрок и ведущий — это вы, остальные — боты. */
function LocalGame({ initial, onExit, onAgain }: { initial: GameState; onExit: () => void; onAgain: () => void }) {
  const { state, send } = useLocalGame(initial);
  return (
    <GameScreen
      game={state}
      viewerId={LOCAL_PLAYER}
      send={send}
      secondsLeft={secondsLeft(state)}
      onExit={onExit}
      exitWarning="Прогресс партии будет потерян."
      finalActions={
        <>
          <DeskButton label="Сыграть ещё раз" onPress={onAgain} />
          <DeskButton label="На главный экран" variant="secondary" onPress={onExit} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.wood },
});
