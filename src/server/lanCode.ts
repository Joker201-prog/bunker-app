/**
 * Коды комнат в Wi-Fi сети. Пятизначный код = последнее число IP-адреса телефона-сервера
 * (три цифры) + две случайные. По нему другой телефон из той же сети сразу знает адрес.
 * Если адрес телефона неизвестен (бывает в режиме точки доступа), первые три цифры — 000,
 * и приложение ищет комнату перебором адресов своей подсети.
 */

export const LAN_PORT = 47842;
export const LAN_CODE_LENGTH = 5;

export function isLanCode(code: string): boolean {
  return /^\d{5}$/.test(code);
}

/** Частный адрес IPv4 (домашние сети и точки доступа). */
export function isPrivateIp(ip: string | null | undefined): ip is string {
  if (!ip) return false;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function makeLanCode(hostIp: string | null | undefined, rnd: () => number = Math.random): string {
  const tail = String(Math.floor(rnd() * 100)).padStart(2, '0');
  if (!isPrivateIp(hostIp)) return '000' + tail;
  const last = Number(hostIp.split('.')[3]);
  return String(last).padStart(3, '0') + tail;
}

/** Последнее число адреса из кода или null, если его нужно искать перебором. */
export function hostOctetFromCode(code: string): number | null {
  if (!isLanCode(code)) return null;
  const n = Number(code.slice(0, 3));
  return n >= 1 && n <= 254 ? n : null;
}

/**
 * Адреса, где стоит искать комнату, в порядке вероятности:
 * адрес из кода, затем «.1» (так обычно адресует себя телефон с точкой доступа), затем вся подсеть.
 */
export function candidateHosts(myIp: string, code: string): string[] {
  const parts = myIp.split('.');
  if (parts.length !== 4) return [];
  const prefix = parts.slice(0, 3).join('.');
  const first: number[] = [];
  const octet = hostOctetFromCode(code);
  if (octet !== null) first.push(octet);
  if (!first.includes(1)) first.push(1);
  const rest: number[] = [];
  for (let i = 1; i <= 254; i++) if (!first.includes(i)) rest.push(i);
  return [...first, ...rest].map((n) => `${prefix}.${n}`);
}
