import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUNDLED } from '../src/decks.js';
import { parseDeck, newRound, seededRng, answer, next, currentQuestion, retryRound, results } from '../src/engine.js';
import { emptyProgress, decodeProgress, questionKey, recordAnswer, completeTrip, summary, discoveryDeck, collectedCount, localDate } from '../src/progress.js';
const q = { prompt: 'Two plus two?', choices: ['4', '3', '5', '6'], answer: 0, note: '' };

test('an answer saves progress immediately; retries and shuffled answers cannot farm XP', () => {
  let p = emptyProgress();
  const original = JSON.stringify(p);
  const wrong = recordAnswer(p, 'math', q, false, '2026-09-07');
  assert.equal(wrong.earned, 0);
  assert.equal(wrong.progress.topics.math.seen.length, 1);
  assert.equal(JSON.stringify(p), original, 'input is immutable');
  const correct = recordAnswer(wrong.progress, 'math', q, true, '2026-09-07');
  assert.equal(correct.earned, 10);
  p = decodeProgress(JSON.stringify(correct.progress));
  const reordered = { ...q, choices: ['6', '4', '5', '3'], answer: 1 };
  assert.equal(questionKey(reordered), questionKey(q));
  const repeated = recordAnswer(p, 'math', reordered, true, '2026-09-07');
  assert.equal(repeated.earned, 0);
  assert.deepEqual(summary(repeated.progress), { xp: 10, collected: 1, trips: 0 });
  assert.equal(repeated.progress.daily.answered, 3);
});

test('changed answers do not reuse old question progress; decks remain independent', () => {
  const p = recordAnswer(emptyProgress(), 'one', q, true).progress;
  assert.equal(collectedCount(p, 'two', { questions: [q] }), 0);
  assert.equal(collectedCount(p, 'one', { questions: [{ ...q, answer: 1 }] }), 0);
  assert.equal(collectedCount(p, 'one', { questions: [q] }), 1);
});

test('daily goal resets on a new local day without clearing permanent progress', () => {
  const p = recordAnswer(emptyProgress(), 'math', q, true, '2026-09-07').progress;
  const nextDay = recordAnswer(p, 'math', q, true, '2026-09-08').progress;
  assert.equal(nextDay.daily.answered, 1);
  assert.equal(summary(nextDay).xp, 10);
  assert.equal(localDate(new Date(2026, 8, 7, 23, 59)), '2026-09-07');
});

test('corrupt or malformed stored data fails safely and valid topic history survives', () => {
  for (const raw of [null, '', '{bad', 'null', '[]', '{"version":2}', '{"version":1,"topics":null}']) {
    assert.deepEqual(decodeProgress(raw), emptyProgress());
  }
  const p = decodeProgress('{"version":1,"topics":{"ok":{"seen":["a","a",2],"collected":["a"],"trips":-5,"best":1000},"broken":null},"daily":{"answered":"NaN"}}');
  assert.deepEqual(p.topics.ok, { seen: ['a'], collected: ['a'], rewards: { a: 10 }, trips: 0, best: 100, bestByTier: { 1: 100, 2: 0, 3: 0 } });
  assert.equal(p.daily.answered, 0);
  const unusual = recordAnswer(emptyProgress(), '__proto__', q, true).progress;
  assert.equal(summary(decodeProgress(JSON.stringify(unusual))).xp, 10);
  assert.equal({}.collected, undefined);
});

test('discovery rounds prioritize unseen, then missed, then collected, without duplicate questions', () => {
  const qs = ['new1', 'new2', 'missed', 'collected'].map(prompt => ({ ...q, prompt }));
  const deck = { title: 'Test', questions: qs };
  let p = recordAnswer(emptyProgress(), 't', qs[2], false).progress;
  p = recordAnswer(p, 't', qs[3], true).progress;
  for (let seed = 1; seed <= 30; seed++) {
    const selected = discoveryDeck(deck, p, 't', 3, seededRng(seed));
    assert.deepEqual(selected.questions.map(q => q.prompt).sort(), ['missed', 'new1', 'new2']);
    const round = newRound(selected, { size: 3, rng: seededRng(seed) });
    assert.equal(new Set(round.questions.map(q => q.prompt)).size, 3);
  }
  assert.equal(discoveryDeck(deck, p, 't', 15).questions.length, 4);
});

test('full trip scores and progress integrate with retry rounds', () => {
  const deck = { title: 'Trip', questions: ['a','b','c','d','e'].map(prompt => ({ ...q, prompt })) };
  let r = newRound(deck, { size: 5 }), p = emptyProgress();
  while (r.phase !== 'done') {
    const q = currentQuestion(r), correct = r.index < 2;
    p = recordAnswer(p, 't', q, correct).progress;
    r = next(answer(r, correct ? q.answer : (q.answer + 1) % 4));
  }
  p = completeTrip(p, 't', results(r).pct);
  let retry = retryRound(r);
  while (retry.phase !== 'done') {
    const q = currentQuestion(retry);
    p = recordAnswer(p, 't', q, true).progress;
    retry = next(answer(retry, q.answer));
  }
  assert.equal(p.topics.t.best, 40);
  assert.deepEqual(summary(p), { xp: 50, collected: 5, trips: 1 });
  assert.equal(collectedCount(p, 't', deck), 5);
});

test('all six registered decks contain 60 distinct, well-formed four-choice questions', async () => {
  assert.equal(BUNDLED.length, 6);
  const prompts = new Set();
  for (const { file } of BUNDLED) {
    const d = parseDeck(await readFile(new URL(`../decks/${file}`, import.meta.url), 'utf8'));
    assert.equal(d.questions.length, 60, file);
    assert.deepEqual([1, 2, 3].map(t => d.questions.filter(q => q.tier === t).length), [30, 15, 15]);
    for (const q of d.questions) {
      assert.ok(!prompts.has(q.prompt.toLowerCase()), `Duplicate: ${q.prompt}`);
      prompts.add(q.prompt.toLowerCase());
      assert.equal(q.choices.length, 4, q.prompt);
      assert.equal(new Set(q.choices.map(c => c.toLowerCase())).size, 4, q.prompt);
      assert.ok(q.prompt.length && q.choices.every(c => c.trim().length), q.prompt);
    }
  }
  assert.equal(prompts.size, 360);
});
