/** Запоминаем адрес сервера, имя и последнюю комнату между запусками приложения. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from './api';

const KEY = 'ubezhishe/v1';

export interface Saved {
  server?: string;
  name?: string;
  session?: Session | null;
}

export async function loadSaved(): Promise<Saved> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

export async function saveSaved(patch: Saved): Promise<void> {
  try {
    const cur = await loadSaved();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {
    // Хранилище недоступно — просто не запоминаем.
  }
}
