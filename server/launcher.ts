/**
 * Запуск «всё в одном» для компьютера: игровой сервер + туннель tuna + запрет сна.
 * Вызывается из start.bat. Окно одно; закрыли окно — всё остановилось.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listen, PORT } from './server';

/** Папка пакета: …/ubezhishe-pc-server (launcher лежит в app/server). */
const HOME = process.env.UBEZHISHE_HOME || join(__dirname, '..', '..');
const TUNA = process.env.TUNA_BIN || 'tuna';
const RESTART_MS = 15_000;

const children = new Set<ChildProcess>();
let stopping = false;
let shownUrl = '';

function readSubdomain(): string {
  const file = join(HOME, 'subdomain.txt');
  if (!existsSync(file)) return '';
  const line = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)[0].trim();
  // В файл могли вписать адрес целиком: https://brave-otter-4821.ru.tuna.am
  const m = /^(?:https?:\/\/)?([a-z0-9-]+)(?:\.ru)?(?:\.tuna\.am)?\/?$/i.exec(line);
  return m ? m[1].toLowerCase() : '';
}

function banner(url: string) {
  const host = url.replace(/^https?:\/\//, '');
  const line = '='.repeat(Math.max(44, host.length + 8));
  console.log(
    [
      '',
      line,
      '  СЕРВЕР «УБЕЖИЩА» ДОСТУПЕН ИЗ ИНТЕРНЕТА',
      '',
      `  Адрес сервера:  ${host}`,
      '',
      '  В приложении: «Создать комнату» → «Через интернет»,',
      '  в поле «Адрес сервера» — этот адрес (один раз, потом он запомнится).',
      '  Друзей зовите кнопкой «Пригласить» в лобби — им ничего вводить не нужно.',
      '',
      '  Не закрывайте это окно, пока идёт игра.',
      line,
      '',
    ].join('\n'),
  );
}

function clean(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').trim();
}

function startTunnel(sub: string) {
  if (stopping) return;
  const args = ['http', String(PORT)];
  if (sub) args.push(`--subdomain=${sub}`);
  console.log(sub ? `Запускаем туннель tuna с постоянным адресом ${sub}…` : 'Запускаем туннель tuna…');

  let child: ChildProcess;
  try {
    child = spawn(TUNA, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch {
    return noTuna();
  }
  children.add(child);
  let output = '';
  let failed = false;

  const onData = (buf: Buffer) => {
    for (const raw of buf.toString('utf8').split(/\r?\n/)) {
      const text = clean(raw);
      if (!text) continue;
      output = (output + '\n' + text).slice(-2000);
      const url = /https:\/\/[a-z0-9.-]+\.tuna\.am/i.exec(text)?.[0];
      if (url && url !== shownUrl) {
        shownUrl = url;
        banner(url);
      } else if (/error|ошибк|failed|unauthori|login|token/i.test(text)) {
        console.log(`[tuna] ${text}`);
      }
    }
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  child.on('error', (e: NodeJS.ErrnoException) => {
    failed = true;
    children.delete(child);
    if (e.code === 'ENOENT') noTuna();
    else console.log(`Туннель не запустился: ${e.message}`);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (stopping || failed) return;
    shownUrl = '';
    console.log(`\nТуннель остановился (код ${code ?? '—'}).`);
    if (/login|unauthori|token/i.test(output)) {
      console.log('Похоже, tuna не авторизована. Откройте командную строку и выполните:  tuna login');
    }
    console.log(`Перезапускаем через ${RESTART_MS / 1000} с…`);
    setTimeout(() => startTunnel(sub), RESTART_MS);
  });
}

function noTuna() {
  console.log(
    [
      '',
      'Не найдена программа tuna — игра через интернет не заработает.',
      'Установите её по инструкции в README.txt и перезапустите start.bat.',
      'Сервер пока работает только в вашей домашней сети.',
      '',
    ].join('\n'),
  );
}

/** Windows: компьютер не уснёт, пока открыто окно сервера (экран гаснуть может). */
function keepAwake() {
  if (process.platform !== 'win32' || process.env.UBEZHISHE_ALLOW_SLEEP) return;
  const ps = [
    "$s = Add-Type -Name P -Namespace W -PassThru -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f);';",
    '[void]$s::SetThreadExecutionState([uint32]2147483649);', // ES_CONTINUOUS | ES_SYSTEM_REQUIRED
    `while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 20 }`,
  ].join(' ');
  try {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', () => children.delete(child));
    children.add(child);
    console.log('Компьютер не будет засыпать, пока открыто это окно.');
  } catch {
    // без запрета сна тоже работает
  }
}

function shutdown() {
  stopping = true;
  for (const c of children) {
    try {
      c.kill();
    } catch {
      // уже завершился
    }
  }
}

process.on('exit', shutdown);

listen(() => {
  keepAwake();
  startTunnel(readSubdomain());
});
