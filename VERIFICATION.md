# Makeover and tier expansion verification — 2026-09-07

## Automated checks

- `node --test`: 26 passing tests, including 200 seeded game-engine rounds.
- Six registered decks, 60 questions each, 360 distinct prompts; four distinct choices and one correct answer for every question. Every deck has 30 Curious, 15 Explorer, and 15 Expert questions.
- Tier tests cover unlock thresholds, unique collections, per-topic gates, short imported decks, weighted rewards, shuffled and retried question tiers, per-tier bests, version-1 migration, backup validation, and idempotent restore merges.
- Compared all 180 prior question identities against commit `2f3b1e7`: unchanged, preserving earned collections.
- New progress tests cover immediate answer recording, persistence round-trips, invalid stored data, local-day rollover, independent topics, stable identity after choice shuffling, no repeated XP, and discovery-first question selection.
- Full-trip and retry integration verifies that practice can collect missed answers without increasing the full-trip best score or completed-trip count.
- `node --check` passes for the UI controller and progress module.

## Browser checks

### Tier expansion on port 8015

- Fresh save shows Curious available and higher routes locked.
- Imported a version-1 fixture: retained 90 XP, nine collected answers, two trips, and the old best score.
- Completed five Curious answers for +50 XP and unlocked Explorer. Two five-question Explorer rounds earned +100 XP each and unlocked Expert.
- Expert round earned +30 XP for one new correct answer. Retrying the other four earned +120 XP without replacing the original 20% Expert best or adding a completed trip.
- Reload retained 490 XP, 29 collected answers, six completed trips, and the Expert unlock.
- Used the UI to download a backup. The browser automation download-event wait timed out, but the JSON file was saved to the actual Downloads directory. Read and parsed that file: 490 XP, 29 collections, six trips; a self-merge preserved the complete normalized save. Restore was exercised in the browser with the version-1 fixture; merge cases are additionally covered by automated tests.
- Inspected tier controls at 390px and Expert gameplay at 320px. No horizontal overflow at 320px. Browser console reported no warnings or errors.
- Preview default changed to 8015. Stopped only the quiz preview process previously started by this task on 8000; no other API process was stopped or restarted.

### Prior makeover checks

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
- `node serve.js` runs a loopback-only preview on port 8015; it does not deploy the game publicly.
- `node generate-zip.js` packages the static app, all decks, the SVG illustration, and question provenance notes. Tests and development tooling are excluded.
- Rebuilt the expanded package and verified all 15 archive entries against their source files using SHA-256.
- New-question licensing scope and targeted factual checks are documented in `QUESTION-SOURCES.md`. The archive's books were not copied into the app or its package.

Progress is browser-local, not account-synced. Reloading starts a new trip but keeps earned progress. Imported decks must be reopened after reload. No service worker or offline-install support is claimed.

Accounts and leaderboards are design recommendations in `ACCOUNTS.md`, not implemented features. Changing the site's port changes its browser storage origin; old origin data is not erased or silently migrated between origins.
