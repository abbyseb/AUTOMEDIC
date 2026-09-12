#!/usr/bin/env node
/**
 * POST /automedic/scenario  body: { "scenario": "l1"|"l2"|"l3" }
 * L1 — Is B2B? → is_c2c, run victim (200), call /automedic/audit
 * L2 — customerEmail → account_name, run victim (shape fail)
 * L3 — same as L2, then call /automedic/semantic (HITL proposals)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const idsPath = path.join(ROOT, 'local_workflow_ids.json');
const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
const BASE = 'http://127.0.0.1:5678';
const REV = ids.revenueOps || 'WVbBvATKVVQ9MvzL';

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 800)}`);
  return json;
}

const secretCode = `const SECRET='automedic-demo-secret';
const h=$json.headers||{};
const got=h['x-automedic-secret']||h['X-AutoMedic-Secret']||'';
if(!got || got!==SECRET) throw new Error('Unauthorized');
const body = ($json.body && typeof $json.body === 'object') ? $json.body : {};
const q = ($json.query && typeof $json.query === 'object') ? $json.query : {};
const scenario = String(body.scenario || body.level || q.scenario || q.level || '').toLowerCase();
if (!['l1','l2','l3','1','2','3'].includes(scenario)) {
  throw new Error('Body must include scenario: l1 | l2 | l3');
}
const norm = scenario.length === 1 ? ('l' + scenario) : scenario;
return [{ json: { ok: true, scenario: norm } }];`;

const plantCode = `const scenario = $('Check Secret').first().json.scenario;
const wf = $json;
const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
const connections = JSON.parse(JSON.stringify(wf.connections || {}));

for (const n of nodes) {
  if (n.name === 'Is B2B?') {
    let raw = JSON.stringify(n.parameters || {});
    if (scenario === 'l1') {
      raw = raw.replace(/\\$json\\.is_b2b(?![A-Za-z0-9_])/g, '$json.is_c2c');
    } else {
      raw = raw.replace(/\\$json\\.is_c2c(?![A-Za-z0-9_])/g, '$json.is_b2b');
    }
    n.parameters = JSON.parse(raw);
  }
  if (n.name === 'Map to CRM Fields') {
    const assigns = n.parameters && n.parameters.assignments && n.parameters.assignments.assignments;
    if (Array.isArray(assigns)) {
      for (const a of assigns) {
        if (a.name !== 'customerEmail') continue;
        if (scenario === 'l2' || scenario === 'l3') {
          a.value = '={{ $json.account_name }}';
        } else {
          a.value = '={{ $json.email_address }}';
        }
      }
    }
  }
}

return [{
  json: {
    scenario,
    workflowId: wf.id,
    updateBody: {
      name: wf.name,
      nodes,
      connections,
      settings: wf.settings || {},
    },
  },
}];`;

const routeCode = `const scenario = $('Check Secret').first().json.scenario;
const plant = $('Plant Scenario').first().json;
return [{
  json: {
    ...plant,
    scenario,
    callAudit: scenario === 'l1',
    callSemantic: scenario === 'l3',
    message:
      scenario === 'l1'
        ? 'L1 planted: Is B2B? → is_c2c (silent). Running audit.'
        : scenario === 'l2'
          ? 'L2 planted: customerEmail → account_name (shape fail).'
          : 'L3 planted: customerEmail → account_name, then semantic critic.',
  },
}];`;

async function main() {
  const breakWf = await api('GET', `/api/v1/workflows/${ids.break}`);
  const n8nCred = breakWf.nodes.find((n) => n.credentials?.n8nApi)?.credentials?.n8nApi;

  const nodes = [
    {
      id: 'sc-wh',
      name: 'Scenario Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: 'automedic-scenario',
      parameters: {
        httpMethod: 'POST',
        path: 'automedic/scenario',
        responseMode: 'lastNode',
        options: { allowedOrigins: '*' },
      },
    },
    {
      id: 'sc-sec',
      name: 'Check Secret',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: secretCode },
    },
    {
      id: 'sc-get',
      name: 'Get Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [440, 0],
      parameters: {
        method: 'GET',
        url: `http://localhost:5678/api/v1/workflows/${REV}`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'n8nApi',
        options: {},
      },
      credentials: { n8nApi: n8nCred },
    },
    {
      id: 'sc-plant',
      name: 'Plant Scenario',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: plantCode },
    },
    {
      id: 'sc-put',
      name: 'Update Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [880, 0],
      parameters: {
        method: 'PUT',
        url: '=http://localhost:5678/api/v1/workflows/{{ $json.workflowId }}',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'n8nApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.updateBody) }}',
        options: {},
      },
      credentials: { n8nApi: n8nCred },
    },
    {
      id: 'sc-route',
      name: 'Tag Scenario',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: routeCode },
    },
    {
      id: 'sc-run',
      name: 'Run Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1320, 0],
      parameters: {
        method: 'POST',
        url: 'http://localhost:5678/webhook/revenue-ops',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '{}',
        options: {},
      },
      continueOnFail: true,
      onError: 'continueRegularOutput',
    },
    {
      id: 'sc-if-audit',
      name: 'Need Audit?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1540, -80],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'c1',
              leftValue: "={{ $('Tag Scenario').first().json.callAudit }}",
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
    },
    {
      id: 'sc-audit',
      name: 'Call Audit',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1760, -160],
      parameters: {
        method: 'POST',
        url: 'http://localhost:5678/webhook/automedic/audit',
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: 'X-AutoMedic-Secret', value: 'automedic-demo-secret' }],
        },
        options: { timeout: 60000 },
      },
      continueOnFail: true,
      onError: 'continueRegularOutput',
    },
    {
      id: 'sc-if-sem',
      name: 'Need Semantic?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1540, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'c2',
              leftValue: "={{ $('Tag Scenario').first().json.callSemantic }}",
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
    },
    {
      id: 'sc-sem',
      name: 'Call Semantic',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1760, 200],
      parameters: {
        method: 'POST',
        url: 'http://localhost:5678/webhook/automedic/semantic',
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: 'X-AutoMedic-Secret', value: 'automedic-demo-secret' }],
        },
        options: { timeout: 90000 },
      },
      continueOnFail: true,
      onError: 'continueRegularOutput',
    },
    {
      id: 'sc-res',
      name: 'Scenario Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1980, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const t=$('Tag Scenario').first().json;
let audit=null, semantic=null;
try { audit=$('Call Audit').first().json; } catch(e) {}
try { semantic=$('Call Semantic').first().json; } catch(e) {}
return [{json:{
  ok:true,
  mode:'scenario',
  scenario:t.scenario,
  message:t.message,
  audit: audit && audit.ok ? { drift: audit.drift, danglingRefs: audit.danglingRefs } : null,
  semantic: semantic && semantic.ok ? { escalated: semantic.escalated, suggestions: semantic.suggestions, incidentId: semantic.incidentId } : null,
}}];`,
      },
    },
  ];

  // Flow: run victim → always evaluate both IFs from Tag Scenario via Merge-less pattern:
  // After Run Victim, go to Need Audit? ; false branch → Need Semantic? ; 
  // Actually both need to run from Run Victim. Use parallel from Run Victim to both IFs, then both converge to Response.
  // n8n: Run Victim → Need Audit? (true→Call Audit→Response, false→Response)
  //                → Need Semantic? can't dual-wire easily to same Response without merge.

  // Simpler linear approach in Code after Run Victim that HTTP-calls via... can't.
  // Use: Run Victim → Call Followups (Code that doesn't HTTP)
  // Better: sequential — Run → if audit call → if semantic call → response
  // Tag already has flags. After Run:
  //   Need Audit? true → Call Audit → Need Semantic?
  //   Need Audit? false → Need Semantic?
  //   Need Semantic? true → Call Semantic → Response
  //   Need Semantic? false → Response

  const connections = {
    'Scenario Webhook': { main: [[{ node: 'Check Secret', type: 'main', index: 0 }]] },
    'Check Secret': { main: [[{ node: 'Get Victim', type: 'main', index: 0 }]] },
    'Get Victim': { main: [[{ node: 'Plant Scenario', type: 'main', index: 0 }]] },
    'Plant Scenario': { main: [[{ node: 'Update Victim', type: 'main', index: 0 }]] },
    'Update Victim': { main: [[{ node: 'Tag Scenario', type: 'main', index: 0 }]] },
    'Tag Scenario': { main: [[{ node: 'Run Victim', type: 'main', index: 0 }]] },
    'Run Victim': { main: [[{ node: 'Need Audit?', type: 'main', index: 0 }]] },
    'Need Audit?': {
      main: [
        [{ node: 'Call Audit', type: 'main', index: 0 }],
        [{ node: 'Need Semantic?', type: 'main', index: 0 }],
      ],
    },
    'Call Audit': { main: [[{ node: 'Need Semantic?', type: 'main', index: 0 }]] },
    'Need Semantic?': {
      main: [
        [{ node: 'Call Semantic', type: 'main', index: 0 }],
        [{ node: 'Scenario Response', type: 'main', index: 0 }],
      ],
    },
    'Call Semantic': { main: [[{ node: 'Scenario Response', type: 'main', index: 0 }]] },
  };

  let existingId = ids.scenario;
  if (!existingId) {
    const list = await api('GET', '/api/v1/workflows?limit=100');
    const hit = (list.data || []).find((w) => /Scenario Break|automedic\/scenario/i.test(w.name));
    if (hit) existingId = hit.id;
  }

  const body = {
    name: 'AutoMedic Scenario Break (L1–L3)',
    nodes,
    connections,
    settings: breakWf.settings || {},
  };

  const wf = existingId
    ? await api('PUT', `/api/v1/workflows/${existingId}`, body)
    : await api('POST', '/api/v1/workflows', body);

  await api('POST', `/api/v1/workflows/${wf.id}/activate`);
  ids.scenario = wf.id;
  fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n');
  console.log('scenario break:', wf.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
