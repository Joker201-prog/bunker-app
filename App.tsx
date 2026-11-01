import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RussoOne_400Regular } from '@expo-google-fonts/russo-one';
import { PTSans_400Regular, PTSans_700Bold } from '@expo-google-fonts/pt-sans';
import { PTMono_400Regular } from '@expo-google-fonts/pt-mono';
import { newGame } from './src/game/engine';
import type { GameState } from './src/game/types';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
    PTSans_400Regular,
    PTSans_700Bold,
    PTMono_400Regular,
  });
  const [game, setGame] = useState<GameState | null>(null);
  const [gameKey, setGameKey] = useState(0);

  if (!fontsLoaded) return <View style={styles.root} />;

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      {game ? (
        <GameScreen key={gameKey} initial={game} onExit={() => setGame(null)} />
      ) : (
        <HomeScreen
          onStart={(name, players) => {
            setGameKey((k) => k + 1);
            setGame(newGame({ humanName: name, players }));
          }}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
