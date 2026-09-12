# AutoMedic webhooks

**Preferred (real detect + patch):** self-hosted Docker — see [self-host.md](./self-host.md)  
Base: `http://127.0.0.1:5678/webhook`  
Header: `X-AutoMedic-Secret: automedic-demo-secret`

## Local spine (Track 1 demo)

| Method | Path | Level | Notes |
|--------|------|-------|-------|
| `POST` | `/automedic/break` | 0 | `email_address`→`email`, run fails |
| `POST` | `/automedic/break-auth` | 0 refuse | Plants **AutoMedic AUTH Probe** (401); Reset removes it |
| `POST` | `/automedic/scan` | 0 | LLM + evidence heal + verify |
| `GET` | `/automedic/state` | — | Mission Control contract |
| `POST` | `/automedic/reset` | — | Restore victim, seed AUTH |
| `POST` | `/automedic/audit` | 1 | Silent dangling refs (no auto-patch) |
| `POST` | `/automedic/semantic` | 3 | Role/shape critic; propose, escalate |

See [semantic-levels.md](./semantic-levels.md).

## FE env

```bash
VITE_USE_MOCK=false
VITE_AUTOMEDIC_BASE_URL=http://127.0.0.1:5678/webhook
VITE_AUTOMEDIC_SECRET=automedic-demo-secret
```

## Full demo (Levels 0–3)

Step-by-step Do / Expect: **[demo-runbook.md](./demo-runbook.md)**

| Beat | Level | Flow |
|------|-------|------|
| 0 | — | Reset → healthy (clears incidents; no AUTH seed) |
| 1 | 0 | Break → Scan → heal + verify |
| 1b | 0 refuse | **Auth Break** → Scan → AUTH_EXPIRED, no mutation; **Reset** removes probe |
| 2 | 1 | `Is B2B?` → `$json.is_c2c` → `/revenue-ops` (200) → `/automedic/audit` (drift, no patch) |
| 3 | 2 | Reset → Map `customerEmail` → `$json.account_name` → `/revenue-ops` → `SHAPE_VIOLATION` |
| 4 | 3 | `/automedic/semantic` → proposals + escalate, no auto-PUT → Reset |

