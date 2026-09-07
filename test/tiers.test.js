import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeck, newRound, currentQuestion, answer, next, retryRound, seededRng } from '../src/engine.js';
import { tierDeck, questionTier } from '../src/tiers.js';
import { emptyProgress, decodeProgress, questionKey, recordAnswer, completeTrip, summary, tierProgress, createBackup, parseBackup, mergeProgress, discoveryDeck } from '../src/progress.js';
const makeQ = (tier, i) => ({ prompt: `Tier ${tier}, question ${i}?`, choices: ['yes', 'no'], answer: 0, note: 'A test question.', tier });
const deck = { title: 'Levels', questions: [1, 2, 3].flatMap(t => Array.from({ length: 15 }, (_, i) => makeQ(t, i))) };
const collect = (p, tier, n, id = 'levels') => deck.questions.filter(q => q.tier === tier).slice(0, n).reduce((s, q) => recordAnswer(s, id, q, true, '2026-09-07').progress, p);

test('tier markers parse cleanly, preserve descriptions and default legacy decks to Curious', () => {
  const parsed = parseDeck('# A\nA description.\n<!-- tier: 1 -->\n## One?\n- [x] A\n- [ ] B\n> Note.\n<!-- tier: 2 -->\n## Two?\n- [x] C\n- [ ] D\n<!-- tier: 3 -->\n## Three?\n- [x] E\n- [ ] F');
  assert.equal(parsed.description, 'A description.');
  assert.deepEqual(parsed.questions.map(q => q.tier), [1, 2, 3]);
  assert.equal(parsed.questions[0].note, 'Note.');
  assert.equal(questionTier(parseDeck('## Legacy?\n- [x] A\n- [ ] B').questions[0]), 1);
  for (const tier of [0, 4, 'foo']) assert.throws(() => parseDeck(`<!-- tier: ${tier} -->\n## Q?\n- [x] A\n- [ ] B`), /tier must/);
});

test('levels unlock only after ten unique correct answers in the preceding tier and topic', () => {
  let p = collect(emptyProgress(), 1, 9);
  assert.deepEqual(tierProgress(p, 'levels', deck).map(t => t.unlocked), [true, false, false]);
  p = recordAnswer(p, 'levels', makeQ(1, 0), true).progress;
  p = recordAnswer(p, 'levels', makeQ(1, 9), false).progress;
  assert.equal(tierProgress(p, 'levels', deck)[1].needed, 1);
  p = recordAnswer(p, 'levels', makeQ(1, 9), true).progress;
  assert.deepEqual(tierProgress(p, 'levels', deck).map(t => t.unlocked), [true, true, false]);
  assert.deepEqual(tierProgress(p, 'another-topic', deck).map(t => t.unlocked), [true, false, false]);
  p = collect(p, 2, 10);
  assert.deepEqual(tierProgress(p, 'levels', deck).map(t => t.unlocked), [true, true, true]);
  const outOfOrder = collect(emptyProgress(), 2, 10);
  assert.deepEqual(tierProgress(outOfOrder, 'levels', deck).map(t => t.unlocked), [true, false, false]);
});

test('small custom decks remain playable and use their available question count as the gate', () => {
  const small = { title: 'Small', questions: [makeQ(1, 0), makeQ(2, 0)] };
  let p = recordAnswer(emptyProgress(), 's', small.questions[0], true).progress;
  assert.deepEqual(tierProgress(p, 's', small).map(t => t.unlocked), [true, true]);
  assert.equal(tierProgress(p, 'empty', { questions: [] }).length, 0);
});

test('weighted XP is awarded exactly once and survives serialization', () => {
  let p = emptyProgress();
  for (const tier of [1, 2, 3]) {
    let recorded = recordAnswer(p, 'levels', makeQ(tier, 0), true);
    assert.equal(recorded.earned, tier * 10);
    p = decodeProgress(JSON.stringify(recorded.progress));
    recorded = recordAnswer(p, 'levels', { ...makeQ(tier, 0), choices: ['no','yes'], answer: 1 }, true);
    assert.equal(recorded.earned, 0);
    p = recorded.progress;
  }
  assert.deepEqual(summary(p), { xp: 60, collected: 3, trips: 0 });
});

test('version-one saves keep every question, daily count, trip, best score and earned XP', () => {
  const keys = deck.questions.filter(q => q.tier === 1).slice(0, 10).map(questionKey);
  const original = { version: 1, topics: { levels: { seen: keys, collected: keys, trips: 4, best: 80 } }, daily: { date: '2026-09-07', answered: 12 } };
  const p = decodeProgress(JSON.stringify(original));
  assert.equal(p.version, 2);
  assert.deepEqual(p.topics.levels.collected, keys);
  assert.deepEqual(summary(p), { xp: 100, collected: 10, trips: 4 });
  assert.deepEqual(p.daily, original.daily);
  assert.equal(p.topics.levels.bestByTier[1], 80);
  assert.equal(p.topics.levels.bestByTier[2], 0);
  assert.equal(tierProgress(p, 'levels', deck)[1].unlocked, true);
  assert.equal(recordAnswer(p, 'levels', makeQ(1, 0), true).earned, 0);
});

test('shuffling and retrying keep a question tier and its reward', () => {
  let r = newRound(tierDeck(deck, 3), { size: 5, rng: seededRng(8) });
  let p = emptyProgress();
  while (r.phase !== 'done') {
    const q = currentQuestion(r); assert.equal(q.tier, 3);
    r = next(answer(r, (q.answer + 1) % q.choices.length));
  }
  r = retryRound(r, { rng: seededRng(9) });
  while (r.phase !== 'done') {
    const q = currentQuestion(r); assert.equal(q.tier, 3);
    const recorded = recordAnswer(p, 'levels', q, true); p = recorded.progress;
    assert.equal(recorded.earned, 30);
    r = next(answer(r, q.answer));
  }
  assert.deepEqual(summary(p), { xp: 150, collected: 5, trips: 0 });
});

test('discovery selection stays inside the chosen route and does not prematurely reuse questions', () => {
  const p = collect(emptyProgress(), 2, 10);
  const selected = discoveryDeck(tierDeck(deck, 2), p, 'levels', 5, seededRng(4));
  assert.deepEqual(selected.questions.map(q => q.prompt).sort(), [10,11,12,13,14].map(i => makeQ(2,i).prompt).sort());
  assert.ok(selected.questions.every(q => q.tier === 2));
});

test('best scores are independent across tiers', () => {
  let p = completeTrip(emptyProgress(), 'levels', 100, 1);
  p = completeTrip(p, 'levels', 60, 2);
  p = completeTrip(p, 'levels', 40, 2);
  p = completeTrip(p, 'levels', 80, 3);
  assert.deepEqual(p.topics.levels.bestByTier, { 1: 100, 2: 60, 3: 80 });
  assert.equal(p.topics.levels.trips, 4);
});

test('backup restore preserves current discoveries, weighted rewards, and avoids duplicate credit', () => {
  let a = collect(emptyProgress(), 1, 12);
  a = completeTrip(a, 'levels', 80, 1);
  let b = collect(emptyProgress(), 2, 3);
  b = recordAnswer(b, 'other', makeQ(3, 0), true).progress;
  const backup = parseBackup(createBackup(b));
  const merged = mergeProgress(a, backup);
  assert.deepEqual(summary(merged), { xp: 210, collected: 16, trips: 1 });
  assert.deepEqual(mergeProgress(merged, backup), merged);
  assert.deepEqual(summary(a), { xp: 120, collected: 12, trips: 1 });
  assert.equal(tierProgress(merged, 'levels', deck)[1].unlocked, true);
});

test('wrong backup files and unknown versions are rejected without changing the current save', () => {
  for (const text of ['', 'not json', '{}', 'null', '{"format":"nextstop-save","version":3}', '{"format":"nextstop-save","version":1,"progress":{"version":2,"topics":[]}}']) assert.throws(() => parseBackup(text));
  const valid = createBackup(emptyProgress());
  assert.deepEqual(summary(parseBackup(valid)), { xp: 0, collected: 0, trips: 0 });
  const malicious = JSON.stringify({ version: 2, topics: { t: { collected: ['a','a'], rewards: { a: 99999 }, trips: -1 } } });
  assert.deepEqual(summary(decodeProgress(malicious)), { xp: 10, collected: 1, trips: 0 });
});
