# Optional accounts and leaderboards — proposed next phase

The shipped game remains a static browser game with guest progress and portable backups. Accounts, cloud synchronization, and a public leaderboard are not implemented or connected to a provider in this revision.

## Recommendation

Keep “play now” available without signing up. Offer an optional account to save across devices, then add a weekly challenge leaderboard. This is a reasonable extension for a browser game: the interface still runs in the browser, while a small backend provides shared persistence and identity.

One practical option is managed authentication, a hosted database, and a server function for scoring. Supabase is a candidate, not a committed dependency. Its [data-security documentation](https://supabase.com/docs/guides/database/secure-data) describes browser access with a publishable key and user-scoped row-level security. Administrative credentials must stay on the server.

## Suggested player experience

1. Play immediately as a guest.
2. Choose “Save across devices” when ready; use a managed email-link or social sign-in flow.
3. Merge guest discoveries into private personal progress without losing existing cloud discoveries.
4. Opt into a public display name and the weekly challenge board. Never show email addresses on the board.
5. Keep personal play available when signed out or temporarily offline after the game has loaded; sync when connected. Offline installation would be a separate service-worker feature.

## Score trust

The current local save and downloadable question files are intentionally inspectable. Neither a submitted XP number nor an imported backup is suitable as proof of a ranked score. Sign-in alone does not solve this.

A ranked mode should have the server issue a round, validate submitted choices, enforce one answer per issued question, calculate rewards, and write the score transactionally. Replayed requests must be idempotent. Keep answer keys for new ranked-only questions on the server if hiding answers matters; the existing bundled deck answers are already public.

Imported guest progress can count toward a player's private collection, but should not retroactively grant verified leaderboard points. Use a separate ledger of server-validated ranked points. Weekly challenges give newcomers a chance without competing against the entire lifetime history of established players. Even server scoring cannot entirely prevent outside lookup or automation; design a casual board accordingly.

## Minimal backend responsibilities

- Private account identity and preferences; separate opt-in public profile.
- Versioned question IDs and trusted tier/reward metadata.
- Private per-user discoveries with a unique constraint on user plus question ID.
- Issued rounds, answer submissions, and a transactional score ledger.
- A limited public leaderboard view containing display name, rank, and verified points.
- Per-user access rules, rate limits, account deletion, and tested backup/restore.

Before implementation, choose the hosting/authentication provider, a production domain, sign-in methods, and whether ranked play uses a shared daily challenge. The current file format and local progress rules provide a starting point, but do not claim to implement these server guarantees.
