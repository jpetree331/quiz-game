import { answer, currentQuestion, newRound, next, results, retryRound } from './engine.js';
import { BUNDLED, loadBundledDeck, loadDeckFile } from './decks.js';
import { STORAGE_KEY, emptyProgress, decodeProgress, recordAnswer, completeTrip, summary, collectedCount, topicProgress, discoveryDeck, localDate } from './progress.js';

const $ = id => document.getElementById(id);
const app = { decks: new Map(), deckId: BUNDLED[0].file, size: 5, round: null, progress: emptyProgress(), earned: 0, startedAt: 0, retry: false };
const icons = {
  science: '<path d="M9 3h6m-5 0v7L4 20q-1 2 2 2h12q3 0 2-2l-6-10V3M8 15h8"/><circle cx="11" cy="18" r="1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
  leaf: '<path d="M20 3C9 2 3 8 5 15s15 5 15-12ZM4 22 16 8M9 17v-6m0 6h6"/>',
  planet: '<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="12" ry="3.5" transform="rotate(-30 12 12)"/><path d="M20 2v4m-2-2h4"/>',
  art: '<path d="M12 3a9 9 0 1 0 0 18h1c3 0 3-4 1-4h-1c-2 0-2-3 0-3h4c7 0 5-11-5-11Z"/><circle cx="7" cy="10" r=".8"/><circle cx="10" cy="6" r=".8"/><circle cx="16" cy="7" r=".8"/><circle cx="6" cy="15" r=".8"/>',
  chat: '<path d="M4 4h16v12H10l-6 4V4Z"/><path d="m8 13 3-6 3 6m-5-2h4m2-4h2m-1 0v6"/>'
};
const metadata = id => BUNDLED.find(d => d.file === id) ?? { title: app.decks.get(id)?.title, subtitle: 'Your own little collection.', icon: 'chat', tint: '#e5e8dc', tone: '#526834' };
const currentDeck = () => app.decks.get(app.deckId);
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(app.progress)); }
  catch { $('storage-warning').hidden = false; }
}
try { app.progress = decodeProgress(localStorage.getItem(STORAGE_KEY)); }
catch { $('storage-warning').hidden = false; }
function legacyBest(title) {
  try { const n = Number(localStorage.getItem(`nextstop:best:${title}`)); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; }
  catch { return 0; }
}
function bestScore() { return Math.max(topicProgress(app.progress, app.deckId).best, legacyBest(currentDeck().title)); }
function renderJourney() {
  const s = summary(app.progress);
  $('total-xp').textContent = s.xp.toLocaleString();
  $('total-collected').textContent = s.collected.toLocaleString();
  $('total-rides').textContent = s.trips.toLocaleString();
  $('journey-caption').textContent = s.collected ? `${s.collected} little discoveries. Where will you go next?` : 'Every discovery is a step forward.';
  const daily = app.progress.daily.date === localDate() ? app.progress.daily.answered : 0;
  $('daily-count').textContent = `${Math.min(5, daily)} / 5`;
  $('daily-fill').style.width = `${Math.min(100, daily * 20)}%`;
  $('daily-caption').textContent = daily >= 5 ? 'A little time well spent. Daily goal complete!' : 'Answer 5 questions. Give your curiosity a minute.';
}
function renderDeckList() {
  $('deck-list').replaceChildren();
  for (const [id, deck] of app.decks) {
    const meta = metadata(id), n = deck.questions.length, collected = collectedCount(app.progress, id, deck);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'deck-card'; btn.dataset.id = id;
    btn.style.setProperty('--tint', meta.tint); btn.style.setProperty('--tone', meta.tone);
    btn.setAttribute('aria-pressed', String(id === app.deckId));
    btn.innerHTML = `<span class="card-top"><span class="topic-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[meta.icon]}</svg></span><span class="selection-dot" aria-hidden="true">✓</span></span><span class="deck-title"></span><span class="deck-description"></span><span class="card-progress"><span class="progress-track" aria-hidden="true"><span style="width:${collected / n * 100}%"></span></span><span class="deck-meta"><span>${n} questions</span><b>${collected}/${n} collected</b></span></span>`;
    btn.querySelector('.deck-title').textContent = meta.title;
    btn.querySelector('.deck-description').textContent = meta.subtitle;
    btn.addEventListener('click', ev => {
      selectDeck(id);
      if (ev.detail && matchMedia('(max-width: 720px)').matches) {
        document.querySelector('.trip-panel').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    });
    $('deck-list').append(btn);
  }
  $('topic-count').textContent = `${app.decks.size} topics. Endless little discoveries.`;
  renderJourney();
}
function describeDeck() {
  const deck = currentDeck();
  $('start-round').disabled = !deck; $('surprise').disabled = !app.decks.size;
  $('selected-title').textContent = deck ? metadata(app.deckId).title : 'No topics available';
  $('deck-info').textContent = deck ? deck.description : 'Import a markdown deck to start a trip.';
  $('time-hint').textContent = `${Math.min(app.size, deck?.questions.length ?? app.size)} questions · your own pace`;
}
function selectDeck(id) {
  app.deckId = id;
  // Keep the actual focused button in place for keyboard and assistive technology users.
  for (const b of $('deck-list').children) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  describeDeck();
}
function selectSize(size) {
  app.size = size;
  for (const b of $('size-list').children) b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size));
  describeDeck();
}
async function loadBundled() {
  const loaded = await Promise.allSettled(BUNDLED.map(d => loadBundledDeck(d.file)));
  const failures = [];
  loaded.forEach((r, i) => {
    if (r.status === 'fulfilled') app.decks.set(BUNDLED[i].file, r.value);
    else failures.push(BUNDLED[i].title);
  });
  if (!app.decks.has(app.deckId)) app.deckId = app.decks.keys().next().value;
  if (failures.length) {
    $('load-error').textContent = `Couldn't load: ${failures.join(', ')}. Refresh to try again, or import a deck.`;
    $('load-error').hidden = false;
  }
  renderDeckList(); describeDeck();
}
function hideOverlay() { $('overlay').hidden = true; $('app').inert = false; document.body.style.overflow = ''; }
function startRound(round, retry = false) {
  if (!round) return;
  app.round = round; app.retry = retry; app.earned = 0; app.startedAt = Date.now();
  hideOverlay(); $('start').hidden = true; $('play').hidden = false;
  $('play-topic').textContent = `${metadata(app.deckId).title}${retry ? ' · Revisit' : ''}`;
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
}
function beginFromMenu() {
  const deck = currentDeck();
  if (deck) startRound(newRound(discoveryDeck(deck, app.progress, app.deckId, app.size), { size: app.size }));
}
function backToMenu() {
  app.round = null; hideOverlay(); $('play').hidden = true; $('start').hidden = false;
  renderDeckList(); describeDeck(); $('start-round').focus({ preventScroll: true });
}
function choose(i) {
  if (!app.round || app.round.phase !== 'ask') return;
  const q = currentQuestion(app.round);
  app.round = answer(app.round, i);
  const correct = app.round.answers.at(-1).correct;
  const recorded = recordAnswer(app.progress, app.deckId, q, correct);
  app.progress = recorded.progress; app.earned += recorded.earned;
  saveProgress(); render();
  if (correct && recorded.earned) $('feedback').textContent += ' +10 discovery XP';
  $('question').classList.remove('flash-good', 'flash-bad');
  void $('question').offsetWidth;
  $('question').classList.add(correct ? 'flash-good' : 'flash-bad');
  $('next').focus({ preventScroll: true });
}
function advance() {
  if (!app.round || app.round.phase !== 'reveal') return;
  app.round = next(app.round);
  if (app.round.phase === 'done') showOverlay();
  else render();
}
function render() {
  const r = app.round, q = currentQuestion(r), total = r.questions.length, reveal = r.phase === 'reveal';
  $('stations').replaceChildren(...r.questions.map((_, i) => {
    const dot = document.createElement('span');
    dot.className = `station ${r.answers[i] ? r.answers[i].correct ? 'good' : 'bad' : i === r.index ? 'current' : ''}`;
    return dot;
  }));
  $('q-label').textContent = `STOP ${r.index + 1} OF ${total}`;
  $('score').textContent = `${r.score} right`;
  $('streak').textContent = r.streak >= 2 ? `✦ ${r.streak} in a row` : '';
  $('prompt').textContent = q.prompt;
  document.querySelector('.keyboard-hint').textContent = q.choices.length <= 9 ? `Tap an answer or use keys 1–${q.choices.length}` : 'Tap an answer or use the arrow keys';
  $('choices').replaceChildren(...q.choices.map((text, i) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'choice';
    btn.innerHTML = `<span class="key" aria-hidden="true">${i + 1}</span><span class="choice-text"></span>`;
    btn.querySelector('.choice-text').textContent = text;
    if (reveal) {
      btn.disabled = true;
      const correct = i === q.answer, wrong = !correct && i === r.answers.at(-1).choice;
      if (correct || wrong) {
        btn.classList.add(correct ? 'correct' : 'wrong');
        const symbol = document.createElement('span'); symbol.className = 'answer-symbol'; symbol.textContent = correct ? '✓' : '×'; symbol.setAttribute('aria-hidden', 'true'); btn.append(symbol);
        btn.setAttribute('aria-label', `${text} — ${correct ? 'correct answer' : 'your answer, incorrect'}`);
      }
    } else btn.addEventListener('click', () => choose(i));
    return btn;
  }));
  $('next').hidden = !reveal;
  if (reveal) {
    const correct = r.answers.at(-1).correct;
    $('feedback').textContent = correct ? 'That’s the one!' : `A new discovery: ${q.choices[q.answer]}.`;
    $('feedback').className = `feedback ${correct ? 'good' : 'bad'}`;
    $('note').textContent = q.note; $('note').hidden = !q.note;
    $('next').textContent = r.index + 1 === total ? 'See your little wins →' : 'Next stop →';
  } else {
    $('feedback').textContent = ''; $('feedback').className = 'feedback'; $('note').hidden = true;
    $('prompt').focus({ preventScroll: true });
  }
}
function showOverlay() {
  const r = results(app.round);
  // Revisit rounds earn newly collected answers, but cannot inflate the full-trip best score.
  if (!app.retry) { app.progress = completeTrip(app.progress, app.deckId, r.pct); saveProgress(); }
  $('overlay-title').textContent = r.perfect ? 'What a brilliant little trip.' : r.pct >= 60 ? 'Look at you go.' : 'Curiosity looks good on you.';
  $('result-message').textContent = r.perfect ? 'Every stop, a little win. Where to next?' : 'A few new facts to take along for the ride.';
  $('earned-xp').textContent = app.earned ? `+${app.earned} XP · ${app.earned / 10} new answer${app.earned === 10 ? '' : 's'} collected` : 'Another step along the way.';
  $('stat-score').textContent = `${r.score} / ${r.total}`; $('stat-streak').textContent = r.bestStreak;
  const seconds = Math.round((Date.now() - app.startedAt) / 1000);
  $('stat-time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('best').textContent = `Best trip on this topic: ${bestScore()}%${app.retry ? ' · This was a practice trip' : ''}`;
  $('retry').hidden = !r.missed.length; $('retry').textContent = `Revisit ${r.missed.length} missed question${r.missed.length === 1 ? '' : 's'} →`;
  $('ring-pct').textContent = `${r.pct}%`;
  $('ring-fill').style.strokeDashoffset = String(2 * Math.PI * 52);
  $('overlay').hidden = false; $('app').inert = true; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { $('ring-fill').style.strokeDashoffset = String(2 * Math.PI * 52 * (1 - r.pct / 100)); });
  (r.missed.length ? $('retry') : $('play-again')).focus();
}
function focusables(container) { return [...container.querySelectorAll('button:not([disabled]),a[href]')].filter(b => b.getClientRects().length); }
function moveFocus(container, delta) {
  const items = focusables(container), i = items.indexOf(document.activeElement);
  if (items.length) items[i < 0 ? 0 : (i + delta + items.length) % items.length].focus();
}
document.addEventListener('keydown', ev => {
  if (ev.repeat || ev.ctrlKey || ev.altKey || ev.metaKey) return;
  if (!$('overlay').hidden) {
    if (ev.key === 'Escape') { ev.preventDefault(); backToMenu(); return; }
    if (ev.key === 'Tab') {
      const items = focusables($('overlay')), first = items[0], last = items.at(-1);
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
    if (ev.key.startsWith('Arrow')) { ev.preventDefault(); moveFocus($('overlay'), ['ArrowUp','ArrowLeft'].includes(ev.key) ? -1 : 1); }
    return;
  }
  if (!app.round) {
    if (ev.key.startsWith('Arrow')) { ev.preventDefault(); moveFocus($('start'), ['ArrowUp','ArrowLeft'].includes(ev.key) ? -1 : 1); }
    return;
  }
  if (ev.key === 'Escape') { ev.preventDefault(); backToMenu(); return; }
  if (app.round.phase === 'ask' && /^[1-9]$/.test(ev.key)) {
    const i = Number(ev.key) - 1;
    if (i < currentQuestion(app.round).choices.length) { ev.preventDefault(); choose(i); }
  } else if (app.round.phase === 'reveal' && (ev.key === 'ArrowRight' || (ev.key === ' ' && document.activeElement !== $('quit')))) {
    ev.preventDefault(); advance();
  } else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)) {
    ev.preventDefault(); moveFocus($('play'), ['ArrowUp','ArrowLeft'].includes(ev.key) ? -1 : 1);
  }
});
$('size-list').addEventListener('click', ev => { const b = ev.target.closest('[data-size]'); if (b) selectSize(Number(b.dataset.size)); });
$('start-round').addEventListener('click', beginFromMenu);
$('surprise').addEventListener('click', () => { const ids = [...app.decks.keys()]; if (!ids.length) return; selectDeck(ids[Math.floor(Math.random() * ids.length)]); selectSize(5); beginFromMenu(); });
$('next').addEventListener('click', advance); $('quit').addEventListener('click', backToMenu);
$('retry').addEventListener('click', () => startRound(retryRound(app.round), true));
$('play-again').addEventListener('click', beginFromMenu); $('to-menu').addEventListener('click', backToMenu);
$('journey-link').addEventListener('click', () => { if (app.round) backToMenu(); renderJourney(); $('journey').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); $('journey').focus({ preventScroll: true }); });
$('open-file').addEventListener('click', () => $('deck-file').click());
$('deck-file').addEventListener('change', async () => {
  const file = $('deck-file').files[0]; if (!file) return;
  try {
    const deck = await loadDeckFile(file), id = `file:${file.name}`;
    app.decks.set(id, deck); app.deckId = id;
    $('load-error').hidden = true;
    renderDeckList(); describeDeck(); $('start-round').focus();
  } catch (err) {
    const message = err.message.length > 260 ? `${err.message.slice(0, 160)}…${err.message.slice(-100)}` : err.message;
    $('load-error').textContent = `${file.name}: ${message}`; $('load-error').hidden = false;
  }
  $('deck-file').value = '';
});
// Refresh from other tabs before future interactions, without inventing or overwriting history on load.
window.addEventListener('storage', ev => { if (ev.key === STORAGE_KEY) { app.progress = decodeProgress(ev.newValue); if (!app.round) renderDeckList(); } });
renderJourney(); loadBundled();
