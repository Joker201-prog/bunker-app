// Тесты комнат и действий: npx tsc -p tsconfig.engine.json && node scripts/room-test.js
const path = require('path');
const out = path.join(__dirname, '..', '.build');
const R = require(out + '/game/room');
const A = require(out + '/game/actions');
const E = require(out + '/game/engine');
const RNG = require(out + '/game/rng');

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const ok = (r, msg) => { if (!r.ok) throw new Error(`${msg}: ${r.error}`); return r.room; };
const bad = (r, msg) => check(!r.ok, `${msg}: ожидалась ошибка`);

let now = 1_000_000;
const t = () => (now += 1000);

function lobby(mode, hostPlays, humans = 4, bots = 0) {
  let room = R.createRoom('1234', { id: 'p0', name: 'Павел' }, { hostMode: mode, hostPlays }, t());
  for (let i = 1; i < humans; i++) room = ok(R.joinRoom(room, { id: 'p' + i, name: 'Игрок' }, t()), 'join');
  for (let i = 0; i < bots; i++) room = ok(R.applyRoomAction(room, R.lobbyAdmin(room), { type: 'addBot' }, t()), 'addBot');
  return room;
}

// Полная партия через действия; возвращает комнату после финала
function playThrough(room, label) {
  const g0 = room.game;
  const host = g0.hostId;
  for (let guard = 0; guard < 300 && room.game.stage !== 'final'; guard++) {
    const g = room.game;
    if (g.stage === 'table') {
      // Не-ведущий не может двигать этапы
      const nonHost = room.members.find((m) => !m.isBot && m.id !== host);
      if (nonHost) bad(R.applyRoomAction(room, nonHost.id, { type: 'advance' }, t()), `${label}: не-ведущий advance`);
      for (const p of g.players.filter((p) => p.isHuman && p.alive)) {
        const kinds = E.revealableKinds(room.game, room.game.players.find((x) => x.id === p.id));
        // Каждый второй человек «забывает» раскрыть карту — сработает авто-раскрытие
        if (kinds.length && p.id.charCodeAt(1) % 2 === 0) room = ok(R.applyRoomAction(room, p.id, { type: 'reveal', kind: kinds[kinds.length - 1] }, t()), `${label}: reveal`);
      }
      room = ok(R.applyRoomAction(room, host, { type: 'advance' }, t()), `${label}: advance table`);
      check(room.game.stage === 'discussion', `${label}: после стола не обсуждение`);
      check(E.pendingReveals({ ...room.game, stage: 'table' }).length === 0, `${label}: кто-то остался без раскрытой карты`);
    } else if (g.stage === 'discussion') {
      const speaker = g.players.find((p) => p.isHuman && p.alive);
      if (speaker) room = ok(R.applyRoomAction(room, speaker.id, { type: 'chat', text: 'Я полезен' }, t()), `${label}: chat`);
      const dead = g.players.find((p) => p.isHuman && !p.alive && p.id !== host);
      if (dead) bad(R.applyRoomAction(room, dead.id, { type: 'chat', text: 'эй' }, t()), `${label}: выбывший пишет в чат`);
      // Время идёт: боты говорят, затем таймер сам переводит в голосование
      for (let i = 0; i < 5; i++) { now += 4000; room = R.tickRoom(room, now); }
      now = room.game.discussionEndsAt + 1;
      room = R.tickRoom(room, now);
      check(room.game.stage === 'voting' || room.game.stage === 'result', `${label}: таймер не завершил обсуждение (${room.game.stage})`);
    } else if (g.stage === 'voting') {
      const humansAlive = g.players.filter((p) => p.isHuman && p.alive && room.members.some((m) => m.id === p.id));
      for (const p of humansAlive) {
        if (room.game.stage !== 'voting') break;
        const target = room.game.players.find((x) => x.alive && x.id !== p.id);
        bad(R.applyRoomAction(room, p.id, { type: 'vote', target: p.id }, t()), `${label}: голос против себя`);
        room = ok(R.applyRoomAction(room, p.id, { type: 'vote', target: target.id }, t()), `${label}: vote`);
      }
      if (room.game.stage === 'voting') room = ok(R.applyRoomAction(room, host, { type: 'advance' }, t()), `${label}: advance voting`);
      check(room.game.stage === 'result', `${label}: после голосования не итоги`);
    } else if (g.stage === 'result') {
      room = ok(R.applyRoomAction(room, host, { type: 'advance' }, t()), `${label}: advance result`);
    }
  }
  check(room.game.stage === 'final', `${label}: не дошли до финала`);
  check(E.alivePlayers(room.game).length === room.game.seats, `${label}: выживших не столько, сколько мест`);
  return room;
}

for (let seed = 1; seed <= 300; seed++) {
  RNG.setRandom(RNG.seeded(seed));
  try {

  // 1. Создатель — ведущий и играет
  let room = lobby('creator', true, 4, seed % 3);
  check(room.hostId === 'p0', 'creator: ведущий не создатель');
  bad(R.applyRoomAction(room, 'p1', { type: 'start' }, t()), 'creator: не-ведущий start');
  bad(R.applyRoomAction(room, 'p1', { type: 'addBot' }, t()), 'creator: не-ведущий addBot');
  room = ok(R.applyRoomAction(room, 'p0', { type: 'start' }, t()), 'creator: start');
  check(room.game.hostId === 'p0' && room.game.players.some((p) => p.id === 'p0'), 'creator: ведущий не в игре');
  bad(R.joinRoom(room, { id: 'late', name: 'Опоздал' }, t()), 'вход во время партии');

  // Маскировка: p1 не видит нераскрытых карт p2, но видит свои
  const v = R.roomView(room, 'p1', now);
  const p2 = v.game.players.find((p) => p.id === 'p2');
  const p1 = v.game.players.find((p) => p.id === 'p1');
  check(p2.cards.profession.title === '' && p1.cards.profession.title !== '', 'маскировка карт');
  check(typeof p2.photo === 'string' && p2.photo.length === 2, 'фото не видно');

  room = playThrough(room, `creator#${seed}`);
  room = ok(R.applyRoomAction(room, 'p0', { type: 'toLobby' }, t()), 'toLobby');
  check(room.game === null && room.hostId === 'p0', 'после возврата в лобби ведущий сохранился');
  room = ok(R.applyRoomAction(room, 'p0', { type: 'start' }, t()), 'повторный старт');

  // 2. Ведущий не играет
  room = lobby('creator', false, 5, 0);
  room = ok(R.applyRoomAction(room, 'p0', { type: 'start' }, t()), 'hostPlays=false: start');
  check(!room.game.players.some((p) => p.id === 'p0') && room.game.players.length === 4, 'hostPlays=false: ведущий получил карты');
  bad(R.applyRoomAction(room, 'p0', { type: 'vote', target: 'p1' }, t()), 'неиграющий ведущий голосует');
  room = playThrough(room, `noplay#${seed}`);

  // Мало игроков без ведущего
  room = lobby('creator', false, 4, 0);
  bad(R.applyRoomAction(room, 'p0', { type: 'start' }, t()), 'старт с 3 игроками без ведущего');

  // 3. Случайный ведущий
  room = lobby('random', true, 5, 1);
  check(room.hostId === null && R.lobbyAdmin(room) === 'p0', 'random: до старта управляет создатель');
  room = ok(R.applyRoomAction(room, 'p0', { type: 'start' }, t()), 'random: start');
  const hm = room.members.find((m) => m.id === room.hostId);
  check(hm && !hm.isBot, 'random: ведущий — бот или не найден');

  // 4. Голосование за ведущего
  room = lobby('vote', true, 4, 1);
  const bot = room.members.find((m) => m.isBot);
  bad(R.applyRoomAction(room, 'p1', { type: 'voteHost', id: bot.id }, t()), 'vote: голос за бота');
  room = ok(R.applyRoomAction(room, 'p0', { type: 'voteHost', id: 'p2' }, t()), 'vote');
  room = ok(R.applyRoomAction(room, 'p1', { type: 'voteHost', id: 'p2' }, t()), 'vote');
  room = ok(R.applyRoomAction(room, 'p2', { type: 'voteHost', id: 'p1' }, t()), 'vote');
  check(R.roomView(room, 'p3', now).members.find((m) => m.id === 'p2').hostVotes === 2, 'vote: подсчёт');
  room = ok(R.applyRoomAction(room, 'p0', { type: 'start' }, t()), 'vote: start');
  check(room.hostId === 'p2' && room.game.hostId === 'p2', `vote: ведущий ${room.hostId}, ожидался p2`);

  // 5. Передача роли и уход ведущего посреди партии
  room = ok(R.applyRoomAction(room, 'p2', { type: 'transferHost', id: 'p3' }, t()), 'transferHost');
  check(room.game.hostId === 'p3', 'transferHost: игра не узнала нового ведущего');
  bad(R.applyRoomAction(room, 'p2', { type: 'advance' }, t()), 'бывший ведущий advance');
  room = ok(R.applyRoomAction(room, 'p3', { type: 'leave' }, t()), 'leave host');
  check(room.game.hostId && room.game.hostId !== 'p3', 'после ухода ведущего роль не перешла');
  check(room.game.players.find((p) => p.id === 'p3').isHuman === false, 'ушедший игрок не стал ботом');
  room = playThrough(room, `leave#${seed}`);

  // 6. Кик и уникальные имена
  room = lobby('creator', true, 3, 0);
  check(new Set(room.members.map((m) => m.name)).size === 3, 'имена не уникальны');
  room = ok(R.applyRoomAction(room, 'p0', { type: 'kick', id: 'p2' }, t()), 'kick');
  check(room.members.length === 2, 'kick не сработал');
  } catch (e) {
    problems.push(`seed ${seed}: ${e.message}`);
  }
}

// Одиночная игра через те же действия
RNG.setRandom(RNG.seeded(99));
let g = E.newGame({ humanName: 'Павел', players: 8 });
check(g.hostId === 'human', 'одиночная: ведущий не игрок');
const k = E.revealableKinds(g, g.players[0]);
const r1 = A.applyAction(g, 'human', { type: 'reveal', kind: k[0] }, now);
check(r1.ok, 'одиночная: reveal');

console.log('проблем:', problems.length);
problems.slice(0, 20).forEach((p) => console.log(' -', p));
process.exit(problems.length ? 1 : 0);
