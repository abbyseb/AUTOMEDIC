# Day-Of Demo Runbook

Checklist adapted from Plan.md §11. Keep this open on a second device — not on the demo screen.

## T-60 minutes — Pre-flight

- [ ] Laptop plugged in; sleep, screensaver, and all notifications off (**Do Not Disturb / Focus**).
- [ ] Wifi confirmed; hotspot on standby and already paired.
- [ ] Browser: **exactly 2 tabs** — Mission Control (foreground), **fallback video** (background). Zoom **125%**. Close everything else.
- [ ] n8n: AutoMedic workflow **active**; schedule trigger **disabled**; victim + 2 decoys tagged `automedic:watch`; AutoMedic itself untagged and deny-listed.
- [ ] OpenAI key valid with quota; warm one diagnosis call.
- [ ] Env: live mode if demoing against webhooks (`VITE_USE_MOCK=false`, base URL + secret set).
- [ ] Run full loop once end to end. Then **Reset**. Confirm clean state.
- [ ] Confirm pre-seeded `AUTH_EXPIRED` escalated incident is visible after reset.

## T-5 minutes — Reset first

- [ ] Click **Reset Demo**. Wait for `WATCHING · 3 workflows`, all green, one escalated incident in the strip.
- [ ] Do not touch anything else.

## The run — Break → Scan → Verified

1. **(0:00)** Set the scene: healthy workflow, AutoMedic watching. Do not explain architecture yet.
2. **(0:20)** Click **Break the API**. Narrate the vendor rename (`email` → `email_address`). Let the card flip red.
3. **(0:35)** Click **Scan Now**. Watch `DETECTED` land.
4. **(0:40–1:15)** Read diagnosis off screen (node params + real payload keys).
5. **(1:15–1:30)** Point at the gate. Point at the escalated `AUTH_EXPIRED` incident. Credibility beat — do not rush.
6. **(1:30–1:55)** Walk the patch diff. One red line, one green line. Mention the snapshot / version bump.
7. **(1:55–2:15)** `RE-RUNNING` → `VERIFIED`. Card flips green. Read the stats bar.
8. **(2:15–2:30)** Close on audit / rollback. Stop talking.

## Fallback video

- Keep the recorded 3-minute success capture downloaded locally and open in the background tab.
- **Frontend down / second live failure:** full-screen the video and narrate over it. Never debug in front of judges.
- Hotspot is the first recovery for wifi; video is the last resort.

## If something goes wrong

- **Scan finds nothing:** click **Scan Now** once more while narrating the 1-minute production cadence. Never a third time.
- **Diagnosis returns `UNKNOWN`:** pivot to escalation path, then Reset and re-run happy path if time allows.
- **Patch or verify fails:** click **Rollback**, say the snapshot did its job, switch to fallback video.
- **Anything else:** reset once. If the second attempt fails → video. Two failed live attempts max.

## After each judging table

- [ ] Click **Reset Demo**, confirm clean state, before the next group arrives.
