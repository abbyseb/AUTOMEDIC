#!/usr/bin/env node
/**
 * Level 1: AutoMedic Audit — detect dangling $json refs on SUCCESSFUL runs (silent drift).
 * POST /webhook/automedic/audit
 * Does NOT auto-patch; upserts escalated/detected incident.
 */
const fs = require('fs');
const path = require('path');
const ROOT = require('path').join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const CRED = fs.readFileSync(path.join(ROOT, 'n8n_cred_id.txt'), 'utf8').trim();
const INC = fs.readFileSync(path.join(ROOT, 'incidents_table_id.txt'), 'utf8').trim();
const REV = fs.readFileSync(path.join(ROOT, 'revenue_ops_id.txt'), 'utf8').trim();
const BASE = 'http://127.0.0.1:5678';
const idsPath = path.join(ROOT, 'local_workflow_ids.json');

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 700)}`);
  return json;
}

const n8nCred = { n8nApi: { id: CRED, name: 'Local n8n API' } };

async function main() {
  const analyzeCode = `
const SECRET = 'automedic-demo-secret';
const h = $('Audit Webhook').first().json.headers || {};
const got = h['x-automedic-secret'] || h['X-AutoMedic-Secret'] || '';
if (!got || got !== SECRET) throw new Error('Unauthorized');

const wf = $json || {};
const known = new Set();
for (const n of wf.nodes || []) {
  const assigns = n.parameters && n.parameters.assignments && n.parameters.assignments.assignments;
  if (Array.isArray(assigns)) for (const a of assigns) if (a && a.name) known.add(String(a.name));
}
for (const k of ['validated','is_b2b','crmOpportunityId','crmSynced','commission','commission_rate','currency_upper','notify_text','ledger_line','shapeValidated','ok','synced','amount','dealAmount','account_key','tier','pipeline','owner_team','net_terms_days']) known.add(k);

const refs = new Set();
const blob = JSON.stringify(wf.nodes || []);
for (const m of blob.matchAll(/\\$json\\.([A-Za-z0-9_]+)/g)) refs.add(m[1]);
for (const skip of ['Number','String','Boolean','Object','Array','Math','JSON','Date']) refs.delete(skip);
const danglingRefs = [...refs].filter((r) => !known.has(r));

return [{ json: {
  workflowId: String(wf.id),
  workflowName: wf.name,
  danglingRefs,
  expressionRefs: [...refs],
  observedFields: [...known],
  incidentId: 'inc_audit_' + String(wf.id) + '_' + Date.now(),
  status: danglingRefs.length ? 'escalated' : 'clean',
  failureType: danglingRefs.length ? 'SILENT_DRIFT' : null,
  reason: danglingRefs.length
    ? ('Workflow is publishable/green-capable but references missing keys: ' + danglingRefs.map((d) => '$json.' + d).join(', ') + '. No auto-patch — awaiting approval.')
    : 'No dangling refs vs declared assignment/output keys.',
  autoRepairSafe: false,
}}];
`.trim();

  const nodes = [
    {
      id: 'wh',
      name: 'Audit Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, 0],
      webhookId: 'automedic-audit',
      parameters: {
        httpMethod: 'POST',
        path: 'automedic/audit',
        responseMode: 'lastNode',
        options: { allowedOrigins: '*' },
      },
    },
    {
      id: 'get',
      name: 'Get Revenue Ops',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [220, 0],
      credentials: n8nCred,
      parameters: {
        method: 'GET',
        url: `http://localhost:5678/api/v1/workflows/${REV}`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'n8nApi',
        options: {},
      },
    },
    {
      id: 'an',
      name: 'Analyze Dangling',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: analyzeCode },
    },
    {
      id: 'has',
      name: 'Has Drift?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [660, 0],
      parameters: {
        conditions: {
          combinator: 'and',
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.danglingRefs.length }}',
              rightValue: 0,
              operator: { type: 'number', operation: 'gt' },
            },
          ],
        },
      },
    },
    {
      id: 'up',
      name: 'Upsert Drift Incident',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1,
      position: [880, -80],
      parameters: {
        resource: 'row',
        operation: 'upsert',
        dataTableId: { __rl: true, mode: 'id', value: INC },
        matchType: 'allConditions',
        filters: { conditions: [{ keyName: 'incident_id', keyValue: "={{ $json.incidentId }}" }] },
        columns: {
          mappingMode: 'defineBelow',
          matchingColumns: ['incident_id'],
          value: {
            incident_id: '={{ $json.incidentId }}',
            execution_id: 'audit',
            workflow_id: '={{ $json.workflowId }}',
            workflow_name: '={{ $json.workflowName }}',
            failed_node: 'graph-audit',
            error_message: '={{ $json.reason }}',
            status: 'escalated',
            failure_type: '={{ $json.failureType }}',
            confidence: 0.9,
            auto_repair_safe: false,
            reason: '={{ $json.reason }}',
            source_field: "={{ ($json.danglingRefs || [])[0] || '' }}",
            target_field: '',
            observed_fields: '={{ JSON.stringify($json.observedFields||[]) }}',
            gate_passed: false,
            gate_summary: 'LEVEL1 SILENT_DRIFT — no auto-patch',
          },
        },
      },
    },
    {
      id: 'bad',
      name: 'Drift Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, -80],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const d=$('Analyze Dangling').first().json; return [{json:{ok:true,level:1,mode:'audit',drift:true,incidentId:d.incidentId,danglingRefs:d.danglingRefs,reason:d.reason,autoRepairSafe:false}}];`,
      },
    },
    {
      id: 'ok',
      name: 'Clean Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, 100],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const d=$json; return [{json:{ok:true,level:1,mode:'audit',drift:false,danglingRefs:[],reason:d.reason}}];`,
      },
    },
  ];

  const connections = {
    'Audit Webhook': { main: [[{ node: 'Get Revenue Ops', type: 'main', index: 0 }]] },
    'Get Revenue Ops': { main: [[{ node: 'Analyze Dangling', type: 'main', index: 0 }]] },
    'Analyze Dangling': { main: [[{ node: 'Has Drift?', type: 'main', index: 0 }]] },
    'Has Drift?': {
      main: [
        [{ node: 'Upsert Drift Incident', type: 'main', index: 0 }],
        [{ node: 'Clean Response', type: 'main', index: 0 }],
      ],
    },
    'Upsert Drift Incident': { main: [[{ node: 'Drift Response', type: 'main', index: 0 }]] },
  };

  // Replace existing audit if present
  const list = await api('GET', '/api/v1/workflows?limit=50');
  const existing = (list.data || []).find((w) => w.name === 'AutoMedic Audit (Silent Drift)');
  let id;
  if (existing) {
    await api('PUT', `/api/v1/workflows/${existing.id}`, {
      name: 'AutoMedic Audit (Silent Drift)',
      nodes,
      connections,
      settings: {},
    });
    id = existing.id;
  } else {
    const created = await api('POST', '/api/v1/workflows', {
      name: 'AutoMedic Audit (Silent Drift)',
      nodes,
      connections,
      settings: {},
    });
    id = created.id;
  }
  await api('POST', `/api/v1/workflows/${id}/activate`);
  const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
  ids.audit = id;
  fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, audit: id }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
