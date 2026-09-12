# AutoMedic demo runbook (hackathon)

## Pitch (15s)

Error Trigger alerts and retries. AutoMedic finds the bad field, patches once, verifies. AUTH failures escalate — we don’t invent credentials.

## Before recording

1. `docker compose up -d` — n8n on :5678
2. Mission Control :5173 with `.env.local` pointing at local webhooks
3. Reset once (clears incidents, healthy Revenue Ops, seeds AUTH escalate)
4. Confirm State shows Revenue Ops healthy + escalated seed

## Recorded loop (~90s)

| Beat | Action | Show |
|------|--------|------|
| 1 | n8n canvas: Map CRM `email_address` | Healthy map |
| 2 | Break / rename to `email` | Failure |
| 3 | Mission Control **Scan** | LLM reason + evidence patch + verified |
| 4 | Diff `email` → `email_address` | Surgical, not Ctrl+Z |
| 5 | Point at AUTH escalate | Refusal / human handoff |

## If OpenAI is down

Live Scan may fail diagnose — use recorded clip as primary; say “model degrade path exists.”

## Do not commit

`.local/`, `.env.local`, API keys, OpenAI secrets.
