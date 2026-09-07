# Makeover verification — 2026-09-07

## Automated checks

- `node --test`: 16 passing tests, including 200 seeded game-engine rounds.
- Six registered decks, 30 questions each, 180 distinct prompts; four distinct choices and one correct answer for every question.
- New progress tests cover immediate answer recording, persistence round-trips, invalid stored data, local-day rollover, independent topics, stable identity after choice shuffling, no repeated XP, and discovery-first question selection.
- Full-trip and retry integration verifies that practice can collect missed answers without increasing the full-trip best score or completed-trip count.
- `node --check` passes for the UI controller and progress module.

## Browser checks

Tested in the Codex browser against the local preview server, using desktop and 390px / 320px phone-sized viewports. This is viewport testing, not testing on physical phones or a complete browser matrix.

- Home screen, topic cards, trip settings, original illustration, and responsive layouts inspected visually.
- Completed a five-question round with correct and incorrect answers. Verified score, feedback, station states, results, and earned XP.
- Completed the four-question retry perfectly; its 100% result left the original 20% full-trip best intact.
- Reloaded and verified saved XP, collections, and completed trips.
- Started a 15-question phone round, answered once, and reloaded: that answer's progress persisted without counting the unfinished trip as completed.
- Surprise-topic button starts a five-question round.
- Number keys and Enter advance correctly; dialog Shift+Tab wraps to the last action.
- Invalid file import shows a readable error. A subsequent valid import clears it.
- Imported a two-question test deck and selected 15 questions: UI and game both correctly cap the trip at two.
- Imported title and note markup displays as literal text, not HTML.
- Browser console reported no warnings or errors in the checked session.

## Delivery

- No dependencies, build step, remote images, or external font requests.
- `node serve.js` runs a loopback-only preview; it does not deploy the game publicly.
- `node generate-zip.js` packages the static app, all decks, the SVG illustration, and question provenance notes. Tests and development tooling are excluded.
- New-question licensing scope and targeted factual checks are documented in `QUESTION-SOURCES.md`. The archive's books were not copied into the app or its package.

Progress is browser-local, not account-synced. Reloading starts a new trip but keeps earned progress. Imported decks must be reopened after reload. No service worker or offline-install support is claimed.
