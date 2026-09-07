// Next Stop — pure quiz engine. No DOM, no timers, no I/O: every function
// takes a state and returns a new one, so it runs the same in the browser,
// in Node, and in a test suite.

export const DEFAULT_ROUND_SIZE = 10;
export const PHASES = ['ask', 'reveal', 'done'];

/** Small seeded PRNG (mulberry32). Pass the result as `rng` for reproducible rounds. */
export function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher–Yates shuffle; never mutates the input. */
export function shuffle(items, rng = Math.random) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

/**
 * Parse a markdown deck.
 *
 *   # Deck title
 *   Free text under the title is the description.
 *
 *   ## Question text
 *   - [x] the right answer
 *   - [ ] a wrong answer
 *   - [ ] another wrong answer
 *   > Optional note shown after answering.
 *
 * Every question needs at least two choices and exactly one `[x]`.
 */
export function parseDeck(markdown) {
    const lines = String(markdown).split(/\r?\n/);
    const deck = { title: 'Untitled deck', description: '', questions: [] };
    const descLines = [];
    let q = null;
    let tier;

    const finish = () => {
        if (q === null)
            return;
        const n = deck.questions.length + 1;
        if (q.choices.length < 2)
            throw new Error(`question ${n} ("${q.prompt}") needs at least two choices`);
        if (q.answer === -1)
            throw new Error(`question ${n} ("${q.prompt}") has no [x] answer`);
        deck.questions.push(q);
        q = null;
    };

    for (const raw of lines) {
        const line = raw.trim();
        const tierMarker = /^<!--\s*tier:\s*(.*?)\s*-->$/.exec(line);
        if (tierMarker) {
            finish();
            tier = Number(tierMarker[1]);
            if (![1, 2, 3].includes(tier)) throw new Error('tier must be 1, 2, or 3');
            continue;
        }
        if (line.startsWith('## ')) {
            finish();
            q = { prompt: line.slice(3).trim(), choices: [], answer: -1, note: '' };
            if (tier !== undefined) q.tier = tier;
            continue;
        }
        if (line.startsWith('# ')) {
            deck.title = line.slice(2).trim();
            continue;
        }
        if (q === null) {
            if (line !== '')
                descLines.push(line);
            continue;
        }
        const choice = /^[-*]\s*\[([ xX])\]\s*(.+)$/.exec(line);
        if (choice !== null) {
            if (choice[1] !== ' ') {
                if (q.answer !== -1)
                    throw new Error(`question ${deck.questions.length + 1} ("${q.prompt}") has more than one [x] answer`);
                q.answer = q.choices.length;
            }
            q.choices.push(choice[2].trim());
            continue;
        }
        if (line.startsWith('>')) {
            const text = line.slice(1).trim();
            if (text !== '')
                q.note = q.note === '' ? text : `${q.note} ${text}`;
            continue;
        }
        // Plain text before the first choice continues the question prompt.
        if (line !== '' && q.choices.length === 0)
            q.prompt = `${q.prompt} ${line}`;
    }
    finish();

    if (deck.questions.length === 0)
        throw new Error('deck has no questions');
    deck.description = descLines.join(' ');
    return deck;
}

/** One question with its choices shuffled and the answer index remapped. */
function dealQuestion(q, rng, shuffleChoices) {
    if (!shuffleChoices)
        return { ...q, choices: [...q.choices] };
    const order = shuffle(q.choices.map((_, i) => i), rng);
    return {
        ...q,
        choices: order.map((i) => q.choices[i]),
        answer: order.indexOf(q.answer),
    };
}

/**
 * Start a round: pick up to `size` questions from the deck in random order.
 * Pass a seeded `rng` for a reproducible round.
 */
export function newRound(deck, options = {}) {
    const { size = DEFAULT_ROUND_SIZE, rng = Math.random, shuffleChoices = true } = options;
    if (!Number.isInteger(size) || size < 1)
        throw new Error(`round size must be a positive integer, got ${size}`);
    const picked = shuffle(deck.questions, rng).slice(0, Math.min(size, deck.questions.length));
    return {
        deckTitle: deck.title,
        questions: picked.map((q) => dealQuestion(q, rng, shuffleChoices)),
        index: 0,
        phase: 'ask',
        score: 0,
        streak: 0,
        bestStreak: 0,
        answers: [],
    };
}

export function currentQuestion(state) {
    return state.questions[state.index] ?? null;
}

export function isOver(state) {
    return state.phase === 'done';
}

/** Pick choice `choice` for the current question. Returns the reveal state. */
export function answer(state, choice) {
    if (state.phase !== 'ask')
        throw new Error(`cannot answer in phase "${state.phase}"`);
    const q = currentQuestion(state);
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices.length)
        throw new Error(`choice ${choice} out of range 0..${q.choices.length - 1}`);
    const correct = choice === q.answer;
    const streak = correct ? state.streak + 1 : 0;
    return {
        ...state,
        phase: 'reveal',
        score: state.score + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        answers: [...state.answers, { index: state.index, choice, correct }],
    };
}

/** Move on after a reveal; the round is done after the last question. */
export function next(state) {
    if (state.phase !== 'reveal')
        throw new Error(`cannot advance in phase "${state.phase}"`);
    const last = state.index + 1 >= state.questions.length;
    return { ...state, index: last ? state.index : state.index + 1, phase: last ? 'done' : 'ask' };
}

/** Score summary; valid in any phase (partial while the round is running). */
export function results(state) {
    const total = state.questions.length;
    const missed = state.answers.filter((a) => !a.correct).map((a) => state.questions[a.index]);
    return {
        score: state.score,
        total,
        answered: state.answers.length,
        pct: total === 0 ? 0 : Math.round((state.score / total) * 100),
        bestStreak: state.bestStreak,
        perfect: state.answers.length === total && state.score === total,
        missed,
    };
}

/** A new round made only of the questions missed so far, or null if none. */
export function retryRound(state, options = {}) {
    const { missed } = results(state);
    if (missed.length === 0)
        return null;
    return newRound({ title: state.deckTitle, questions: missed }, { ...options, size: missed.length });
}
