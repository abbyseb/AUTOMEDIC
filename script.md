# AutoMedic pitch script (~90–120s)

## Setup

Open Mission Control and/or the n8n canvas on healthy **Revenue Ops Pipeline**.

---

## Script

Alright. Meet our patient.

This is **Revenue Ops Pipeline** — the quiet overachiever. Mock lead comes in, maps to CRM, posts the deal, calculates commission, sends a nice little “we made money” notification. It works. Almost every day. Beautiful. Green checkmarks. You could put it on a vision board.

**Until…**

*[Break — or flip `email_address` → `email`]*

…until a vendor “helpfully” renames a field.  
`email_address` becomes `email`. One character family feud.

Suddenly your CRM opportunity thinks the customer’s email is *nothing*. The run fails. Or worse — it *succeeds* down the wrong branch and nobody notices until finance asks why Ada Robotics is getting B2C pricing.

And here’s the bit that keeps ops people up at night:

You’re not babysitting **one** workflow.  
You’re theoretically responsible for **hundreds**.  
You do not have time to open every canvas, click every node, and whisper *“are you okay?”* to `$json`.

Error Trigger will text you that it hurt itself.  
It will **not** tell you *which field* betrayed you.

*[Gesture to Mission Control]*

So… we brought a friend.

Say hi to **AutoMedic** — an **n8n-built innovation for n8n workflows**.  
Not a vibe-based copilot. Not “Ctrl+Z the whole patient.”

AutoMedic is the colleague who:

1. Reads the crime scene (failed run + live payload keys)
2. Asks the model for a **plain-English** diagnosis — you’ll see it labeled **OpenAI reason**
3. Runs an **evidence gate** — “is this remap actually backed by data?”
4. If yes: **one surgical patch**, re-run, verify
5. If it’s auth, nonsense, or “the key exists but means the wrong thing”: **escalate**. No secret-rotating fan fiction.

*[Scan]*

Watch: Break → Scan → `email` becomes `email_address` again. Patient sits up. Commission is a number again, not the word `"B2B"`. We’re professionals.

*[Simulate auth expiry → Scan]*

And if credentials expire? AutoMedic says: *“That’s your problem, human.”*  
High confidence. Zero mutation. Respect.  
*(Reset removes the AUTH probe and puts the patient back.)*


*[Optional 10s closer if judges lean in]*

Silent IF drift? We **audit**, we don’t guess.  
Wrong shape in the CRM map? We **hard-fail** before you poison Salesforce.  
Semantic misuse? We **propose** — we don’t auto-hallucinate meaning.

### One-liner to land it

> Error Trigger tells you it broke.  
> **AutoMedic tells you which field broke, why, and fixes only that — for the workflows you don’t have time to babysit.**

---

## Presenter tips

- Call Revenue Ops **“the patient”** once early — then AutoMedic is the doctor. Easy laugh track.
- Say **“surgical, not Ctrl+Z”** while the diff is on screen.
- Don’t rush the refuse beat — judges trust systems that know when to stop.

## Demo beats (cue sheet)

See [docs/demo-runbook.md](./docs/demo-runbook.md) for full Levels 0→3 Do / Expect steps.
