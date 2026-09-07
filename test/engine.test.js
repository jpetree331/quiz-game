// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    answer,
    currentQuestion,
    isOver,
    newRound,
    next,
    parseDeck,
    results,
    retryRound,
    seededRng,
} from '../src/engine.js';

const decksDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'decks');

const SAMPLE = `# Sample deck
A line of description.
Another line.

## Two plus two?
- [ ] 3
- [x] 4
- [ ] 5
> Basic arithmetic.

## Capital of France?
Spread over two lines.
- [x] Paris
- [ ] Rome

## Colour of the sky?
* [ ] Green
* [x] Blue
`;

test('parseDeck reads title, description, questions, answers and notes', () => {
    const deck = parseDeck(SAMPLE);
    assert.equal(deck.title, 'Sample deck');
    assert.equal(deck.description, 'A line of description. Another line.');
    assert.equal(deck.questions.length, 3);
    assert.deepEqual(deck.questions[0], {
        prompt: 'Two plus two?',
        choices: ['3', '4', '5'],
        answer: 1,
        note: 'Basic arithmetic.',
    });
    assert.equal(deck.questions[1].prompt, 'Capital of France? Spread over two lines.');
    assert.equal(deck.questions[2].answer, 1);
});

test('parseDeck rejects broken decks with a useful message', () => {
    assert.throws(() => parseDeck('# Empty'), /no questions/);
    assert.throws(() => parseDeck('## Q?\n- [ ] a\n- [ ] b'), /no \[x\] answer/);
    assert.throws(() => parseDeck('## Q?\n- [x] a\n- [x] b'), /more than one \[x\]/);
    assert.throws(() => parseDeck('## Q?\n- [x] a'), /at least two choices/);
});

test('every bundled deck parses', async () => {
    const files = (await readdir(decksDir)).filter((f) => f.endsWith('.md'));
    assert.ok(files.length >= 3);
    for (const f of files) {
        const deck = parseDeck(await readFile(path.join(decksDir, f), 'utf8'));
        assert.ok(deck.questions.length >= 10, `${f} has ${deck.questions.length} questions`);
        for (const q of deck.questions)
            assert.ok(q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length);
    }
});

test('newRound picks at most `size` questions and remaps shuffled answers', () => {
    const deck = parseDeck(SAMPLE);
    const round = newRound(deck, { size: 2, rng: seededRng(7) });
    assert.equal(round.questions.length, 2);
    assert.equal(round.phase, 'ask');
    for (const q of round.questions) {
        const original = deck.questions.find((o) => o.prompt === q.prompt);
        assert.equal(q.choices[q.answer], original.choices[original.answer]);
        assert.deepEqual([...q.choices].sort(), [...original.choices].sort());
    }
    assert.equal(newRound(deck, { size: 50 }).questions.length, 3);
    assert.throws(() => newRound(deck, { size: 0 }), /positive integer/);
});

test('seeded rounds are reproducible', () => {
    const deck = parseDeck(SAMPLE);
    const a = newRound(deck, { rng: seededRng(42) });
    const b = newRound(deck, { rng: seededRng(42) });
    assert.deepEqual(a, b);
});

test('answer scores, tracks streaks and moves through reveal to done', () => {
    const deck = parseDeck(SAMPLE);
    let s = newRound(deck, { rng: seededRng(1), shuffleChoices: false });
    const total = s.questions.length;

    s = answer(s, currentQuestion(s).answer);
    assert.equal(s.phase, 'reveal');
    assert.equal(s.score, 1);
    assert.equal(s.streak, 1);
    assert.throws(() => answer(s, 0), /cannot answer in phase "reveal"/);
    s = next(s);

    const q = currentQuestion(s);
    s = answer(s, (q.answer + 1) % q.choices.length); // wrong on purpose
    assert.equal(s.score, 1);
    assert.equal(s.streak, 0);
    assert.equal(s.bestStreak, 1);
    s = next(s);

    s = answer(s, currentQuestion(s).answer);
    s = next(s);
    assert.ok(isOver(s));
    assert.throws(() => next(s), /cannot advance in phase "done"/);

    const r = results(s);
    assert.equal(r.total, total);
    assert.equal(r.score, 2);
    assert.equal(r.pct, 67);
    assert.equal(r.missed.length, 1);
    assert.equal(r.perfect, false);
});

test('answer rejects out-of-range choices', () => {
    const s = newRound(parseDeck(SAMPLE));
    assert.throws(() => answer(s, -1), /out of range/);
    assert.throws(() => answer(s, 99), /out of range/);
    assert.throws(() => answer(s, 1.5), /out of range/);
});

test('retryRound replays only the missed questions', () => {
    const deck = parseDeck(SAMPLE);
    let s = newRound(deck, { rng: seededRng(3), shuffleChoices: false });
    const wrongPrompts = [];
    while (!isOver(s)) {
        const q = currentQuestion(s);
        const wrong = s.index % 2 === 0;
        if (wrong)
            wrongPrompts.push(q.prompt);
        s = next(answer(s, wrong ? (q.answer + 1) % q.choices.length : q.answer));
    }
    const retry = retryRound(s, { rng: seededRng(9) });
    assert.deepEqual(retry.questions.map((q) => q.prompt).sort(), wrongPrompts.sort());

    let perfect = newRound(deck, { shuffleChoices: false });
    while (!isOver(perfect))
        perfect = next(answer(perfect, currentQuestion(perfect).answer));
    assert.equal(results(perfect).perfect, true);
    assert.equal(retryRound(perfect), null);
});

test('200 seeded rounds over the bundled decks all terminate with consistent scores', async () => {
    const files = (await readdir(decksDir)).filter((f) => f.endsWith('.md'));
    const decks = [];
    for (const f of files)
        decks.push(parseDeck(await readFile(path.join(decksDir, f), 'utf8')));
    for (let seed = 1; seed <= 200; seed++) {
        const rng = seededRng(seed);
        const deck = decks[seed % decks.length];
        let s = newRound(deck, { rng });
        let expected = 0;
        let steps = 0;
        while (!isOver(s)) {
            const q = currentQuestion(s);
            const pick = Math.floor(rng() * q.choices.length);
            if (pick === q.answer)
                expected++;
            s = next(answer(s, pick));
            steps++;
            assert.ok(steps <= s.questions.length, 'round did not terminate');
        }
        assert.equal(s.score, expected, `seed ${seed}`);
        assert.equal(s.answers.length, s.questions.length);
    }
});
