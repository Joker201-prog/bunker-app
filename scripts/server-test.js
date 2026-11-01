// Интеграционный тест сервера по HTTP. Сначала соберите сервер:
//   cd server && tsc -p tsconfig.json && cd .. && node scripts/server-test.js
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8787;
const BASE = `http://127.0.0.1:${PORT}`;
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };

const post = async (p, body) => (await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const state = async (s, since = 0) => (await fetch(`${BASE}/api/rooms/${s.code}/state?token=${encodeURIComponent(s.token)}&since=${since}`)).json();
const act = (s, action) => post(`/api/rooms/${s.code}/action`, { token: s.token, action });

async function main() {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'dist', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((r) => srv.stdout.once('data', r));
  try {
    const health = await (await fetch(BASE + '/health')).json();
    check(health.ok, 'health');

    // Создатель в режиме «голосование», ведущий играет
    const host = await post('/api/rooms', { name: 'Павел', settings: { hostMode: 'vote', hostPlays: true, discussionSeconds: 30 } });
    check(host.ok && /^\d{4}$/.test(host.code), 'создание комнаты');
    const code = host.code;
    const clients = [host];
    for (const name of ['Маша', 'Коля', 'Павел']) {
      const j = await post(`/api/rooms/${code}/join`, { name });
      check(j.ok, 'вход ' + name);
      clients.push(j);
    }
    const bad = await post('/api/rooms/0000/join', { name: 'x' });
    check(!bad.ok, 'вход в несуществующую комнату');
    const forged = await act({ code, token: 'fake' }, { type: 'start' });
    check(!forged.ok, 'действие с чужим токеном');

    let v = await state(host);
    check(v.members.length === 4, 'в лобби 4 человека');
    check(new Set(v.members.map((m) => m.name)).size === 4, 'одинаковые имена не переименованы');

    // Long-poll: Маша ждёт изменений, Коля голосует за ведущего — ответ приходит сразу
    const since = v.version;
    const t0 = Date.now();
    const waiting = state(clients[1], since);
    await new Promise((r) => setTimeout(r, 300));
    for (const c of clients) await act(c, { type: 'voteHost', id: clients[2].playerId });
    const woke = await waiting;
    const latency = Date.now() - t0 - 300;
    check(woke.version > since && latency < 1000, `long-poll не проснулся быстро (${latency} мс)`);

    check((await act(clients[1], { type: 'start' })).ok === false, 'не-создатель начал партию в лобби');
    check((await act(host, { type: 'addBot' })).ok, 'добавить бота');
    const st = await act(host, { type: 'start' });
    check(st.ok, 'старт: ' + (st.error || ''));
    v = await state(host);
    check(v.hostId === clients[2].playerId, 'голосование выбрало не того ведущего');
    const hostClient = clients.find((c) => c.playerId === v.hostId);

    // Чужие карты скрыты в ответе сервера
    const other = v.game.players.find((p) => p.id !== host.playerId && p.isHuman);
    check(other.cards.health.title === '', 'сервер отдал чужие скрытые карты');

    // Проходим партию
    for (let guard = 0; guard < 200; guard++) {
      v = await state(hostClient);
      const g = v.game;
      if (g.stage === 'final') break;
      if (g.stage === 'table') {
        for (const c of clients) {
          const mine = (await state(c)).game.players.find((p) => p.id === c.playerId);
          if (!mine || !mine.alive) continue;
          const kinds = ['profession', 'biology', 'health', 'fact', 'hobby', 'baggage', 'special'].filter((k) => !mine.revealed[k]);
          if (kinds.length) await act(c, { type: 'reveal', kind: g.round === 1 ? 'profession' : kinds[0] });
        }
        check((await act(clients.find((c) => c !== hostClient), { type: 'advance' })).ok === false, 'не-ведущий двинул этап');
        await act(hostClient, { type: 'advance' });
      } else if (g.stage === 'discussion') {
        await act(clients[0], { type: 'chat', text: 'Я врач, пустите' });
        const ext = await act(hostClient, { type: 'extend', seconds: 30 });
        check(ext.ok, 'продлить обсуждение');
        await act(hostClient, { type: 'advance' });
      } else if (g.stage === 'voting') {
        for (const c of clients) {
          const view = (await state(c)).game;
          if (view.stage !== 'voting') break;
          const me = view.players.find((p) => p.id === c.playerId);
          if (!me || !me.alive) continue;
          const target = view.players.find((p) => p.alive && p.id !== c.playerId);
          await act(c, { type: 'vote', target: target.id });
        }
        if ((await state(hostClient)).game.stage === 'voting') await act(hostClient, { type: 'advance' });
      } else if (g.stage === 'result') {
        await act(hostClient, { type: 'advance' });
      }
    }
    v = await state(hostClient);
    check(v.game.stage === 'final' && v.game.final, 'партия по сети не дошла до финала');
    check(v.game.chat.some((m) => m.text === 'Я врач, пустите'), 'реплика игрока не попала в чат');

    // Возврат в лобби и выход
    check((await act(hostClient, { type: 'toLobby' })).ok, 'возврат в лобби');
    check((await act(clients[1], { type: 'leave' })).ok, 'выход из комнаты');
    const gone = await state(clients[1]);
    check(gone.ok === false, 'после выхода сессия ещё работает');
    v = await state(host);
    check(v.game === null && v.members.length === 4, `в лобби после выхода ${v.members.length} участников (ожидалось 3 человека + бот)`);
  } finally {
    srv.kill();
  }
  console.log('проблем:', problems.length);
  problems.forEach((p) => console.log(' -', p));
  process.exit(problems.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
