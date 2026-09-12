# n8n AutoMedic — Self-Healing Workflow Engine

**Hackathon build spec, v2 (feasibility-corrected)**

One line: *an n8n workflow that watches other n8n workflows, diagnoses failures with AI, repairs the safe ones, and proves the repair worked.*

---

## What changed from v1, and why

| v1 approach | Problem | v2 approach |
|---|---|---|
| Schedule trigger polling `/executions?status=error` every 60s | Up to 60s of dead air on stage; needs a dedup queue | **Error Trigger** — fires instantly, no polling, no queue |
| Re-run victim via n8n REST API | **No execute endpoint exists** in the public API | Victim gets a **Webhook trigger**; AutoMedic POSTs to it |
| AI diagnoses from error message only | Can't produce an exact replacement string it never saw | **Fetch workflow + execution data first**, then diagnose |
| Dedup on original execution ID | Re-run failure gets a *new* ID and slips through | Guard keyed on `workflowId::nodeName` in static data |

Everything else in the original concept survives intact.

---

## Architecture

```
                    Fragile Demo Workflow (Victim)
                              ↓ fails
                    [Error Workflow setting]
                              ↓
┌─────────────────────────────────────────────────┐
│  AutoMedic                                       │
│                                                  │
│  1. Error Trigger                                │
│  2. Build Context   (Code)                       │
│  3. Fetch Evidence  (HTTP ×2)                    │
│  4. Loop Guard      (Code + IF)                  │
│  5. AI Diagnose     (OpenAI / Anthropic)         │
│  6. Safe to Repair? (IF)                         │
│     ├── NO  → Slack: escalate                    │
│     └── YES → 7. Patch (Code)                    │
│                8. PUT workflow (HTTP)            │
│                9. Re-run via webhook (HTTP)      │
│               10. Verify (Wait + HTTP)           │
│               11. Slack: success                 │
└─────────────────────────────────────────────────┘
```

---

## Setup before you build

**Environment variables / credentials**

```
N8N_BASE_URL       https://your-instance
N8N_API_KEY        (Settings → n8n API → create key)
VICTIM_WEBHOOK_URL  https://your-instance/webhook/fragile-demo
SLACK_WEBHOOK_URL
```

Create an n8n API credential of type **Header Auth**, header name `X-N8N-API-KEY`. Reuse it on every HTTP Request node.

**Victim workflow config**

- Add a **Webhook** trigger, path `fragile-demo`, method POST, alongside the Manual Trigger.
- Settings → **Error Workflow** → `n8n AutoMedic`.
- Keep the Victim **inactive** in the editor. Updating an active workflow via API does not reliably hot-reload, and an inactive workflow's webhook still fires in test mode — click "Listen for test event" before the demo, or activate only the Victim and accept the reload caveat.

---

## Node-by-node

### 1. Error Trigger

No config. Add a **Manual Trigger** beside it wired into the same node 2 so you can rehearse without breaking anything.

The Error Trigger delivers:

```json
{
  "execution": {
    "id": "231",
    "url": "...",
    "error": { "message": "...", "stack": "..." },
    "lastNodeExecuted": "Transform Customer",
    "mode": "trigger"
  },
  "workflow": { "id": "abc123", "name": "Fragile Demo Workflow" }
}
```

### 2. Build Context — Code node

```js
const e = $json.execution ?? {};
const w = $json.workflow ?? {};

return [{
  json: {
    workflowId:   w.id,
    workflowName: w.name,
    executionId:  e.id,
    failedNode:   e.lastNodeExecuted,
    errorMessage: e.error?.message ?? 'unknown',
    startedAt:    new Date().toISOString()
  }
}];
```

### 3a. Fetch Workflow Definition — HTTP Request

```
GET {{$env.N8N_BASE_URL}}/api/v1/workflows/{{$json.workflowId}}
```

### 3b. Fetch Execution Data — HTTP Request

```
GET {{$env.N8N_BASE_URL}}/api/v1/executions/{{$('Build Context').item.json.executionId}}?includeData=true
```

This is what makes the diagnosis real rather than a guess: 3a gives you the *expression that broke*, 3b gives you the *fields that actually existed*.

### 4. Loop Guard — Code node

```js
const ctx = $('Build Context').item.json;
const store = $getWorkflowStaticData('global');
store.repairs = store.repairs || {};

const key = `${ctx.workflowId}::${ctx.failedNode}`;
const prev = store.repairs[key];
const now = Date.now();
const WINDOW = 15 * 60 * 1000;

let blocked = false;
let blockReason = '';

if (prev && (now - prev.ts) < WINDOW && prev.attempts >= 1) {
  blocked = true;
  blockReason = 'Already attempted a repair on this node in the last 15 minutes.';
} else {
  store.repairs[key] = { ts: now, attempts: (prev?.attempts ?? 0) + 1 };
}

return [{ json: { ...ctx, blocked, blockReason } }];
```

Keying on node rather than execution ID is the fix: a re-run failure has a new execution ID but the same node, so it gets caught.

### 5. AI Diagnose

Extract the failed node's parameters and the real input keys, then send both.

Prompt payload:

```
FAILED NODE PARAMETERS:
{{ JSON.stringify($('Fetch Workflow').item.json.nodes.find(n => n.name === $('Build Context').item.json.failedNode).parameters) }}

ACTUAL INPUT KEYS AVAILABLE:
{{ JSON.stringify(Object.keys($('Fetch Execution').item.json.data?.resultData?.runData?.[Object.keys($('Fetch Execution').item.json.data.resultData.runData)[0]]?.[0]?.data?.main?.[0]?.[0]?.json ?? {})) }}

ERROR: {{ $('Build Context').item.json.errorMessage }}
```

System instruction — keep yours, with one addition. Add this line:

> `expectedField` and `replacementField` must be the **exact expression substrings** to find and replace, e.g. `$json.name` → `$json.customer_name`. Do not include surrounding braces.

Set **temperature 0** and pin the model version. A hallucinated field name on stage is your worst outcome.

### 6. Safe to Repair? — IF node

```
$json.blocked === false
AND failureType === "FIELD_MAPPING"
AND autoRepairSafe === true
AND confidence >= 0.8
```

False branch → Slack escalation (node 11b).

### 7. Patch — Code node

```js
const wf   = $('Fetch Workflow').item.json;
const diag = $('AI Diagnose').item.json;
const ctx  = $('Build Context').item.json;

function walk(v) {
  if (typeof v === 'string') return v.split(diag.expectedField).join(diag.replacementField);
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  }
  return v;
}

let before = null;
const nodes = wf.nodes.map(n => {
  if (n.name !== ctx.failedNode) return n;
  before = JSON.stringify(n.parameters);
  return { ...n, parameters: walk(n.parameters) };
});

if (before === JSON.stringify(nodes.find(n => n.name === ctx.failedNode).parameters)) {
  throw new Error('Patch produced no change — aborting rather than writing a no-op.');
}

return [{
  json: {
    body: {                      // PUT rejects read-only fields — send only these four
      name: wf.name,
      nodes,
      connections: wf.connections,
      settings: wf.settings ?? {}
    },
    audit: {
      node: ctx.failedNode,
      oldMapping: diag.expectedField,
      newMapping: diag.replacementField,
      confidence: diag.confidence
    }
  }
}];
```

The no-op check matters. Without it a bad `expectedField` silently writes the workflow back unchanged and your demo shows a green "repaired" message over a broken workflow.

### 8. Update Workflow — HTTP Request

```
PUT {{$env.N8N_BASE_URL}}/api/v1/workflows/{{$('Build Context').item.json.workflowId}}
Body: {{ $json.body }}
```

Sending `id`, `active`, `createdAt`, `updatedAt` or `tags` returns a 400. Only the four fields above.

### 9. Re-run — HTTP Request

```
POST {{$env.VICTIM_WEBHOOK_URL}}
```

### 10. Verify — Wait (3s) → HTTP Request

```
GET {{$env.N8N_BASE_URL}}/api/v1/executions?workflowId={{...}}&limit=1
```

Read `status` from the first result. `success` → node 11a, anything else → 11b with an escalation note.

### 11. Slack

Keep both message formats from v1. Add to the escalation message:

```
Repair attempts on this node: {{ attempts }}
```

---

## Victim workflow

Keep it to four nodes so the failure is unambiguous on a projector.

```
Webhook (POST /fragile-demo)
   ↓
Set "Customer Data"  →  { "customer_name": "Anu", "email": "anu@example.com" }
   ↓
Set "Transform Customer"  →  greeting = "Hello {{ $json.customer_name }}"
   ↓
NoOp "Done"
```

One expression, one place to break it, visible in a single screenshot.

---

## Demo script (4 minutes)

| Time | Action | What's on screen |
|---|---|---|
| 0:00 | "Every automation platform has the same problem: things break at 3am and nobody knows." | Title slide |
| 0:20 | Run Victim. Green. | Editor, green checkmarks |
| 0:40 | Open Transform Customer, change `customer_name` → `name`, save. | The one-line sabotage, in full view |
| 1:00 | Run Victim. Red. | Red node, error panel |
| 1:15 | Switch to AutoMedic executions list. | New execution appears **within seconds** |
| 1:30 | Walk the branches while it runs. | Diagnosis JSON, confidence 0.9x |
| 2:00 | Slack message lands. | Repair summary |
| 2:15 | Back to Victim. Open the node. | Expression reads `customer_name` again |
| 2:30 | Show the new green execution. | Green |
| 2:45 | **"Now watch it refuse."** Break the HTTP credential instead. | Red again |
| 3:15 | AutoMedic diagnoses AUTH_EXPIRED, changes nothing, escalates. | Slack escalation |
| 3:40 | "It fixes what it can prove, and escalates what it can't." | Close |

The refusal is the part that wins. Anyone can demo an AI that acts. Demoing one that correctly declines to act on credentials shows you thought about safety, which is exactly what a judge worries about with self-modifying systems.

---

## Judge questions to have answers ready for

**"It only fixes the bug you planted."**
True, and deliberate. Field mapping is the second most common n8n failure after auth, and it's the only category where the fix is *verifiable* — the field either exists in the input or it doesn't. Auto-repairing auth or logic means guessing at intent. We scoped to the class where correctness is provable.

**"What stops it corrupting a production workflow?"**
Four gates: confidence threshold, exact-substring replacement only, a no-op abort if the patch changes nothing, and a one-attempt-per-node cap. Plus the original value is stored in the audit record.

**"What if the AI hallucinates a field name?"**
Then the substring isn't found, the patch is a no-op, node 7 throws, and it escalates to Slack. Failure mode is "does nothing and tells you," not "writes garbage."

**"Does this scale past one error type?"**
The classifier already returns six. Adding a repair strategy is a new branch off the IF, not a redesign. Rate limits would be the next one, since the fix is deterministic — insert a Wait node.

---

## Build order and time budget

| Step | Est. |
|---|---|
| Victim workflow + webhook + error workflow setting | 20 min |
| Nodes 1–3, verify you can read workflow + execution JSON | 45 min |
| Node 5 AI diagnosis, iterate the prompt until JSON is clean | 60 min |
| Node 7 patcher + node 8 PUT | 60 min |
| Nodes 9–10 re-run and verify | 30 min |
| Slack formatting | 20 min |
| Loop guard | 20 min |
| Rehearse the demo three times | 45 min |

Roughly 5 hours. Build in that order — each step is demoable on its own, so if you run out of time you still have something to show.

---

## Fallback plan

Record a screen capture of a clean successful run the night before. If the live demo fails, you have 4 minutes of video and a story about why reliability engineering is hard. Judges forgive a broken live demo; they do not forgive standing there silently debugging.

Also: pre-warm the AI credential, disable every other workflow on the instance so the executions list is clean, and have the Slack channel already open on a second screen.
