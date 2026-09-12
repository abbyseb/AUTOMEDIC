# Self-hosted AutoMedic (Docker + API)

## Run

```bash
cd /Users/abhisheksebastian/SIGN-OS
docker compose up -d
cd mission-control && npm run dev
```

| Surface | URL |
|---------|-----|
| n8n | http://127.0.0.1:5678 |
| Mission Control | http://127.0.0.1:5173 |

Login: `automedic@local.dev` / `AutomedicDemo1!` (local demo only)

## Product one-liner

> Error Trigger tells you it broke. AutoMedic tells you which field broke, why, and fixes only that field — without you opening the canvas.

## Demo loop

Full Levels 0→3 (heal, silent audit, shape fail, semantic propose): see **[demo-runbook.md](./demo-runbook.md)**.

Quick Level 0 only:

1. Open **Revenue Ops Pipeline** in n8n (healthy)
2. Mission Control **Break** (or rename Map `email_address` → `email`)
3. **Scan** — LLM + evidence + surgical PUT + verify
4. Plant a canvas `401 Unauthorized` → **Scan** → AUTH escalate (no seed)

## Webhooks

Base `http://127.0.0.1:5678/webhook`  
Header `X-AutoMedic-Secret: automedic-demo-secret`

- `POST /automedic/break` · `/scan` · `/reset` · `/audit` · `/semantic`
- `GET /automedic/state`
- `POST /revenue-ops` (victim; no secret)

## FE env (`mission-control/.env.local`)

```bash
VITE_USE_MOCK=false
VITE_AUTOMEDIC_BASE_URL=http://127.0.0.1:5678/webhook
VITE_AUTOMEDIC_SECRET=automedic-demo-secret
```

Secrets/API keys live under `.local/` (gitignored). Rotate any key that was pasted in chat.
