# AutoMedic pitch (~60s · 5 scenarios)

## Setup

Mission Control open. Patient healthy. **Reset** once before you start.  
Don’t wait for OpenAI mid-pitch — click, narrate, move. Full waits are for the video.

---

## Script (60s)

**[0:00 · hook · ~8s]**

Meet the patient — **Revenue Ops**. Sixteen nodes, green every day.  
Error Trigger will text you it broke. It will **not** tell you which field.  
**AutoMedic** does — surgical patch, evidence gate, not Ctrl+Z.

**[0:08 · ① heal · ~12s]** *[Break → Scan]*

Vendor renames `email_address` → `email`. Run dies.  
Scan: OpenAI reason → evidence gate → one remap → verify. Patient sits up.

**[0:20 · ② AUTH refuse · ~10s]** *[Simulate auth expiry → Scan]*

Credentials expire? *“That’s your problem, human.”*  
High confidence. **Zero mutation.** Respect. *[Reset]*

**[0:30 · ③ silent drift · ~10s]** *[L1 / Audit]*

IF points at `is_c2c`. Run still **200** — green ≠ correct.  
Audit flags the dangling ref. We **escalate**. We don’t guess the branch.

**[0:40 · ④ shape hard-fail · ~8s]** *[L2]*

Map email from `account_name`? **Validate Mapped Fields** hard-fails.  
Poison never reaches Salesforce.

**[0:48 · ⑤ semantic + HITL · ~12s]** *[L3 → Approve & patch]*

Key exists, meaning wrong. We **propose**, not auto-PUT.  
Human signs off → Approve & patch → verified.

**[land it]**

> Error Trigger: it broke.  
> AutoMedic: **which field, why, fix only that — or refuse.**

---

## Cue sheet (click order)

| t | Click | One line |
|---|--------|----------|
| 0:08 | **Break** → **Scan** | Surgical heal |
| 0:20 | **Auth expiry** → **Scan** → **Reset** | Refuse AUTH |
| 0:30 | **L1** / **Run Audit** | Silent green wrong |
| 0:40 | **L2** | Shape hard-fail |
| 0:48 | **L3** → **Approve & patch** | Propose → HITL |

---

## Presenter tips

- One breath per scenario — don’t explain the architecture twice.
- Pause half a beat on **refuse** and **HITL** — that’s the trust story.
- If Scan lags, keep talking the gate; don’t dead-air.

Full Do / Expect: [docs/demo-runbook.md](./docs/demo-runbook.md).
