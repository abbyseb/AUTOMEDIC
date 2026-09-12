# AutoMedic Mission Control

Vite + React + TypeScript frontend for the hackathon demo.

## Quick start

```bash
cd mission-control
npm install
npm run dev
```

Open http://localhost:5173 — polls frozen contract at `/mock/state.json` every 1.5s.

## Env

Copy `.env.example` → `.env.local` when live n8n webhooks exist:

| Var | Purpose |
|-----|---------|
| `VITE_USE_MOCK` | `true` (default) uses bundled mock |
| `VITE_AUTOMEDIC_BASE_URL` | n8n webhook base (no trailing slash) |
| `VITE_AUTOMEDIC_SECRET` | shared secret header |

## Deploy

```bash
npm run build
npx vercel --prod   # or connect the repo in Vercel UI
```

Contract source of truth: [`../contracts`](../contracts).
