# `/state` contract (frozen)

**Ticket:** [#1 Freeze /state JSON contract](https://github.com/abbyseb/SIGN-OS/issues/1)

This folder is the single source of truth for `GET /automedic/state`.

| File | Purpose |
|------|---------|
| `state.example.json` | Mid-heal demo payload (FIELD_MAPPING in progress + seeded AUTH_EXPIRED) |
| `state.reset.example.json` | Clean demo start: 3 green workflows + seeded escalation only |
| `state.ts` | TypeScript types for Mission Control |
| `state.schema.json` | JSON Schema for quick validation |

## Freeze rules

1. **Both tracks** (n8n + frontend) build against these files.
2. Frontend may mock-poll `state.example.json` / `state.reset.example.json` until live webhooks exist.
3. n8n `GET /automedic/state` must return this **shape** (field names + enums). Extra fields are discouraged.
4. **No contract changes after T+9** unless both builders agree out loud and update this folder in the same PR/commit.
5. Demo controls map to other endpoints; they are **not** part of `/state`:
   - `POST /automedic/break`
   - `POST /automedic/scan`
   - `POST /automedic/reset`

## Auth

Send shared secret header (exact name TBD when webhooks are wired), e.g.:

```http
GET /webhook/automedic/state
X-AutoMedic-Secret: <shared>
```

## UI mapping

| UI piece | Contract path |
|----------|----------------|
| Status pill | `status` |
| Health rail | `watchedWorkflows[]` |
| Stats bar | `stats` |
| Incident list | `incidents[]` |
| Focused timeline / diagnosis / diff | incident where `id === activeIncidentId` |
| Confidence threshold marker | `gate.threshold` (always `0.8` for POC) |
| Diff panel | `patch.before` / `patch.after` (+ `oldMapping` / `newMapping`) |
