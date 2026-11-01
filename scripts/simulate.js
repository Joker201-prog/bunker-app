// Проверка движка: npx tsc -p tsconfig.engine.json && node scripts/simulate.js
const path = require('path');
const out = path.join(__dirname, '..', '.build');
const E = require(out + '/game/engine');
const R = require(out + '/game/rng');

const problems = [];
const fail = (msg) => problems.push(msg);

// ---------- 1. Полные партии ----------
const stats = { thrive: 0, survive: 0, fall: 0 };
for (let seed = 1; seed <= 3000; seed++) {
  R.setRandom(R.seeded(seed));
  const count = 4 + (seed % 13); // 4..16
  let s = E.newGame({ humanName: seed % 7 === 0 ? '' : 'Павел', players: count });
  try {
    // Пол в биологии совпадает с именем бота; имена не повторяются
    const names = new Set();
    for (const p of s.players) {
      if (names.has(p.name)) fail(`seed ${seed}: имя ${p.name} повторяется`);
      names.add(p.name);
      const bot = E.BOT_NAMES.find((b) => b.name === p.name);
      if (bot) {
        const isMan = p.cards.biology.title.startsWith('Мужчина');
        if (isMan !== bot.male) fail(`seed ${seed}: ${p.name} — «${p.cards.biology.title}»`);
      }
      if (p.isHuman && !p.name) fail(`seed ${seed}: у человека пустое имя`);
    }

    for (let guard = 0; guard < 200 && s.stage !== 'final'; guard++) {
      if (s.stage === 'table') {
        const human = s.players.find((p) => p.isHuman);
        if (human.alive) {
          const kinds = E.revealableKinds(s, human);
          if (kinds.length === 0) fail(`seed ${seed}: нечего раскрывать в раунде ${s.round}`);
          else s = E.revealCard(s, 'human', kinds[0]);
        }
        if (!E.canLeaveTable(s)) fail(`seed ${seed}: нельзя выйти из-за стола`);
        s = E.startDiscussion(s);
      } else if (s.stage === 'discussion') {
        for (let i = 0; i < 12; i++) s = E.botMessage(s);
        // Реплики текущего обсуждения не повторяются и не содержат «Вы пока»
        const texts = [];
        for (let i = s.chat.length - 1; i >= 0 && s.chat[i].authorId !== null; i--) texts.push(s.chat[i].text);
        if (new Set(texts).size !== texts.length) fail(`seed ${seed}: повторы в чате раунда ${s.round}`);
        if (texts.some((t) => /^Вы (пока|,)/.test(t))) fail(`seed ${seed}: «Вы пока…» в чате`);
        // Один бот не говорит дважды подряд (системные сообщения разрывают цепочку)
        const botsAlive = E.alivePlayers(s).filter((p) => !p.isHuman).length;
        for (let i = 1; i < s.chat.length; i++) {
          const a = s.chat[i - 1].authorId;
          const b = s.chat[i].authorId;
          if (a && a === b && a !== 'human' && botsAlive > 1) fail(`seed ${seed}: бот ${a} говорит дважды подряд`);
        }
        s = E.startVoting(s);
      } else if (s.stage === 'voting') {
        const human = s.players.find((p) => p.isHuman);
        if (human.alive) {
          const t = E.alivePlayers(s).find((p) => p.id !== 'human');
          s = E.castVote(s, 'human', t.id);
        }
        s = E.resolveRound(s);
        // Жребий заявлен только при настоящем равенстве на границе вылета
        const r = s.results[s.results.length - 1];
        if (r.eliminated.length > 0 && r.shieldBlocked.length === 0) {
          const lastOut = Math.min(...r.eliminated.map((id) => r.tally[id]));
          const expected =
            lastOut > 0 &&
            Object.entries(r.tally).some(([id, v]) => !r.eliminated.includes(id) && v === lastOut);
          if (r.tieBroken !== expected) fail(`seed ${seed}: tieBroken=${r.tieBroken}, ожидалось ${expected}`);
        }
      } else if (s.stage === 'result') {
        s = E.nextRound(s);
      }
    }
    if (s.stage !== 'final') fail(`seed ${seed}: не дошла до финала`);
    const alive = E.alivePlayers(s).length;
    if (alive !== s.seats) fail(`seed ${seed}: живых ${alive} != мест ${s.seats} (n=${count})`);
    if (!s.final) fail(`seed ${seed}: нет финала`);
    else stats[s.final.verdict]++;
  } catch (e) {
    fail(`seed ${seed}: исключение ${e.message}`);
  }
}

// ---------- 2. Точечные проверки жребия ----------
function votingState(n, votes, elim) {
  R.setRandom(R.seeded(42));
  let s = E.newGame({ humanName: 'Павел', players: n });
  return { ...s, round: 2, stage: 'voting', elimsPerRound: [0, elim, 0, 0, 0], votes };
}
function ids(n) {
  return ['human', ...Array.from({ length: n - 1 }, (_, i) => `bot${i + 1}`)];
}

{ // 6/1/1 — это не ничья
  const [h, b1, b2, b3, b4, b5, b6, b7] = ids(8);
  const s = E.resolveRound(
    votingState(8, { [h]: b1, [b2]: b1, [b3]: b1, [b4]: b1, [b5]: b1, [b6]: b1, [b7]: b2, [b1]: b3 }, 1),
  );
  const r = s.results[0];
  if (r.eliminated[0] !== b1 || r.tieBroken) fail(`6/1/1: eliminated=${r.eliminated}, tieBroken=${r.tieBroken}`);
}
{ // 3/2/1/1/1 — лидер один, жребия нет
  const [h, b1, b2, b3, b4, b5, b6, b7] = ids(8);
  const s = E.resolveRound(
    votingState(8, { [h]: b1, [b2]: b1, [b3]: b1, [b4]: b2, [b5]: b2, [b6]: b3, [b7]: b4, [b1]: b5 }, 1),
  );
  const r = s.results[0];
  if (r.eliminated[0] !== b1 || r.tieBroken) fail(`3/2/1/1/1: eliminated=${r.eliminated}, tieBroken=${r.tieBroken}`);
}
{ // 3/3 — настоящая ничья за первое место
  const [h, b1, b2, b3, b4, b5, b6, b7] = ids(8);
  const s = E.resolveRound(
    votingState(8, { [h]: b1, [b2]: b1, [b3]: b1, [b4]: b2, [b5]: b2, [b1]: b2, [b6]: b3, [b7]: b4 }, 1),
  );
  const r = s.results[0];
  if (!r.tieBroken) fail('3/3: ничья не распознана');
}
{ // 2/2 — настоящая ничья
  const [h, b1, b2, b3] = ids(4);
  const s = E.resolveRound(votingState(4, { [h]: b1, [b2]: b1, [b1]: h, [b3]: h }, 1));
  const r = s.results[0];
  if (!r.tieBroken) fail('2/2: ничья не распознана');
}
{ // Пустое имя
  const s = E.newGame({ humanName: '   ', players: 6 });
  if (s.players[0].name !== E.DEFAULT_HUMAN_NAME) fail('пустое имя не заменено на значение по умолчанию');
}

console.log('партий:', 3000, 'итоги:', stats);
console.log('проблем:', problems.length);
problems.slice(0, 15).forEach((p) => console.log(' -', p));
process.exit(problems.length ? 1 : 0);
