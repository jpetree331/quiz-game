import { answer, currentQuestion, newRound, next, results, retryRound } from './engine.js';
import { BUNDLED, loadBundledDeck, loadDeckFile } from './decks.js';

const LINE_COLORS = ['#f5b342', '#5ec8ff', '#ff7ab6', '#3ddc84', '#c792ea', '#ffa447'];
const RING_LENGTH = 2 * Math.PI * 52;

const app = {
    decks: new Map(), // id -> parsed deck (bundled decks load at startup)
    deckId: BUNDLED[0].file,
    size: 10,
    round: null,
    startedAt: 0,
    elapsedMs: 0,
};

const $ = (id) => document.getElementById(id);
const startEl = $('start');
const playEl = $('play');
const deckListEl = $('deck-list');
const sizeListEl = $('size-list');
const deckInfo = $('deck-info');
const deckFile = $('deck-file');
const openFileBtn = $('open-file');
const startBtn = $('start-round');
const stationsEl = $('stations');
const qLabel = $('q-label');
const scoreEl = $('score');
const streakEl = $('streak');
const questionEl = $('question');
const promptEl = $('prompt');
const choicesEl = $('choices');
const feedbackEl = $('feedback');
const noteEl = $('note');
const nextBtn = $('next');
const quitBtn = $('quit');
const overlayEl = $('overlay');
const overlayTitle = $('overlay-title');
const ringFill = $('ring-fill');
const ringPct = $('ring-pct');
const statScore = $('stat-score');
const statStreak = $('stat-streak');
const statTime = $('stat-time');
const bestEl = $('best');
const retryBtn = $('retry');
const againBtn = $('play-again');
const menuBtn = $('to-menu');

// --- best scores (per deck, this browser only) --------------------------------
function bestKey(title) {
    return `nextstop:best:${title}`;
}
function readBest(title) {
    try {
        return Number(localStorage.getItem(bestKey(title))) || 0;
    }
    catch {
        return 0;
    }
}
function writeBest(title, pct) {
    try {
        if (pct > readBest(title))
            localStorage.setItem(bestKey(title), String(pct));
    }
    catch {
        /* storage unavailable — scores just aren't remembered */
    }
}

// --- start screen -------------------------------------------------------------
function currentDeck() {
    return app.decks.get(app.deckId) ?? null;
}

function renderDeckList() {
    deckListEl.innerHTML = '';
    let i = 0;
    for (const [id, deck] of app.decks) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'deck-card';
        btn.dataset.id = id;
        btn.style.setProperty('--line', LINE_COLORS[i % LINE_COLORS.length]);
        btn.setAttribute('aria-pressed', String(id === app.deckId));
        const n = deck.questions.length;
        btn.innerHTML =
            '<span class="check">✓</span>' +
            '<span class="deck-title"></span>' +
            `<span class="deck-meta">${n} question${n === 1 ? '' : 's'}${readBest(deck.title) > 0 ? ` · best ${readBest(deck.title)}%` : ''}</span>`;
        btn.querySelector('.deck-title').textContent = deck.title;
        btn.addEventListener('click', () => selectDeck(id));
        deckListEl.appendChild(btn);
        i++;
    }
}

function describeDeck() {
    const deck = currentDeck();
    if (deck === null) {
        deckInfo.textContent = app.decks.size === 0 ? 'Loading decks…' : 'Pick a line to board.';
        startBtn.disabled = true;
        return;
    }
    deckInfo.textContent = deck.description || `${deck.title}.`;
    startBtn.disabled = false;
}

function selectDeck(id) {
    app.deckId = id;
    renderDeckList();
    describeDeck();
    const card = deckListEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (card !== null)
        card.focus();
}

function selectSize(size) {
    app.size = size;
    for (const b of sizeListEl.querySelectorAll('.seg'))
        b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size));
}

async function loadBundled() {
    for (const d of BUNDLED) {
        try {
            app.decks.set(d.file, await loadBundledDeck(d.file));
        }
        catch (err) {
            deckInfo.textContent = `Could not load ${d.title}: ${err.message}`;
        }
    }
    if (!app.decks.has(app.deckId))
        app.deckId = app.decks.keys().next().value ?? null;
    renderDeckList();
    describeDeck();
}

async function openOwnDeck(file) {
    let deck;
    try {
        deck = await loadDeckFile(file);
    }
    catch (err) {
        deckInfo.textContent = `${file.name}: ${err.message}`;
        return;
    }
    const id = `file:${file.name}`;
    app.decks.set(id, deck);
    selectDeck(id);
}

// --- round ----------------------------------------------------------------------
function startRound(round) {
    app.round = round;
    app.startedAt = Date.now();
    startEl.hidden = true;
    playEl.hidden = false;
    hideOverlay();
    render();
}

function beginFromMenu() {
    const deck = currentDeck();
    if (deck === null)
        return;
    startRound(newRound(deck, { size: app.size }));
}

function flash(kind) {
    questionEl.classList.remove('flash-good', 'flash-bad');
    void questionEl.offsetWidth; // restart the animation
    questionEl.classList.add(kind === 'good' ? 'flash-good' : 'flash-bad');
}

function choose(i) {
    if (app.round === null || app.round.phase !== 'ask')
        return;
    app.round = answer(app.round, i);
    render();
    flash(app.round.answers[app.round.answers.length - 1].correct ? 'good' : 'bad');
    nextBtn.focus();
}

function advance() {
    if (app.round === null || app.round.phase !== 'reveal')
        return;
    app.round = next(app.round);
    if (app.round.phase === 'done') {
        app.elapsedMs = Date.now() - app.startedAt;
        render();
        showOverlay();
        return;
    }
    render();
}

function backToMenu() {
    app.round = null;
    hideOverlay();
    playEl.hidden = true;
    startEl.hidden = false;
    renderDeckList();
    describeDeck();
    startBtn.focus();
}

function renderStations(round) {
    const total = round.questions.length;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = 'station';
        const a = round.answers[i];
        if (a !== undefined)
            dot.classList.add(a.correct ? 'good' : 'bad');
        else if (i === round.index && round.phase !== 'done')
            dot.classList.add('current');
        frag.appendChild(dot);
    }
    stationsEl.replaceChildren(frag);
}

function render() {
    const { round } = app;
    if (round === null)
        return;
    const q = currentQuestion(round);
    const total = round.questions.length;

    renderStations(round);
    qLabel.textContent = `Stop ${Math.min(round.index + 1, total)} of ${total}`;
    scoreEl.textContent = `${round.score} right`;
    streakEl.textContent = round.streak >= 2 ? `🔥 ${round.streak} in a row` : '';

    promptEl.textContent = q.prompt;

    const reveal = round.phase === 'reveal';
    const last = reveal ? round.answers[round.answers.length - 1] : null;
    choicesEl.innerHTML = '';
    q.choices.forEach((text, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice';
        btn.dataset.index = String(i);
        btn.innerHTML = `<span class="key">${i + 1}</span><span class="choice-text"></span>`;
        btn.querySelector('.choice-text').textContent = text;
        if (reveal) {
            btn.disabled = true;
            if (i === q.answer)
                btn.classList.add('correct');
            else if (i === last.choice)
                btn.classList.add('wrong');
        }
        else {
            btn.addEventListener('click', () => choose(i));
        }
        choicesEl.appendChild(btn);
    });

    if (reveal) {
        feedbackEl.textContent = last.correct ? 'Right!' : 'Not quite.';
        feedbackEl.className = last.correct ? 'feedback good' : 'feedback bad';
        noteEl.textContent = q.note;
        noteEl.hidden = q.note === '';
        nextBtn.hidden = false;
        nextBtn.innerHTML = round.index + 1 >= total
            ? 'End of the line <span class="arrow" aria-hidden="true">→</span>'
            : 'Next stop <span class="arrow" aria-hidden="true">→</span>';
    }
    else {
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback';
        noteEl.hidden = true;
        nextBtn.hidden = true;
        const first = choicesEl.querySelector('.choice');
        if (first !== null)
            first.focus();
    }
}

function formatElapsed(ms) {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function showOverlay() {
    const r = results(app.round);
    writeBest(app.round.deckTitle, r.pct);
    overlayTitle.textContent = r.perfect
        ? 'Perfect ride!'
        : r.pct >= 70 ? 'Nicely done.' : r.pct >= 40 ? 'Getting there.' : 'Rough ride. Try again?';
    statScore.textContent = `${r.score} / ${r.total}`;
    statStreak.textContent = String(r.bestStreak);
    statTime.textContent = formatElapsed(app.elapsedMs);
    const best = readBest(app.round.deckTitle);
    bestEl.textContent = best > 0 ? `Best on this line: ${best}%` : '';
    retryBtn.hidden = r.missed.length === 0;
    retryBtn.textContent = `Retry the ${r.missed.length} missed`;

    ringPct.textContent = `${r.pct}%`;
    ringFill.style.stroke = r.pct === 100 ? 'var(--good)' : 'var(--accent)';
    ringFill.style.strokeDashoffset = String(RING_LENGTH);
    overlayEl.hidden = false;
    requestAnimationFrame(() => {
        ringFill.style.strokeDashoffset = String(RING_LENGTH * (1 - r.pct / 100));
    });
    (r.missed.length > 0 ? retryBtn : againBtn).focus();
}

function hideOverlay() {
    overlayEl.hidden = true;
}

// --- keyboard: number keys, arrows and Enter are enough for a TV remote ------
function focusables(container) {
    return [...container.querySelectorAll('button:not([hidden]):not([disabled])')]
        .filter((b) => b.offsetParent !== null);
}

function moveFocus(container, delta) {
    const items = focusables(container);
    if (items.length === 0)
        return;
    const i = items.indexOf(document.activeElement);
    items[i === -1 ? 0 : (i + delta + items.length) % items.length].focus();
}

const BACK = new Set(['ArrowUp', 'ArrowLeft']);
const FORWARD = new Set(['ArrowDown', 'ArrowRight']);

document.addEventListener('keydown', (ev) => {
    // Enter always activates the focused button — explicit, so it behaves the
    // same on every remote/keyboard and never double-fires with the native click.
    const active = document.activeElement;
    if (ev.key === 'Enter' && active instanceof HTMLButtonElement && !active.disabled && !active.hidden) {
        ev.preventDefault();
        active.click();
        return;
    }

    if (!overlayEl.hidden) {
        if (BACK.has(ev.key) || FORWARD.has(ev.key)) {
            ev.preventDefault();
            moveFocus(overlayEl, BACK.has(ev.key) ? -1 : 1);
        }
        return;
    }

    if (app.round === null) {
        if (BACK.has(ev.key) || FORWARD.has(ev.key)) {
            ev.preventDefault();
            moveFocus(startEl, BACK.has(ev.key) ? -1 : 1);
        }
        return;
    }

    const q = currentQuestion(app.round);
    if (app.round.phase === 'ask' && /^[1-9]$/.test(ev.key)) {
        const i = Number(ev.key) - 1;
        if (i < q.choices.length) {
            ev.preventDefault();
            choose(i);
        }
        return;
    }
    if (app.round.phase === 'reveal' && (ev.key === ' ' || ev.key === 'ArrowRight')) {
        ev.preventDefault();
        advance();
        return;
    }
    if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        moveFocus(playEl, 1);
    }
    else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        moveFocus(playEl, -1);
    }
    else if (ev.key === 'Escape') {
        backToMenu();
    }
});

sizeListEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg');
    if (b !== null)
        selectSize(Number(b.dataset.size));
});
openFileBtn.addEventListener('click', () => deckFile.click());
deckFile.addEventListener('change', () => {
    const file = deckFile.files[0];
    if (file !== undefined)
        openOwnDeck(file);
    deckFile.value = '';
});
startBtn.addEventListener('click', beginFromMenu);
nextBtn.addEventListener('click', advance);
quitBtn.addEventListener('click', backToMenu);
retryBtn.addEventListener('click', () => startRound(retryRound(app.round)));
againBtn.addEventListener('click', () => startRound(newRound(currentDeck(), { size: app.size })));
menuBtn.addEventListener('click', backToMenu);

describeDeck();
loadBundled();
