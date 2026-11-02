// Проверка сервера «в этой сети»: тот же HTTP-слой, что на телефоне, но на модуле net из Node.
//   tsc -p tsconfig.engine.json --typeRoots /opt/npm-tools/node_modules/@types && node scripts/lan-test.js
const net = require('net');
const path = require('path');
const out = path.join(__dirname, '..', '.build');
const { GameServer, randomString } = require(out + '/server/core');
const { serveHttp } = require(out + '/server/httpOverTcp');
const L = require(out + '/server/lanCode');

const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const PORT = 47999;
const BASE = `http://127.0.0.1:${PORT}`;
const post = async (p, body) => (await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const state = async (s, since = 0) => (await fetch(`${BASE}/api/rooms/${s.code}/state?token=${encodeURIComponent(s.token)}&since=${since}`)).json();
const act = (s, action) => post(`/api/rooms/${s.code}/action`, { token: s.token, action });

// Коды
check(L.makeLanCode('192.168.1.37', () => 0.42) === '03742', 'код из адреса');
check(L.makeLanCode(null, () => 0.05) === '00005', 'код без адреса');
check(L.makeLanCode('8.8.8.8', () => 0.5) === '00050', 'публичный адрес не кодируется');
check(L.hostOctetFromCode('03742') === 37 && L.hostOctetFromCode('00012') === null, 'разбор кода');
const cand = L.candidateHosts('192.168.1.80', '03742');
check(cand[0] === '192.168.1.37' && cand[1] === '192.168.1.1' && cand.length === 254 && new Set(cand).size === 254, 'порядок поиска');
check(L.isLanCode('12345') && !L.isLanCode('1234'), 'длина кода');

async function main() {
  const game = new GameServer({
    newCode: () => L.makeLanCode('192.168.1.37'),
    newId: () => 'm-' + randomString(10),
    newToken: () => randomString(24),
  });
  game.start();
  const srv = await serveHttp(net, game, PORT);
  try {
    const h = await (await fetch(BASE + '/health')).json();
    check(h.ok, 'health');

    // Кириллица в теле запроса и разбитый на куски запрос
    const host = await post('/api/rooms', { name: 'Павел Ёлкин', settings: { hostMode: 'creator', hostPlays: true } });
    check(host.ok && /^037\d\d$/.test(host.code), 'создание комнаты: ' + JSON.stringify(host));
    const ping = await (await fetch(`${BASE}/api/rooms/${host.code}/ping`)).json();
    check(ping.ok, 'ping');
    const noRoom = await fetch(`${BASE}/api/rooms/99999/ping`);
    check(noRoom.status === 404, 'ping несуществующей комнаты');

    const sliced = await new Promise((resolve) => {
      const body = Buffer.from(JSON.stringify({ name: 'Мария' }), 'utf8');
      const head = `POST /api/rooms/${host.code}/join HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n`;
      const all = Buffer.concat([Buffer.from(head), body]);
      const sock = net.connect(PORT, '127.0.0.1');
      let resp = '';
      sock.on('data', (d) => (resp += d.toString('utf8')));
      sock.on('end', () => resolve(resp));
      // Режем посередине многобайтной буквы
      const cut = all.length - 3;
      sock.write(all.subarray(0, 7));
      setTimeout(() => sock.write(all.subarray(7, cut)), 30);
      setTimeout(() => sock.write(all.subarray(cut)), 60);
    });
    check(/^HTTP\/1\.1 200/.test(sliced) && sliced.includes('"ok":true'), 'запрос по частям: ' + sliced.slice(0, 80));
    const v0 = await state(host);
    check(v0.members.some((m) => m.name === 'Мария') && v0.members[0].name === 'Павел Ёлкин', 'кириллица в именах');

    const clients = [host];
    for (const name of ['Коля', 'Даша']) clients.push(await post(`/api/rooms/${host.code}/join`, { name }));

    // Долгий запрос просыпается при изменении
    let v = await state(host);
    const waiting = state(clients[1], v.version);
    await new Promise((r) => setTimeout(r, 200));
    const t0 = Date.now();
    await act(host, { type: 'addBot' });
    const woke = await waiting;
    check(woke.version > v.version && Date.now() - t0 < 1000, 'long-poll по TCP');

    // Отключившийся клиент не ломает сервер
    await new Promise((resolve) => {
      const sock = net.connect(PORT, '127.0.0.1', () => {
        sock.write(`GET /api/rooms/${host.code}/state?token=${encodeURIComponent(clients[2].token)}&since=999999 HTTP/1.1\r\nHost: x\r\n\r\n`);
        setTimeout(() => { sock.destroy(); resolve(); }, 100);
      });
    });

    // Полная партия
    check((await act(host, { type: 'start' })).ok, 'старт');
    for (let guard = 0; guard < 200; guard++) {
      v = await state(host);
      const g = v.game;
      if (g.stage === 'final') break;
      if (g.stage === 'table') {
        // Раскрытие по очереди: в свой ход раскрывает человек, за ботов ходит сервер
        for (let k = 0; k < 80; k++) {
          const cur = (await state(host)).game;
          if (cur.stage !== 'table') break;
          const turn = cur.turnOrder[cur.turnIndex];
          if (!turn) break;
          const c = clients.find((x) => x.playerId === turn);
          if (!c) { await new Promise((r) => setTimeout(r, 400)); continue; }
          const me = cur.players.find((p) => p.id === turn);
          const kinds = ['profession', 'biology', 'health', 'phobia', 'character', 'hobby', 'fact', 'baggage', 'special'].filter((k) => !me.revealed[k]);
          const wrong = clients.find((x) => x.playerId !== turn && cur.players.some((p) => p.id === x.playerId && p.alive));
          if (wrong) check((await act(wrong, { type: 'reveal', kind: 'profession' })).ok === false, 'раскрытие не в свой ход');
          check((await act(c, { type: 'reveal', kind: cur.round === 1 ? 'profession' : kinds[0] })).ok, 'раскрытие в свой ход');
        }
        await act(host, { type: 'advance' });
      } else if (g.stage === 'discussion') {
        check((await act(host, { type: 'startTimer' })).ok, 'запуск таймера');
        await act(clients[1], { type: 'chat', text: 'Привет из сети 🙂' });
        await act(host, { type: 'advance' });
      } else if (g.stage === 'voting') {
        for (const c of clients) {
          const view = (await state(c)).game;
          if (view.stage !== 'voting') break;
          const me = view.players.find((p) => p.id === c.playerId);
          if (!me || !me.alive) continue;
          const target = view.players.find((p) => p.alive && p.id !== c.playerId);
          await act(c, { type: 'vote', target: target.id });
        }
        if ((await state(host)).game.stage === 'voting') await act(host, { type: 'advance' });
      } else if (g.stage === 'result') {
        await act(host, { type: 'advance' });
      }
    }
    v = await state(host);
    check(v.game && v.game.stage === 'final', 'партия по TCP не дошла до финала');
    check(v.game.chat.some((m) => m.text === 'Привет из сети 🙂'), 'эмодзи в чате');
  } finally {
    srv.stop();
    game.stop();
  }
  console.log('проблем:', problems.length);
  problems.forEach((p) => console.log(' -', p));
  process.exit(problems.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
