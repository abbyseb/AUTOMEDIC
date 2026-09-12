# Customer Order Sync (victim)

**Ticket:** [#4](https://github.com/abbyseb/SIGN-OS/issues/4)  
**Workflow ID:** `ecqdmAdfqzbWT0ds`  
**URL:** https://kaviya-aj.app.n8n.cloud/workflow/ecqdmAdfqzbWT0ds  
**Tag:** `automedic:watch`  
**Webhook (POST):** https://kaviya-aj.app.n8n.cloud/webhook/customer-order-sync  
**Healthy run:** execution `3` → `success`

## Nodes
1. **Run Manually** — demo trigger  
2. **Webhook** — `POST /customer-order-sync` (for later `/break` re-run)  
3. **Mock Orders** — `order_id`, `email_address`, `total`, `currency` (offline)  
4. **Map to CRM Fields** — healthy: `customerEmail = {{$json.email_address}}`  
5. **Create CRM Contact** — throws if `customerEmail` empty, listing available keys  

## Snapshot
- Repo: [`docs/victim-healthy.snapshot.json`](./victim-healthy.snapshot.json)  
- Data table `automedic_snapshots` (`2OWdAhgcAGeRpuM9`): `snapshot_id=victim_healthy`
