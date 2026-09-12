# AutoMedic demo runbook (hackathon)

## Pitch (15s)

Error Trigger alerts and retries. AutoMedic finds the bad field, patches once, verifies. AUTH failures escalate — we don’t invent credentials. Silent drift we flag; shape we hard-fail; semantics we propose — never invent a remap without evidence.

## Before you start

1. `docker compose up -d` — n8n on http://127.0.0.1:5678  
2. `cd mission-control && npm run dev` — http://127.0.0.1:5173  
3. `.env.local`:
   ```bash
   VITE_USE_MOCK=false
   VITE_AUTOMEDIC_BASE_URL=http://127.0.0.1:5678/webhook
   VITE_AUTOMEDIC_SECRET=automedic-demo-secret
   ```
4. n8n login (if needed): `automedic@local.dev` / `AutomedicDemo1!`  
5. Header for every AutoMedic webhook: `X-AutoMedic-Secret: automedic-demo-secret`

Victim (no secret): `POST http://127.0.0.1:5678/webhook/revenue-ops` with `{}`.

---

## Full demo (Levels 0 → 3)

### Beat 0 — Reset

| | |
|--|--|
| **Do** | Mission Control **Reset**, or `POST /automedic/reset` |
| **Expect** | `WATCHING`. Revenue Ops healthy. Incidents cleared (no fake AUTH seed). |

---

### Beat 1 — Level 0 heal (flagship, ~90s for video)

| Step | Do | Expect |
|------|----|--------|
| 1a | Open **Revenue Ops Pipeline** → **Map to CRM Fields** | `customerEmail` = `{{ $json.email_address }}` |
| 1b | Mission Control **Break** | Map becomes `$json.email`; run fails |
| 1c | Mission Control **Scan** (wait for OpenAI) | `healed:true`, reason mentions missing `email` / closest `email_address`, verify **success** |
| 1d | Show Flight Recorder / n8n Map | Diff `email` → `email_address` only — surgical, not Ctrl+Z |

**Say:** *“Error Trigger tells you it broke. We find which field, patch once, verify.”*

---

### Beat 1b — AUTH refuse (Auth Break button)

| Step | Do | Expect |
|------|----|--------|
| A1 | Mission Control **Simulate auth expiry** (or `POST /automedic/break-auth`) | Inserts node **AutoMedic AUTH Probe** (`throw 401…`), run fails |
| A2 | Mission Control **Scan** | `AUTH_EXPIRED`, gate refused, **no workflow mutation** |
| A3 | Mission Control **Reset** | Probe **removed**, Webhook → Mock again, healthy Map |

**Say:** *“That’s your problem, human. High confidence. Zero mutation. Respect.”*

---

### Beat 2 — Level 1 silent drift

| Step | Do | Expect |
|------|----|--------|
| 2a | In n8n, open **Is B2B?**; change expression to `{{ $json.is_c2c }}` | Dangling / wrong key |
| 2b | `POST /webhook/revenue-ops` `{}` | Still **HTTP 200** (silent wrong branch — green ≠ correct) |
| 2c | `POST /automedic/audit` + secret | `drift:true`, dangling refs include `is_c2c`, `autoRepairSafe:false`, **no** auto-patch |

**Say:** *“Successful runs can still be wrong. Audit flags silent dangling refs — we escalate, we don’t guess the IF.”*

---

### Beat 3 — Level 2 shape hard-fail

| Step | Do | Expect |
|------|----|--------|
| 3a | **Reset** (clears L1 plant; restores healthy Map) | Green again |
| 3b | In **Map to CRM Fields**, set `customerEmail` → `={{ $json.account_name }}` | Semantic/shape trap |
| 3c | `POST /webhook/revenue-ops` `{}` | **Fail** at **Validate Mapped Fields**: `SHAPE_VIOLATION: customerEmail must look like an email…` |

**Say:** *“Wrong-shaped CRM fields fail hard before they poison the opportunity.”*

---

### Beat 4 — Level 3 semantic propose (no auto-PUT)

| Step | Do | Expect |
|------|----|--------|
| 4a | Leave the bad `account_name` map from Beat 3 | Same victim state |
| 4b | `POST /automedic/semantic` + secret | `escalated:true`, `healed:false`, suggestions e.g. `customerEmail→email_address`, LLM `reason`; **no** workflow PUT |
| 4c | **Reset** when done | Healthy Map; incidents cleared |

**Say:** *“When the key exists but means the wrong thing, we propose and escalate — we don’t auto-patch semantics in v1.”*

---

## Curl cheat sheet

```bash
SECRET=automedic-demo-secret
BASE=http://127.0.0.1:5678/webhook
H=(-H "X-AutoMedic-Secret: $SECRET")

curl -sS -X POST "$BASE/automedic/reset" "${H[@]}"
curl -sS -X POST "$BASE/automedic/break" "${H[@]}"
curl -sS -X POST "$BASE/automedic/scan" "${H[@]}"
curl -sS -X POST "$BASE/revenue-ops" -H 'Content-Type: application/json' -d '{}'
curl -sS -X POST "$BASE/automedic/audit" "${H[@]}"
curl -sS -X POST "$BASE/automedic/semantic" "${H[@]}"
curl -sS "$BASE/automedic/state" "${H[@]}"
```

---

## If OpenAI is down

Live Scan / Semantic may fail diagnose — use recorded Level 0 clip as primary; say “model degrade path exists.” Level 1 audit and Level 2 shape fail still work offline.

## Do not commit

`.local/`, `.env.local`, API keys, OpenAI secrets.
