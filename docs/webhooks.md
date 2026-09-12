# AutoMedic webhooks

**Preferred (real detect + patch):** self-hosted Docker — see [self-host.md](./self-host.md)  
Base: `http://127.0.0.1:5678/webhook`  
Header: `X-AutoMedic-Secret: automedic-demo-secret`

## Local spine (Track 1 demo)

| Method | Path | Level | Notes |
|--------|------|-------|-------|
| `POST` | `/automedic/break` | 0 | `email_address`→`email`, run fails |
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

## Demo loop (Level 0)

1. Reset → `WATCHING` + seeded AUTH  
2. Break → victim fails  
3. Scan → heal + verify  
4. Poll `/state` in Mission Control  

## Level 2–3 loop

1. Map `customerEmail` → `$json.account_name`  
2. Run `/revenue-ops` → **Validate Mapped Fields** shape-fails  
3. `POST /automedic/semantic` → proposals `customerEmail→email_address`, no auto-patch  
4. Reset when done  
