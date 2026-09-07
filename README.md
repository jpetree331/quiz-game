# Next Stop — a quiz for the ride

A multiple-choice quiz you can finish in the two minutes before your stop.
Pick a topic, answer five questions, see what you discovered, try the missed ones again.
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

**Progress** — Each new correct answer earns 10, 20, or 30 discovery XP according to its tier and fills the topic's
collection bar. Progress saves after every answer, including unfinished trips.
New rounds favor unseen questions, then previously missed ones, then collected ones.
Answer five questions to complete the small daily goal (based on your device's date).

**Best score** — The best percentage per topic and tier is remembered in the browser.
Practice trips do not replace full-trip best scores or add to completed trip counts.
Existing best scores from the original version are still recognized. No data is sent
anywhere. If browser storage is blocked or full, a notice explains that progress
only lasts for the current visit. Imported decks must be reopened after a reload;
their progress is remembered when the same file and questions are reopened.

## Features

- **Keyboard-only play** — number keys, arrows and Enter are enough; works with a
  TV remote or a keyboard, no mouse required
- **Bring your own deck** — open any `.md` file from your device with the file
  picker on the start screen
- **Six topics, 360 questions** — everyday science, world capitals, nature,
  space, arts and words, and German vocabulary and grammar; 60 questions per topic
- Warm cream-and-ink design, original SVG bus illustration, colorful topic icons,
  ticket-style round settings, and layouts for phones and larger screens
- **Quick trip** — starts five questions from a surprise topic in one tap
- Per-topic collections, discovery XP, daily goal, and completed-trip totals
- A station strip shows the journey; clear answer feedback and an animated score
  ring celebrate the little wins
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
│   ├── main.js         UI controller: rendering, click/keyboard input
│   ├── tiers.js        route names, rewards, and tier filtering
│   └── progress.js     persistent topic collections and discovery selection
├── decks/
│   ├── science-basics.md
│   ├── world-capitals.md
│   ├── german-first-words.md
│   ├── nature-wildlife.md
│   ├── space-explorer.md
│   └── arts-language.md
├── assets/journey.svg  original transit illustration (no remote assets)
├── test/
│   ├── engine.test.js  engine, parser, and randomized round tests
│   ├── progress.test.js progress rules and expanded deck checks
│   ├── tiers.test.js    unlocks, weighted XP, migrations, and backups
│   └── fixtures/       import deck and progress migration examples
├── serve.js            local-only preview server
├── package.json        optional npm shortcuts (no dependencies)
├── QUESTION-SOURCES.md additions, CC0 scope, and reference notes
├── VERIFICATION.md     browser and packaging checks
├── generate-zip.js     packs the app into nextstop-web.zip (Node, no deps)
└── README.md
```

Pure **ECMA-262** JavaScript — no TypeScript, no bundler, no build step, no
dependencies. The engine (`engine.js`) is a framework-free module: it can be
imported and driven from Node or a test suite without a browser.

## Running

```sh
node serve.js
# open http://localhost:8015
```

The preview server uses **port 8015** and listens only on this computer. Port 8000 is reserved for another local agent API; do not use it for quiz tests. For phone access or a public
release, host the app files on a static web host. Any static HTTP server also works.

No `npm install`, no compilation. ES modules and `fetch` require HTTP —
opening `index.html` directly via `file://` is blocked by browser CORS rules.

Run the tests (Node ≥ 18, no flags):

```sh
node --test
```

## Routes and saved progress

Each topic now has three routes:

| Tier | Questions per topic | XP per newly collected correct answer | Unlock |
| --- | ---: | ---: | --- |
| Curious | 30 | 10 | Available immediately |
| Explorer | 15 | 20 | Collect 10 Curious answers in this topic |
| Expert | 15 | 30 | Collect 10 Explorer answers in this topic |

Earlier routes stay playable. Wrong answers do not remove XP. A retry can collect a missed answer at its original reward, but a collected question never pays twice. Best trip scores are tracked separately for each tier. For short imported decks the gate uses the smaller of ten or the preceding tier's question count.

Progress is stored in browser localStorage under the existing key `nextstop:journey:v1`. The payload is now version 2; old version-1 saves migrate automatically and retain their 10-XP awards, questions, best score, daily count, and trips. New tier metadata does not change a question's identity.

Expand **Your progress, to go** to download a JSON backup or restore one. Restore merges collections and retains existing discoveries. Re-importing the same backup adds no XP. Per-topic trip counts and daily counts use the higher count when merging, rather than adding duplicate history; backups are portable saves, not continuous multi-device synchronization.

Browser storage is specific to the site's origin, including its port. A move from localhost:8000 to localhost:8015 shows a separate save; the older origin's data is not erased or automatically accessible from the new port. Clearing site data or using temporary/private browser storage can also remove local saves. Download a backup for portability.

The core game requires no account or application backend. Accounts and public leaderboards are a proposed next phase, documented in [ACCOUNTS.md](ACCOUNTS.md).

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

Optional tier section markers such as `<!-- tier: 2 -->` apply to subsequent questions. Supported tiers are 1, 2, and 3; an unmarked deck defaults to Curious. Markers remain invisible in rendered Markdown.

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

The zip contains `index.html`, `style.css`, `src/*.js`, `decks/*.md`, the original
SVG illustration, and `QUESTION-SOURCES.md` with
relative paths, so it can be unzipped and served from anywhere — or dropped
into a Capacitor project as the web folder.

## Verification

`node --test` checks:

- deck parsing: title, description, multi-line prompts, notes, `-`/`*` bullets;
  malformed decks (no questions, no answer, two answers, one choice) are rejected
  with a message naming the question
- every bundled deck parses and has at least ten well-formed questions
- exactly six registered decks with 60 unique four-choice questions each
- progress persistence rules, corrupt-data recovery, local-day rollover, shuffled
  question identity, no duplicate XP, and discovery selection priorities
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

The 2026-09-07 makeover and tier expansion add 324 independently written factual questions with
a CC0 dedication scoped to those additions. The supplied archive contains modern
commercial books and was not used as a question bank. See
[QUESTION-SOURCES.md](QUESTION-SOURCES.md) for exact scope, references, and limitations.

Browser QA and delivery checks are recorded in [VERIFICATION.md](VERIFICATION.md).
