# AutoMedic: when everything is automated, why is recovery still manual?

**AutoMedic** is an n8n-built ops layer for n8n. It watches a broken automation, diagnoses the failure from live execution evidence, and either applies one surgical field remap—or refuses and escalates to a human.

It was built as a hackathon demo (SIGN-OS). The product claim is not “AI fixes anything.” The claim is **trusted autonomy**: auto-write only when the remap is provable from data; otherwise stop.

---

## The problem

Teams automate the happy path—leads into CRM, commissions into ledgers, notifications out the door—then recover by hand when something drifts.

n8n already tells you a run **failed**. Error Trigger can page Slack. Retries can burn the same broken expression again. What n8n does *not* do out of the box:

- Name the **bad `$json` field**
- Rewrite **one** expression in the workflow JSON
- Show a **before/after** diff
- Re-run and mark the incident **verified healed**
- Refuse unsafe fixes (expired auth, ambiguous semantics)

Ops people don’t babysit one canvas. They theoretically own dozens. Renamed vendor fields, silent IF drift, and shape mismatches quietly poison CRM or take the wrong branch while the UI stays green.

---

## What AutoMedic is (and isn’t)

**AutoMedic** is a set of workflows that watch and heal **other** workflows.

| Piece | Role |
|--------|------|
| **Scan** | Failed runs → LLM diagnosis → evidence gate → patch or escalate |
| **Audit** | Canvas dangling `$json` refs on *successful* runs (silent drift) |
| **Semantic** | Role/shape critic; propose remaps; no auto-PUT |
| **HITL patch** | Human Approve / Ignore → surgical apply + verify |
| **Break / Auth Break / Scenario / Reset** | Demo controls to plant and clear predictable failures |
| **Mission Control** | React console: poll `/state`, drive webhooks, show timeline + diff |

**Revenue Ops Pipeline** is *not* AutoMedic. It is the **sample patient**: a realistic lead → map → CRM → commission → notify flow we break on purpose so the medic loop is visible end to end.

---

## How the loop works

```text
Break (or real canvas edit)
        ↓
Victim run fails (or stays green with wrong branch)
        ↓
POST /automedic/scan  (or /audit, /semantic)
        ↓
Read failed execution + payload keys via n8n API
        ↓
OpenAI proposes a diagnosis (plain English + fields)
        ↓
Evidence Gate decides
        ↓
    ┌─── gate passes ───► PUT one remap → re-run → verify
    └─── gate refuses ──► escalate (AUTH / silent / semantic) → HITL if needed
```

Mission Control is the cockpit. AutoMedic is the system that **reads, judges, and optionally edits** n8n through its own API.

---

## The evidence gate (the product)

OpenAI proposes. The gate decides.

1. **Auth** (`401` / credentials) → refuse, **zero mutation**
2. **Shape violation** on empty field + clear remap evidence → treat as field mapping, may auto-heal  
   Non-empty poison value (e.g. company name in `customerEmail`) → semantic escalate + HITL
3. **Silent IF drift** (dangling ref, run still 200) → escalate; do not auto-guess the branch
4. **Field remap** only if replacement key exists in observed payload, expected ≠ replacement, similarity is strong, confidence ≥ threshold

**Auto-write only when the remap is provable from live keys.** Everything else escalates.

That judgment—surgical patch plus explicit refuse—is the novel part. The plumbing (webhooks, API PUT, a UI) is ordinary.

---

## Demo spine (Levels 0–3)

| Level | Failure | AutoMedic response |
|-------|---------|-------------------|
| **L0** | Vendor-style rename (`email_address` → `email`) | Diagnose → gate → one remap → verify |
| **AUTH** | Planted 401 probe | Escalate; no secret fan fiction |
| **L1** | Silent IF (`is_b2b` → `is_c2c`), run still green | Audit / probe → HITL Patch or Ignore |
| **L2** | Map email from `account_name` | Patient **Validate Mapped Fields** hard-fails before CRM; Scan escalates shape/semantic |
| **L3** | Semantic misuse | Propose remaps; human Approve & patch |

Scenario buttons and Break are **scripted plants** so the live pitch doesn’t flop. The Scan/Audit/HITL path is more general: a canvas edit that leaves evidence-backed dangling refs can still heal or escalate without using the L0 button.

---

## Architecture at a glance

- **Runtime:** self-hosted n8n (Docker) with REST API enabled—required for list executions + `PUT /workflows/:id`
- **Patient:** Revenue Ops webhook (`/revenue-ops`)
- **Medic:** webhook spine under `/automedic/*` with shared secret header
- **State:** Data Tables + `/automedic/state` contract for Mission Control
- **UI:** Vite + React Mission Control (live mode points at local webhooks)

Local Track 1 focus: one deep patient, not multi-tenant packaging.

---

## What’s hardcoded vs what’s real

**Hardcoded (demo scaffolding):** watched workflow IDs; Break always plants the email remap; scenario L1–L3 plants; Auth Break inserts a named probe; Reset restores a known-good Map / IF; shape validators tuned to this CRM map; demo secret; Future Version fleet dashboard metrics (illustrative only).

**Real:** live execution + payload evidence; evidence gate rules; surgical expression replace via API; verify re-run; AUTH refuse; silent-drift HITL; OpenAI natural-language reasons (gated afterward).

Pitch line for judges:

> Scenario buttons are scripted so the demo never flops. The medic loop—evidence → gate → one remap or escalate—is the product claim.

---

## Why build it inside n8n?

Dogfooding. AutoMedic is **n8n that heals n8n**: same canvas language, same execution model, same API the platform already exposes. No separate agent runtime for the core loop—just workflows, Data Tables, and a thin Mission Control UI.

---

## Honest scope

Hackathon-ready, not a production multi-tenant product. Single primary watched victim. Local Docker first. No claim of full Ctrl+Z or arbitrary code rewrite. Depth over breadth: the failure classes where correctness is *checkable*.

---

## One-liner

Error Trigger tells you it broke.  
**AutoMedic tells you which field broke, why, and fixes only that—or refuses when it shouldn’t touch the patient.**

---

## Further reading

- [Demo runbook](./demo-runbook.md) — beat-by-beat Do / Expect  
- [Self-host](./self-host.md) — Docker + Mission Control  
- [Webhooks](./webhooks.md) — endpoint cheat sheet  
- [Pitch script](../script.md) — ~60s live talk track  
