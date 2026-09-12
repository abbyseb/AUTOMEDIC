# AutoMedic levels (field liveness → semantics)

| Level | Detects | Auto-patch? |
|-------|---------|-------------|
| **0** (shipped) | Missing `$json.X` with close observed key + failed run | Yes, evidence-gated |
| **1** | Dangling refs on **successful** runs (silent IF / wrong branch) | Propose only / escalate |
| **2** | Shape/type of mapped fields (email regex, numbers) | Fail hard → Level 0 Scan can engage |
| **3** | Semantic misuse (e.g. `account_name` used as email) | Propose + escalate; **HITL Approve & patch** applies remaps |

## Webhooks

- `POST /automedic/audit` — Level 1 silent dangling on watched workflows  
- `POST /automedic/semantic` — Level 3 role/shape critic (LLM reason + deterministic role gate)  
- `POST /automedic/hitl-patch` — Human approves semantic proposals → Map remap + verify  
- Existing `POST /automedic/scan` — Level 0 heal  

Header: `X-AutoMedic-Secret: automedic-demo-secret`

## Field roles

See [`contracts/field-roles.json`](../contracts/field-roles.json).
