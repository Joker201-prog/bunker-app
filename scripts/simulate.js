const out = require('path').join(__dirname, '..', '.build');
const E = require(out + '/game/engine');
const R = require(out + '/game/rng');

const stats = { thrive: 0, survive: 0, fall: 0 };
const byCount = {};
let games = 0;
let problems = [];

for (let seed = 1; seed <= 3000; seed++) {
  R.setRandom(R.seeded(seed));
  const count = 4 + (seed % 13); // 4..16
  let s = E.newGame({ humanName: 'Павел', players: count });
  try {
    for (let guard = 0; guard < 200 && s.stage !== 'final'; guard++) {
      if (s.stage === 'table') {
        const human = s.players.find((p) => p.isHuman);
        if (human.alive) {
          const kinds = E.revealableKinds(s, human);
          if (kinds.length === 0) problems.push(`seed ${seed}: human has nothing to reveal in round ${s.round}`);
          else s = E.revealCard(s, 'human', kinds[0]);
        }
        if (!E.canLeaveTable(s)) problems.push(`seed ${seed}: cannot leave table`);
        s = E.startDiscussion(s);
      } else if (s.stage === 'discussion') {
        for (let i = 0; i < 5; i++) s = E.botMessage(s);
        s = E.startVoting(s);
      } else if (s.stage === 'voting') {
        const human = s.players.find((p) => p.isHuman);
        if (human.alive) {
          const t = E.alivePlayers(s).find((p) => p.id !== 'human');
          s = E.castVote(s, 'human', t.id);
        }
        s = E.resolveRound(s);
      } else if (s.stage === 'result') {
        s = E.nextRound(s);
      }
    }
    if (s.stage !== 'final') problems.push(`seed ${seed}: did not reach final`);
    const alive = E.alivePlayers(s).length;
    if (alive !== s.seats) problems.push(`seed ${seed}: alive ${alive} != seats ${s.seats} (n=${count})`);
    if (!s.final) problems.push(`seed ${seed}: no final`);
    else {
      stats[s.final.verdict]++;
      byCount[count] = byCount[count] || { thrive: 0, survive: 0, fall: 0 };
      byCount[count][s.final.verdict]++;
    }
    games++;
  } catch (e) {
    problems.push(`seed ${seed}: threw ${e.message}`);
  }
}

console.log('games:', games);
console.log('verdicts:', stats);
console.log('by player count:');
for (const k of Object.keys(byCount).sort((a, b) => a - b)) console.log(' ', k, JSON.stringify(byCount[k]));
console.log('problems:', problems.length);
problems.slice(0, 10).forEach((p) => console.log(' -', p));
