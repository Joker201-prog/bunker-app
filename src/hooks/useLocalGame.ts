/** Одиночная партия с ботами: те же действия, что и в сети, но прямо на телефоне. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction, tick, type Action } from '../game/actions';
import type { GameState } from '../game/types';

export const LOCAL_PLAYER = 'human';

export function useLocalGame(initial: GameState) {
  const [state, setState] = useState(initial);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    const id = setInterval(() => setState((s) => tick(s, Date.now())), 500);
    return () => clearInterval(id);
  }, []);

  const send = useCallback(async (a: Action): Promise<string | null> => {
    // Сначала проверяем по текущему состоянию, чтобы сразу вернуть ошибку.
    const check = applyAction(ref.current, LOCAL_PLAYER, a, Date.now());
    if (!check.ok) return check.error;
    setState((s) => {
      const r = applyAction(s, LOCAL_PLAYER, a, Date.now());
      return r.ok ? r.state : s;
    });
    return null;
  }, []);

  return { state, send };
}
