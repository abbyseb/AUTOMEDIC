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

1. Open **Revenue Ops Pipeline** in n8n (healthy)
2. Change **Map to CRM Fields** `email_address` → `email` (or Mission Control “Simulate vendor rename”)
3. Run / Break so it fails
4. Press **Scan** — LLM diagnoses, evidence gate checks payload keys, surgical PUT, re-run verifies
5. Point at seeded **AUTH_EXPIRED** escalate (Reset seeds it) — safety refusal

## Webhooks

Base `http://127.0.0.1:5678/webhook`  
Header `X-AutoMedic-Secret: automedic-demo-secret`

- `POST /automedic/break`
- `POST /automedic/scan`
- `GET /automedic/state`
- `POST /automedic/reset`

## FE env (`mission-control/.env.local`)

```bash
VITE_USE_MOCK=false
VITE_AUTOMEDIC_BASE_URL=http://127.0.0.1:5678/webhook
VITE_AUTOMEDIC_SECRET=automedic-demo-secret
```

Secrets/API keys live under `.local/` (gitignored). Rotate any key that was pasted in chat.
