/**
 * Личные заметки игрока о других участниках партии. Хранятся только на этом телефоне
 * и никуда не отправляются. Привязаны к id партии, поэтому переживают перезапуск приложения.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'ubezhishe/notes/';
const KEEP_GAMES = 20;

export function useNotes(gameId: string) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setNotes({});
    AsyncStorage.getItem(PREFIX + gameId)
      .then((raw) => {
        if (alive && raw) setNotes(JSON.parse(raw));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gameId]);

  const setNote = useCallback(
    (playerId: string, text: string) => {
      setNotes((cur) => {
        const next = { ...cur };
        if (text) next[playerId] = text;
        else delete next[playerId];
        AsyncStorage.setItem(PREFIX + gameId, JSON.stringify(next))
          .then(() => trimOld(gameId))
          .catch(() => {});
        return next;
      });
    },
    [gameId],
  );

  return { notes, setNote };
}

/** Не копить заметки бесконечно: оставляем последние партии. */
async function trimOld(currentId: string) {
  try {
    const listKey = PREFIX + '_list';
    const raw = await AsyncStorage.getItem(listKey);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [currentId, ...list.filter((id) => id !== currentId)];
    for (const id of next.slice(KEEP_GAMES)) await AsyncStorage.removeItem(PREFIX + id);
    await AsyncStorage.setItem(listKey, JSON.stringify(next.slice(0, KEEP_GAMES)));
  } catch {
    // хранилище недоступно — не страшно
  }
}
