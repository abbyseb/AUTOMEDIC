# Decoy workflows (ticket #5)

Always-green companions so Mission Control’s health rail truthfully shows **watching 3**. Only Customer Order Sync ever breaks.

| Workflow | ID | URL | Tag |
|---|---|---|---|
| Invoice Reconciliation | `VDyTIpSNqqlpI7jQ` | https://kaviya-aj.app.n8n.cloud/workflow/VDyTIpSNqqlpI7jQ | `automedic:watch` |
| Support Ticket Triage | `9KgXbcmKUtM97ncO` | https://kaviya-aj.app.n8n.cloud/workflow/9KgXbcmKUtM97ncO | `automedic:watch` |

## Shape

Each decoy is intentionally trivial and offline-safe:

1. **Run Manually** — demo / setup trigger  
2. **Mock * Batch** — Set node that emits a fixed success payload  

No webhooks, no credentials, no external calls.

## Setup run

| Workflow | Execution | Status |
|---|---|---|
| Invoice Reconciliation | `4` | success |
| Support Ticket Triage | `5` | success |

Workflows stay **inactive** (manual trigger only) — same pattern as the victim until demo publish decisions land.
