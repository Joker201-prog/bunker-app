/** Подписка на комнату: долгие запросы с переподключением и отправка действий. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomAction, RoomView } from '../game/room';
import { ApiError, pollState, sendAction, type Session } from './api';

export type Link = 'connecting' | 'online' | 'offline';

export function useRoom(session: Session, onGone: (reason: string) => void) {
  const [view, setView] = useState<RoomView | null>(null);
  const [link, setLink] = useState<Link>('connecting');
  const [clockOffset, setClockOffset] = useState(0);
  const versionRef = useRef(0);
  const goneRef = useRef(onGone);
  goneRef.current = onGone;

  useEffect(() => {
    let alive = true;
    let failures = 0;
    (async () => {
      while (alive) {
        try {
          const v = await pollState(session, versionRef.current);
          if (!alive) return;
          failures = 0;
          setLink('online');
          setClockOffset(v.serverTime - Date.now());
          if (v.version !== versionRef.current) {
            versionRef.current = v.version;
            setView(v);
          }
        } catch (e) {
          if (!alive) return;
          if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
            goneRef.current(e.message);
            return;
          }
          failures += 1;
          setLink('offline');
          await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * failures)));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  /** Отправить действие. Возвращает текст ошибки или null. */
  const send = useCallback(
    async (action: RoomAction): Promise<string | null> => {
      try {
        await sendAction(session, action);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Ошибка';
      }
    },
    [session],
  );

  return { view, link, clockOffset, send };
}
