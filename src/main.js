import { answer, currentQuestion, newRound, next, results, retryRound } from './engine.js';
import { BUNDLED, loadBundledDeck, loadDeckFile } from './decks.js';

const app = {
    deck: null,
    round: null,
    startedAt: 0,
    elapsedMs: 0,
};

const $ = (id) => document.getElementById(id);
const startEl = $('start');
const playEl = $('play');
const deckSel = $('deck');
const sizeSel = $('size');
const deckInfo = $('deck-info');
const deckFile = $('deck-file');
const startBtn = $('start-round');
const progressEl = $('progress');
const progressBar = $('progress-bar');
const scoreEl = $('score');
const streakEl = $('streak');
const promptEl = $('prompt');
const choicesEl = $('choices');
const feedbackEl = $('feedback');
const noteEl = $('note');
const nextBtn = $('next');
const quitBtn = $('quit');
const overlayEl = $('overlay');
const overlayTitle = $('overlay-title');
const overlaySub = $('overlay-sub');
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
function fillDeckSelect() {
    deckSel.innerHTML = '';
    for (const d of BUNDLED) {
        const opt = document.createElement('option');
        opt.value = d.file;
        opt.textContent = d.title;
        deckSel.appendChild(opt);
    }
}

function describeDeck() {
    if (app.deck === null) {
        deckInfo.textContent = 'Loading deck…';
        startBtn.disabled = true;
        return;
    }
    const n = app.deck.questions.length;
    const best = readBest(app.deck.title);
    deckInfo.textContent =
        `${app.deck.title} · ${n} question${n === 1 ? '' : 's'}` +
        (app.deck.description ? ` · ${app.deck.description}` : '') +
        (best > 0 ? ` · best ${best}%` : '');
    startBtn.disabled = false;
}

async function selectBundledDeck(file) {
    app.deck = null;
    describeDeck();
    try {
        app.deck = await loadBundledDeck(file);
    }
    catch (err) {
        deckInfo.textContent = `Could not load deck: ${err.message}`;
        return;
    }
    describeDeck();
}

async function selectOwnDeck(file) {
    app.deck = null;
    describeDeck();
    try {
        app.deck = await loadDeckFile(file);
    }
    catch (err) {
        deckInfo.textContent = `${file.name}: ${err.message}`;
        return;
    }
    const opt = document.createElement('option');
    opt.value = `file:${file.name}`;
    opt.textContent = `${app.deck.title} (your file)`;
    deckSel.appendChild(opt);
    deckSel.value = opt.value;
    describeDeck();
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
    if (app.deck === null)
        return;
    startRound(newRound(app.deck, { size: Number(sizeSel.value) }));
}

function choose(i) {
    if (app.round === null || app.round.phase !== 'ask')
        return;
    app.round = answer(app.round, i);
    render();
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
    describeDeck();
    startBtn.focus();
}

function render() {
    const { round } = app;
    if (round === null)
        return;
    const q = currentQuestion(round);
    const total = round.questions.length;
    const shown = Math.min(round.index + 1, total);

    progressEl.textContent = `${shown} / ${total}`;
    progressBar.style.width = `${(round.answers.length / total) * 100}%`;
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
        nextBtn.textContent = round.index + 1 >= total ? 'See results' : 'Next';
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
    overlayTitle.textContent = r.perfect ? 'Perfect run!' : `${r.score} of ${r.total}`;
    overlaySub.textContent =
        `${r.pct}% · best streak ${r.bestStreak} · ${formatElapsed(app.elapsedMs)}`;
    const best = readBest(app.round.deckTitle);
    bestEl.textContent = best > 0 ? `Best on this deck: ${best}%` : '';
    retryBtn.hidden = r.missed.length === 0;
    retryBtn.textContent = `Retry the ${r.missed.length} missed`;
    overlayEl.hidden = false;
    (r.missed.length > 0 ? retryBtn : againBtn).focus();
}

function hideOverlay() {
    overlayEl.hidden = true;
}

// --- keyboard: number keys, arrows and Enter are enough for a TV remote ------
function moveFocus(delta) {
    const items = [...playEl.querySelectorAll('button:not([hidden]):not([disabled])')];
    if (items.length === 0)
        return;
    const i = items.indexOf(document.activeElement);
    const nextIndex = i === -1 ? 0 : (i + delta + items.length) % items.length;
    items[nextIndex].focus();
}

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
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
            ev.preventDefault();
            const items = [...overlayEl.querySelectorAll('button:not([hidden])')];
            items[(items.indexOf(document.activeElement) + 1) % items.length].focus();
        }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
            ev.preventDefault();
            const items = [...overlayEl.querySelectorAll('button:not([hidden])')];
            const i = items.indexOf(document.activeElement);
            items[(i - 1 + items.length) % items.length].focus();
        }
        return;
    }
    if (app.round === null) {
        if (ev.key === 'Enter' && document.activeElement === document.body)
            startBtn.focus();
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
        moveFocus(1);
    }
    else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        moveFocus(-1);
    }
    else if (ev.key === 'Escape') {
        backToMenu();
    }
});

deckSel.addEventListener('change', () => {
    if (!deckSel.value.startsWith('file:'))
        selectBundledDeck(deckSel.value);
});
deckFile.addEventListener('change', () => {
    const file = deckFile.files[0];
    if (file !== undefined)
        selectOwnDeck(file);
});
startBtn.addEventListener('click', beginFromMenu);
nextBtn.addEventListener('click', advance);
quitBtn.addEventListener('click', backToMenu);
retryBtn.addEventListener('click', () => startRound(retryRound(app.round)));
againBtn.addEventListener('click', () => startRound(newRound(app.deck, { size: Number(sizeSel.value) })));
menuBtn.addEventListener('click', backToMenu);

fillDeckSelect();
selectBundledDeck(deckSel.value);
