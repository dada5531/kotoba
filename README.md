# Kotoba 言葉

Personal Japanese mining + study platform. Paste any Japanese text → tokenize →
mine sentences straight into your Anki deck via AnkiConnect over a Tailscale
Funnel. Anki stays the source of truth for memorization; Kotoba is the layer
on top.

See [project-brief.md](#) for the full scope. This README covers running it.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn-style UI primitives
- Postgres on Neon, accessed via Drizzle ORM
- Clerk for auth
- Anthropic SDK (Sonnet 4.6 default, Haiku 4.5 for tagging, Opus 4.7 for weekly review)
- Sudachi tokenizer — Python FastAPI sidecar (`services/sudachi/`)
- VOICEVOX TTS — Render service (`services/voicevox/`)
- Resend for daily/weekly email
- Vercel Cron for orchestration
- AnkiConnect on laptop, fronted by Caddy reverse proxy, exposed via Tailscale Funnel

## Local setup

```bash
# 1. Install deps
pnpm install

# 2. Env vars
cp .env.example .env.local
# fill in Clerk, Neon, Anthropic, etc.

# 3. Migrate DB
pnpm db:generate
pnpm db:migrate

# 4. (Optional) seed JMdict
# Download JMdict_e.gz from https://www.edrdg.org/jmdict/edict_doc.html
pnpm db:seed:jmdict ./JMdict_e.gz

# 5. Run dev server
pnpm dev
```

The Sudachi sidecar and VOICEVOX engine run separately. For local dev:

```bash
# Sudachi (in services/sudachi)
pip install -r requirements.txt
uvicorn main:app --port 8000

# VOICEVOX (Docker)
docker run --rm -p 50021:50021 voicevox/voicevox_engine:cpu-latest
```

Then point `SUDACHI_BASE_URL=http://localhost:8000` and
`VOICEVOX_BASE_URL=http://localhost:50021` in `.env.local`.

## Anki bridge setup (one-time)

The mining loop pushes cards from Vercel into Anki desktop running on your
laptop. Two pieces are needed: AnkiConnect (the plugin) and a tiny auth proxy
in front of it.

1. **Install AnkiConnect** in Anki desktop (Tools → Add-ons → Get Add-ons,
   code `2055492159`).
2. **Configure AnkiConnect** by replacing its config with
   `laptop/anki-connect-config.json`. This binds it to `127.0.0.1` so only
   processes on the same machine can reach it — the public exposure happens
   through Caddy + Tailscale.
3. **Install Tailscale** on your laptop and sign in.
4. **Install Caddy** and run the proxy:
   ```bash
   export ANKI_PROXY_KEY="$(openssl rand -hex 32)"
   caddy run --config laptop/Caddyfile --adapter caddyfile
   ```
5. **Expose port 8766 via Tailscale Funnel**:
   ```bash
   tailscale funnel --bg 8766
   ```
   This prints a public HTTPS URL like `https://your-laptop.tail-xxx.ts.net`.
6. **Save in Kotoba** → Settings page: paste the funnel URL and the
   `ANKI_PROXY_KEY`. Click "Test connection" — you should see a deck list.

The first time you mine a card, the flush worker auto-creates a `Kotoba Mined`
note type via AnkiConnect's `createModel`. You don't have to set up the note
type manually.

### Security note

Tailscale Funnel makes the URL public; the auth header (`X-Anki-Key`,
enforced by Caddy) is the only thing protecting your Anki collection. Use a
32+ char random key, rotate it periodically, and never log it.

## Cron orchestration

`vercel.json` declares three crons:

| Path                        | Schedule (UTC)  | Effect                                    |
| --------------------------- | --------------- | ----------------------------------------- |
| `/api/cron/anki-flush`      | every 30 min    | Flush queued mined cards to Anki          |
| `/api/cron/daily-curate`    | `0 23 * * *`    | 07:00 SGT — fetch NHK Easy article + email |
| `/api/cron/weekly-review`   | `0 12 * * 0`    | Sunday 20:00 SGT — Claude weekly review email |

Each route checks `Authorization: Bearer <CRON_SECRET>`. Vercel sets that
header automatically when `CRON_SECRET` is configured as an env var.

## Project layout

```
src/
  app/
    (dashboard)/        Authed UI (mine, reading, listening, speaking, settings)
    api/                Route handlers (ingest, mine, anki/*, cron/*, dict, ...)
    sign-in/, sign-up/  Clerk auth pages
    audio/[filename]/   Serves locally-stored VOICEVOX MP3s for review
  db/                   Drizzle schema, migrate, JMdict seed
  lib/
    anki.ts             AnkiConnect client + note type spec
    claude.ts           Anthropic SDK wrapper with generateJSON helper
    flush.ts            Pending-card → Anki flush worker
    fetchers.ts         NHK / NHK Easy / Readability fetchers
    sudachi.ts          Tokenizer client w/ fallback
    voicevox.ts         TTS client
    dictionary.ts       JMdict lookup helpers
    prompts/            Claude prompts (study aids, weekly review, conversation)
services/
  sudachi/              Python FastAPI tokenizer (deploys to Render)
  voicevox/             Render spec for VOICEVOX engine
laptop/
  Caddyfile             Auth proxy in front of AnkiConnect
  anki-connect-config.json
vercel.json             Cron schedules
```

## Status

- Phase 0 (foundation) and Phase 1 (reading + mining) are scaffolded end-to-end.
  External dependencies (Sudachi sidecar, VOICEVOX, AnkiConnect, Caddy, Neon,
  Clerk) need to be provisioned before `/mine` works against a real deck.
- Phase 2 (listening) and Phase 3 (speaking) routes exist as placeholders.
- Phase 4 (cron orchestration) is wired but the curate route currently picks
  one NHK Easy article per run; richer source mixing comes later.
