# AutoMedic live webhooks (free Cloud — no n8n REST API)

Shared secret header: `X-AutoMedic-Secret: automedic-demo-secret`  
Base: `https://kaviya-aj.app.n8n.cloud/webhook`

| Method | Path | Workflow | ID | Notes |
|--------|------|----------|-----|-------|
| `POST` | `/automedic/break` | AutoMedic Break | `X1uUtMr7XdCWQYnz` | Sets flag, runs victim, writes `inc_active_break` |
| `POST` | `/automedic/scan` | AutoMedic Scan (Free Cloud) | `7OsqxzpLH8FxpZat` | Diagnose → clear flag → re-run → verify |
| `GET` | `/automedic/state` | AutoMedic State | `Syy7ae7yEDT1smPy` | Live Mission Control contract |
| `POST` | `/automedic/reset` | AutoMedic Reset | `QJUFKWp4KGvoNQGZ` | Clears tables, clears flag, seeds AUTH |

## How the MVP works without paid API

Paid Cloud **n8n API keys** are not required.

1. Table `automedic_demo_flags` (`1XZXtH7rXpOpXuYw`) holds `victim_break=true|false`
2. **Customer Order Sync** reads that flag and maps:
   - `true` → `$json.email` (missing → FIELD_MAPPING failure)
   - `false` → `$json.email_address` (healthy)
3. **Break** upserts flag `true`, `executeWorkflow` victim, inserts `inc_active_break` (`detected`)
4. **Scan** reads the flag → OpenAI diagnosis (with deterministic FIELD_MAPPING fallback) → clears flag (the “patch”) → re-runs victim → upserts incident to `verified`
5. **Reset** clears incidents/audit/dedup, sets flag `false`, re-seeds `inc_seed_auth`, runs victim healthy

Victim must stay **published** so Break/Scan/Reset can call it as a sub-workflow.

Legacy AutoMedic (`HP8k9xwOVyXGYm9v`) is unpublished; its Scan path needed paid REST API credentials.

## FE env

```bash
VITE_USE_MOCK=false
VITE_AUTOMEDIC_BASE_URL=https://kaviya-aj.app.n8n.cloud/webhook
VITE_AUTOMEDIC_SECRET=automedic-demo-secret
```

## Demo loop

1. Reset → `WATCHING` + seeded AUTH escalation  
2. Break → victim fails + `detected` incident  
3. Scan → diagnose / patch / verify (may take ~10–30s; waits for OpenAI + re-run)  
4. Poll `/state` in Mission Control → `HEALED` + patch diff  
