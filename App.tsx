import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { newGame } from './src/game/engine';
import type { GameState } from './src/game/types';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/theme';

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [gameKey, setGameKey] = useState(0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      {game ? (
        <GameScreen key={gameKey} initial={game} onExit={() => setGame(null)} />
      ) : (
        <HomeScreen
          onStart={(name, players) => {
            setGameKey((k) => k + 1);
            setGame(newGame({ humanName: name || 'Вы', players }));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
