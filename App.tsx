import React, { useEffect, useState } from 'react';
import { Alert, ImageBackground, StatusBar, StyleSheet, View } from 'react-native';
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
import { loadSaved, saveSaved } from './src/net/storage';
import { GameScreen } from './src/screens/GameScreen';
import { CreateRoomScreen, HomeScreen, JoinScreen, LocalSetupScreen } from './src/screens/MenuScreens';
import { RoomScreen } from './src/screens/RoomScreen';
import { colors, images } from './src/theme';

type Screen =
  | { name: 'home' }
  | { name: 'localSetup' }
  | { name: 'local'; game: GameState; key: number; players: number }
  | { name: 'create' }
  | { name: 'join' }
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSaved().then((s) => {
      if (s.name) setName(s.name);
      if (s.server) setServer(s.server);
      if (s.session) setSaved(s.session);
    });
  }, []);

  function go(next: Screen) {
    setError(null);
    setScreen(next);
  }

  function enterRoom(session: Session) {
    setSaved(session);
    saveSaved({ session });
    go({ name: 'room', session });
  }

  async function withServer(fn: (srv: string, playerName: string) => Promise<Session>) {
    const srv = normalizeServer(server);
    if (!srv) {
      setError('Сначала укажите адрес сервера на главном экране.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      enterRoom(await fn(srv, name.trim() || 'Игрок'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
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
          server={server}
          onServer={(v) => {
            setServer(v);
            saveSaved({ server: v.trim() });
          }}
          resumeCode={saved ? saved.code : null}
          onResume={() => saved && go({ name: 'room', session: saved })}
          onCreate={() => go({ name: 'create' })}
          onJoin={() => go({ name: 'join' })}
          onLocal={() => go({ name: 'localSetup' })}
        />
      );
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
          onBack={() => go({ name: 'home' })}
          onCreate={(settings: Partial<RoomSettings>) => withServer((srv, n) => createRoom(srv, n, settings))}
        />
      );
      break;
    case 'join':
      content = (
        <JoinScreen
          busy={busy}
          error={error}
          onBack={() => go({ name: 'home' })}
          onJoin={(code) => withServer((srv, n) => joinRoom(srv, code, n))}
        />
      );
      break;
    case 'room':
      content = (
        <RoomScreen
          key={screen.session.token}
          session={screen.session}
          onLeave={(reason) => {
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
