# Kotoba Multi-User Audit Report

**Date:** 2026-05-01
**Branch:** `claude/kotoba-japanese-study-app-As7xw`
**Scope:** All files in `src/app/api/**`, `src/lib/**`, `src/app/(dashboard)/**`, `src/db/schema.ts`, `vercel.json`

---

## 1. Schema Audit

| Table | Has `user_id`? | Expected Scope | Verdict |
|---|---|---|---|
| `users` | PK is Clerk user ID | Per-user row | **OK** — stores `anki_funnel_url`, `anki_auth_key`, `anki_main_deck_name`, `email`, etc. per user |
| `content_sources` | No | Shared (same NHK article URL) | **OK** — shared catalog of source URLs, deduplicated by `source_url` unique index |
| `content_items` | Yes | Per-user (each user's ingested view of an article) | **OK** — has `user_id` column + index |
| `mined_cards` | Yes | Per-user | **OK** — has `user_id` column + composite `(user_id, status)` index |
| `vocabulary` | No | Shared dictionary | **OK** — global JMdict-seeded table, no user scoping needed |
| `conversation_sessions` | Yes | Per-user | **OK** |
| `weekly_focus` | Yes | Per-user | **OK** |
| `cron_runs` | No | System-level | **OK** — no `user_id`, as expected |

**Schema verdict:** All tables are scoped correctly. No structural changes needed.

---

## 2. Query Audit — Route-by-Route

Every API route and server component was checked for whether it filters by `auth().userId` when touching user-scoped tables.

| File | Table(s) Touched | Filters by `userId`? | Verdict |
|---|---|---|---|
| `/api/mine/route.ts` | `mined_cards` (insert), `vocabulary` (upsert) | **Yes** — inserts with `userId` from `auth()`, flushes with `flushUser(userId)` | **OK** |
| `/api/mine/recent/route.ts` | `mined_cards` (select) | **Yes** — `eq(minedCards.userId, userId)` | **OK** |
| `/api/ingest/route.ts` | `content_items` (insert), `content_sources` (upsert) | **Yes** — inserts `content_items` with `userId` from `auth()` | **OK** |
| `/api/study-aids/route.ts` | `content_items` (select + update) | **Yes** — `and(eq(contentItems.id, ...), eq(contentItems.userId, userId))` | **OK** |
| `/api/settings/route.ts` | `users` (update) | **Yes** — `updateUser(userId, ...)` scoped by PK | **OK** |
| `/api/anki/test/route.ts` | `users` (select) | **Yes** — `getUser(userId)` loads calling user's Anki config | **OK** |
| `/api/anki/flush/route.ts` | `mined_cards`, `users` | **Yes** — `flushUser(userId)` scopes everything | **OK** |
| `/api/dict/route.ts` | `vocabulary` (select) | N/A — shared table | **OK** |
| `/api/tokenize/route.ts` | None | N/A — stateless | **OK** |
| `/api/health/route.ts` | None | N/A | **OK** |
| `/api/cron/anki-flush/route.ts` | All users via `flushAll()` | **Yes** — `flushAll()` iterates all users, `flushUser()` scopes per-user | **OK** |
| `/api/cron/weekly-review/route.ts` | `users`, `mined_cards`, `weekly_focus` | **Yes** — iterates all users, `computeStats(u.id)` scopes by `userId`, emails `u.email` | **OK** |
| `/api/cron/daily-curate/route.ts` | `users`, `content_sources`, `content_items` | **Partial** — see P0-1 below | **ISSUE** |
| `/app/audio/[filename]/route.ts` | None (filesystem) | **No** — see P1-1 below | **ISSUE** |
| `/app/(dashboard)/mine/page.tsx` | `mined_cards` (select) | **Yes** — `eq(minedCards.userId, userId)` | **OK** |

---

## 3. Settings Audit

**Anki credentials (`anki_funnel_url`, `anki_auth_key`) are stored in the `users` table, NOT in env vars.** The settings form reads from the DB row via `getUser(userId)` and writes via `updateUser(userId, patch)`. The `/api/anki/test` route loads the calling user's row and passes `{ funnelUrl: user.ankiFunnelUrl, authKey: user.ankiAuthKey }` to the Anki client.

**Verdict: OK.** No P0 here. Each user stores their own Tailscale funnel URL and proxy key in their own row.

---

## 4. Cron Audit

| Cron | Multi-user safe? | Details |
|---|---|---|
| `weekly-review` | **Yes** | Iterates `select * from users`, computes per-user stats, emails each user's `u.email` | 
| `anki-flush` | **Yes** | `flushAll()` iterates all users with configured Anki, calls `flushUser(u.id)` per user |
| `daily-curate` | **No** — see P0-1 | Emails only `process.env.DAILY_DIGEST_TO` (single hardcoded recipient) |

---

## 5. AnkiConnect Call Audit

The `lib/anki.ts` module is correctly parameterized: every function takes an `AnkiConfig { funnelUrl, authKey }` argument. It never reads env vars. All call sites pass the config from the calling user's DB row:

- `flushUser(userId)` → loads `user.ankiFunnelUrl` + `user.ankiAuthKey` from the `users` row
- `/api/anki/test` → loads `user.ankiFunnelUrl` + `user.ankiAuthKey` from the `users` row
- `ensureNoteType`, `ensureDeck`, `addNote`, `findNotesByExpression`, `deckNames` — all take `cfg` param

**Verdict: OK.** AnkiConnect calls are fully per-user.

---

## Issues Found

### P0-1: `daily-curate` email goes to a single env var recipient

**File:** `src/app/api/cron/daily-curate/route.ts`, lines 61-71

**Problem:** The daily digest email is sent to `process.env.DAILY_DIGEST_TO` — a single hardcoded address. In a two-user setup, only one person gets the email. The DB writes (inserting `content_items` per user) are correctly scoped, but the email notification is not.

**Impact:** Darren never receives the daily curated article email. This is a functional gap, not a data leak, but it blocks the intended multi-user daily workflow.

**Fix:** Mirror the `weekly-review` pattern — iterate `targetUsers`, email each user at `u.email`. Remove the `DAILY_DIGEST_TO` env var. The `content_items` insertion loop already iterates users correctly; only the email-sending block needs to move inside the loop and use `u.email`.

---

### P0-2: `daily-curate` overwrites `c.contentId` in the shared `curated` array

**File:** `src/app/api/cron/daily-curate/route.ts`, line 56

**Problem:** The inner loop does `c.contentId = item.id` for each user, but `c` is a shared object in the `curated` array. On the second user iteration, the `contentId` is overwritten to point to the second user's `content_items` row. If the email were fixed to be per-user, the link in the first user's email would point to the second user's content item (which they can't access due to the `userId` filter in `/api/study-aids`). Currently masked by the single-recipient email bug.

**Impact:** Would cause broken `/mine?content=<id>` links in the digest email for all users except the last one processed.

**Fix:** Build the digest email HTML inside the per-user loop, using the `contentId` returned for that specific user, rather than mutating the shared `curated` array.

---

### P1-1: Audio file serving has no ownership check

**File:** `src/app/audio/[filename]/route.ts`

**Problem:** The route requires Clerk authentication (any signed-in user) but does not verify that the requested audio file belongs to a `mined_cards` row owned by the caller. Audio filenames are deterministic hashes of `targetWord|sentence`, so they are not easily guessable — but if Darren somehow obtains a filename (e.g., from a shared screen, browser history, or logs), he could fetch Jenn's audio files.

**Impact:** Low-probability cross-user data leak. The audio content itself is synthesized Japanese speech (not personal data), so the sensitivity is minimal. However, it violates the principle of user isolation.

**Fix:** Before serving, query `mined_cards` for a row where `audioFilename = filename AND userId = userId`. Return 404 if no match. This adds one DB query per audio request but enforces ownership.

---

### P2-1: `VOICEVOX_SPEAKER_ID` env var vs per-user setting

**File:** `src/lib/voicevox.ts` reads `process.env.VOICEVOX_SPEAKER_ID` as a default, but the `/api/mine` route correctly passes `user.voicevoxSpeakerId ?? 3` from the user's DB row. The env var is only used as a module-level default and is overridden at the call site.

**Impact:** None currently — the per-user value wins. But if a future code path calls `synthesize()` without passing the speaker ID, it would fall back to the env var. Cosmetic/defensive.

**Fix:** No action needed now. Note for future reference.

---

## Summary

| ID | Severity | Description | Effort |
|---|---|---|---|
| P0-1 | **P0** | `daily-curate` email sent to single env var, not per-user | ~30 min |
| P0-2 | **P0** | `daily-curate` overwrites shared `contentId` across user loop | ~15 min (fix alongside P0-1) |
| P1-1 | **P1** | Audio serving route lacks ownership check | ~20 min |
| P2-1 | **P2** | VOICEVOX speaker ID env var fallback (cosmetic) | No action |

**Total estimated fix time for P0 + P1: ~1 hour.**

All three fixes are isolated to their respective files and do not require schema changes, new migrations, or library additions.

---

## What's Already Correct

The codebase is in good shape for multi-user. The following are all properly scoped:

- Every API route that touches `mined_cards` or `content_items` filters by `auth().userId`
- Anki credentials are stored per-user in the `users` table, not in env vars
- `flushUser()` and `flushAll()` correctly scope to each user's Anki config
- `weekly-review` cron iterates all users and emails each one individually
- The `vocabulary` and `content_sources` tables are correctly shared (no user scoping needed)
- The settings page reads/writes the calling user's own row
