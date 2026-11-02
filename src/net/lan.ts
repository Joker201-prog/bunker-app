/**
 * Игра в одной Wi-Fi сети: телефон, создавший комнату, сам становится сервером,
 * остальные находят его по пятизначному коду.
 */
import * as Network from 'expo-network';
import { GameServer, randomString } from '../server/core';
import { serveHttp, type NetLike } from '../server/httpOverTcp';
import { candidateHosts, isPrivateIp, LAN_PORT, makeLanCode } from '../server/lanCode';

let running: { stop: () => void } | null = null;

/** Адрес этого телефона в локальной сети или null. */
export async function getLanIp(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    return isPrivateIp(ip) ? ip : null;
  } catch {
    return null;
  }
}

/** Запустить сервер комнаты на этом телефоне. Возвращает адрес, по которому к нему обращается сам телефон. */
export async function startLanHost(): Promise<string> {
  if (!running) {
    const ip = await getLanIp();
    const game = new GameServer({
      newCode: (taken) => {
        for (let i = 0; i < 100; i++) {
          const code = makeLanCode(ip);
          if (!taken(code)) return code;
        }
        throw new Error('Не удалось подобрать код комнаты');
      },
      newId: () => 'm-' + randomString(10),
      newToken: () => randomString(24),
      maxRooms: 3,
    });
    // Модуль сокетов загружается только здесь: если он недоступен, падает лишь эта функция, а не всё приложение.
    let net: NetLike;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('react-native-tcp-socket');
      net = (mod.default ?? mod) as NetLike;
      if (typeof net.createServer !== 'function') throw new Error('no createServer');
    } catch {
      throw new Error('Этот телефон не может держать комнату в Wi-Fi сети. Создайте комнату через интернет или на другом телефоне.');
    }
    game.start();
    try {
      const srv = await serveHttp(net, game, LAN_PORT);
      running = {
        stop: () => {
          srv.stop();
          game.stop();
        },
      };
    } catch (e) {
      game.stop();
      throw new Error('Не удалось запустить комнату на телефоне. Перезапустите приложение и попробуйте снова.');
    }
  }
  return `http://127.0.0.1:${LAN_PORT}`;
}

export function stopLanHost() {
  running?.stop();
  running = null;
}

async function ping(host: string, code: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${host}:${LAN_PORT}/api/rooms/${code}/ping`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Найти телефон с комнатой в своей сети. Сначала проверяет адрес из кода
 * и адрес точки доступа, затем всю подсеть пачками.
 */
export async function findLanRoom(code: string, onProgress?: (checked: number, total: number) => void): Promise<string> {
  const myIp = await getLanIp();
  if (!myIp) {
    throw new Error('Телефон не в Wi-Fi сети. Подключитесь к той же сети, что и ведущий, или к его точке доступа.');
  }
  const hosts = candidateHosts(myIp, code);
  for (const h of hosts.slice(0, 2)) {
    if (await ping(h, code, 2500)) return `http://${h}:${LAN_PORT}`;
  }
  const rest = hosts.slice(2);
  const BATCH = 48;
  for (let i = 0; i < rest.length; i += BATCH) {
    onProgress?.(2 + i, hosts.length);
    const batch = rest.slice(i, i + BATCH);
    const found = await Promise.all(batch.map((h) => ping(h, code, 1500).then((ok) => (ok ? h : null))));
    const hit = found.find(Boolean);
    if (hit) return `http://${hit}:${LAN_PORT}`;
  }
  throw new Error(
    'Комната не найдена в этой сети. Проверьте код и что вы подключены к той же Wi-Fi сети, что и ведущий. ' +
      'У ведущего приложение должно быть открыто.',
  );
}
