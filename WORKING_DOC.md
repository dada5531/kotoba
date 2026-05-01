# Kotoba Provisioning — Working Doc

> Track every key, URL, and credential here. Audit and rotate later.
> Two users share the same infrastructure but have separate Anki collections, Tailscale funnels, and mining histories.

---

## Shared Infrastructure

These services are shared across both users. One instance of each.

| Service | Detail | Value |
|---|---|---|
| **Neon Postgres** | Project name | kotoba |
| | Connection string | *(pending)* |
| **Clerk** | Application name | Kotoba |
| | Publishable key | *(pending)* |
| | Secret key | *(pending)* |
| **Render — VOICEVOX** | Service URL | *(pending)* |
| | Test command | `curl <url>/version` |
| **Render — Sudachi** | Service URL | *(pending)* |
| | Test command | `curl -X POST <url>/tokenize -H "Content-Type: application/json" -d '{"text":"日本語"}'` |
| **Anthropic** | API key | *(user will paste)* |
| **Resend** | API key | *(pending)* |
| | From address | *(pending)* |
| **Vercel** | Project name | *(pending)* |
| | Deployed URL | *(pending)* |
| | `CRON_SECRET` | *(pending — generate with `openssl rand -hex 32`)* |

---

## Per-User Credentials

Each user has their own laptop running Anki + AnkiConnect + Caddy + Tailscale Funnel. These values are stored in the `users` table row (via the Settings page), not in env vars.

### Jenn (primary)

| Setting | Value |
|---|---|
| Clerk email | *(pending)* |
| Tailscale funnel URL | *(pending)* |
| Anki proxy key (`X-Anki-Key`) | *(pending — generate with `openssl rand -hex 32`)* |
| Anki main deck name | Default |
| Anki note type | Kotoba Mined |
| VOICEVOX speaker ID | 3 |

### Darren (secondary — onboard later)

| Setting | Value |
|---|---|
| Clerk email | *(pending)* |
| Tailscale funnel URL | *(pending)* |
| Anki proxy key (`X-Anki-Key`) | *(pending — generate with `openssl rand -hex 32`)* |
| Anki main deck name | Default |
| Anki note type | Kotoba Mined |
| VOICEVOX speaker ID | 3 |

---

## Laptop Setup Checklist

Each user must complete these steps on their own machine. Repeat for Darren when onboarding.

1. Install Tailscale, sign in
2. Install AnkiConnect add-on (code 2055492159), restart Anki
3. Configure AnkiConnect: keep `webBindAddress` at `127.0.0.1`
4. Install Caddy
5. Generate a unique `ANKI_PROXY_KEY` with `openssl rand -hex 32`
6. Set env var: `export ANKI_PROXY_KEY="<value>"`
7. Start Caddy: `caddy run --config laptop/Caddyfile`
8. Test locally: `curl -H "X-Anki-Key: <key>" http://localhost:8766`
9. Start funnel: `tailscale funnel 8766`
10. Record the funnel URL above
11. In the Kotoba app Settings page, paste the funnel URL and proxy key, hit Test Connection

---

## Generated Secrets Log

| Secret | Owner | Value |
|---|---|---|
| `CRON_SECRET` | Shared (Vercel env) | *(pending)* |
| `ANKI_PROXY_KEY` | Jenn | *(pending)* |
| `ANKI_PROXY_KEY` | Darren | *(pending)* |
