# Ticket #2 — AutoMedic audit notes

**Workflow:** [n8n AutoMedic — Self-Healing Workflow Engine](https://kaviya-aj.app.n8n.cloud/workflow/HP8k9xwOVyXGYm9v)  
**ID:** `HP8k9xwOVyXGYm9v`  
**Data table (dedup / repair log):** `epl2HrgcnsFskiyV`  
**Status:** workflow remains **inactive** (publish later when `/scan` exists)

## Checklist

- [x] Listed nodes (22) — schedule, HTTP n8n API, Code extract/select/patch, Data Table dedup, AI chain, IF gate, executeWorkflow re-run, Slack stubs
- [x] n8n API credential type present on HTTP nodes (`n8nApi`)
- [x] Data Table dedup on `execution_id` kept (`Skip Already Processed`)
- [x] **Disabled** schedule node `Every 1 Minute` (demo will use `/scan` — ticket #7)
- [x] **Disabled** placeholder Slack nodes:
  - `Slack: Repair Success`
  - `Slack: Re-run Failed`
  - `Slack: Needs Attention`
- [x] **Self-exclude:** `Extract Failure Context` skips workflow id `HP8k9xwOVyXGYm9v`

## Manual trigger still available

`Run Manually (Demo)` → `Get Failed Executions` remains wired for rehearsal without the schedule.

## Still deferred (later tickets)

- Watch-tag filter + lookback cap (#7)
- `/scan` webhook (#7)
- Circuit breaker (#7)
- Replace Slack with audit_log → UI toasts (#12 / FE)
