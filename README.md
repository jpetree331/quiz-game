# Next Stop — a quiz for the ride

A multiple-choice quiz you can finish in the two minutes before your stop.
Pick a deck, answer ten questions, see what you missed, try those again.
Runs in any browser — a phone, a Chromebook, or a TV with a remote.

Decks are **plain markdown files**. Anyone who can type can write one.

---

## How to play

**Objective** — Get as many right as you can. Nothing is timed.

**A round** — 5, 10 or 15 questions drawn at random from the chosen deck.
Answer choices are shuffled every time, so the right answer is never "always B".

**Answering** — Tap a choice, press its number key (1–4), or move with the
arrow keys and press Enter. After each answer the right choice lights up green,
a wrong pick lights up red, and the deck's note for that question (if any) is
shown. Press Enter, Space or → to continue.

**Streak** — Consecutive right answers are counted; the best streak is shown at
the end.

**Retry** — When the round ends, every question you missed can be replayed as a
short extra round. Keep retrying until there is nothing left to miss.

**Best score** — The best percentage per deck is remembered in the browser
(nothing is sent anywhere).

## Features

- **Keyboard-only play** — number keys, arrows and Enter are enough; works with a
  TV remote or a keyboard, no mouse required
- **Bring your own deck** — open any `.md` file from your device with the file
  picker on the start screen
- **Three bundled decks** — science basics, world capitals, German first words
- Transit-signage look: deck "lines" as ticket cards, a station strip that lights
  each stop green or red as you answer, a score ring at the end of the line
- Score, streak and elapsed time in the end-of-round summary; honours
  `prefers-reduced-motion`
- **No install, no build, no dependencies** — plain ECMAScript modules and CSS

## Project structure

```
nextstop_quiz/
├── index.html          app shell — loads ./src/main.js as an ES module
├── style.css           styling
├── src/
│   ├── engine.js       pure quiz engine (no DOM): deck parser, rounds,
│   │                   scoring, streaks, retry of missed questions
│   ├── decks.js        loads bundled decks and user-supplied .md files
│   └── main.js         UI controller: rendering, click/keyboard input
├── decks/
│   ├── science-basics.md
│   ├── world-capitals.md
│   └── german-first-words.md
├── test/
│   └── engine.test.js  node --test suite for the engine and bundled decks
├── generate-zip.js     packs the app into nextstop-web.zip (Node, no deps)
└── README.md
```

Pure **ECMA-262** JavaScript — no TypeScript, no bundler, no build step, no
dependencies. The engine (`engine.js`) is a framework-free module: it can be
imported and driven from Node or a test suite without a browser.

## Running

```sh
python3 -m http.server 8000     # or any static file server
# open http://localhost:8000
```

No `npm install`, no compilation. ES modules and `fetch` require HTTP —
opening `index.html` directly via `file://` is blocked by browser CORS rules.

Run the tests (Node ≥ 18, no flags):

```sh
node --test
```

## Deck format

A deck is one markdown file:

```markdown
# Deck title
A description line or two. Shown on the start screen.

## What is the chemical symbol for gold?
- [x] Au
- [ ] Ag
- [ ] Go
- [ ] Gd
> Au comes from the Latin word aurum.

## Which planet is closest to the Sun?
- [x] Mercury
- [ ] Venus
- [ ] Earth
```

| Line | Meaning |
| --- | --- |
| `# …` | Deck title (once, at the top) |
| plain text before the first `##` | Deck description |
| `## …` | A question. Plain lines that follow continue the question text. |
| `- [x] …` | The right answer (exactly one per question) |
| `- [ ] …` | A wrong answer (`*` works too). At least two choices per question. |
| `> …` | Optional note shown after answering |

The file also reads fine as a checklist in any markdown viewer or editor.
Broken decks are rejected with a message that names the question.

## Engine API

| Function | Description |
| --- | --- |
| `parseDeck(markdown)` | Parse a markdown deck into `{ title, description, questions }`. Throws on malformed input. |
| `newRound(deck, opts?)` | Start a round: `size` questions (default 10) in random order with shuffled choices. Pass `rng` (see `seededRng`) for a reproducible round; `shuffleChoices: false` keeps the file order. |
| `currentQuestion(state)` | The question being asked, or `null`. |
| `answer(state, choice)` | Pick choice index `choice`. Returns the reveal state with score and streak updated. Throws outside the `ask` phase or for an out-of-range choice. |
| `next(state)` | Advance after a reveal; sets `phase` to `done` after the last question. |
| `isOver(state)` | `true` once the round is done. |
| `results(state)` | `{ score, total, answered, pct, bestStreak, perfect, missed }` — valid mid-round too. |
| `retryRound(state, opts?)` | A new round made only of the missed questions, or `null` if none. |
| `seededRng(seed)` | Small deterministic PRNG for tests and reproducible rounds. |

State is never mutated; every call returns a new state object. `phase` is one
of `ask`, `reveal`, `done`.

## Packaging

```sh
node generate-zip.js     # writes nextstop-web.zip (app files + decks, no dependencies)
```

The zip contains `index.html`, `style.css`, `src/*.js` and `decks/*.md` with
relative paths, so it can be unzipped and served from anywhere — or dropped
into a Capacitor project as the web folder.

## Verification

`node --test` checks:

- deck parsing: title, description, multi-line prompts, notes, `-`/`*` bullets;
  malformed decks (no questions, no answer, two answers, one choice) are rejected
  with a message naming the question
- every bundled deck parses and has at least ten well-formed questions
- rounds never exceed the deck size; shuffled choices keep the right answer text
- seeded rounds are byte-for-byte reproducible
- scoring, streaks, best streak, phase transitions and illegal calls
- retry rounds contain exactly the missed questions and nothing when perfect
- 200 seeded random-play rounds across the bundled decks: every round
  terminates after exactly `size` answers with the score matching the
  independently counted hits

## Attribution

Made by Jess (Culurien) as a sample for the "games for the ride" collection.
Free to play and to copy. Write decks, share decks.
