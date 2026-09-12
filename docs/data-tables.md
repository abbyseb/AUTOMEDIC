# AutoMedic Data Tables

**Ticket:** [#3](https://github.com/abbyseb/SIGN-OS/issues/3)  
**Project ID:** `XHYxoLgVt2M3z505` (personal)

| Table | ID | Purpose |
|-------|-----|---------|
| `automedic_incidents` | `cPDeMnEqQkE6XSq6` | Full incident + diagnosis/gate/patch fields for `/state` |
| `automedic_audit_log` | `5KsmDzsCpFFY7uUo` | Timeline steps (`incident_id`, `step`, `status`, `message`, `occurred_at`) |
| `automedic_snapshots` | `2OWdAhgcAGeRpuM9` | Pre-patch / healthy workflow JSON (`snapshot_id`, `incident_id`, `workflow_json`) |
| `automedic_processed_executions` | `epl2HrgcnsFskiyV` | Dedup + repair outcome log (existing; keep for AutoMedic nodes) |

## Column notes

### `automedic_incidents`
`observed_fields` is stored as a **JSON string array** (Data Tables have no array type).  
Nullable string fields use empty/`null` when N/A (e.g. AUTH_EXPIRED has no patch).

### `automedic_audit_log`
UI timeline = rows for an `incident_id` ordered by `occurred_at` asc.  
`step` values match contract: `DETECTED`, `DIAGNOSING`, `DIAGNOSED`, `GATE`, `PATCHING`, `PATCHED`, `RE_RUNNING`, `VERIFIED`, `ESCALATED`, `SUPPRESSED`.

### `automedic_snapshots`
`kind`: `pre_patch` | `healthy` | `broken`  
`workflow_json`: full workflow export string used by `/reset` and patcher rollback later.

## Seeded smoke rows
- `inc_seed_auth` (AUTH_EXPIRED escalated) + 4 audit steps  
- `inc_demo_field` (FIELD_MAPPING diagnosed) + 3 audit steps + `snap_inc_demo_field`  
- `victim_healthy` snapshot for reset

Verify by hand in n8n Data Tables UI or via MCP `get_data_table_rows`.
