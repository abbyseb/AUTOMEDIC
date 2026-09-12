#!/usr/bin/env node
/**
 * Add POST /automedic/break-auth (plants AutoMedic AUTH Probe on Revenue Ops)
 * and teach Reset to strip that probe + restore Webhook → Mock Revenue Event.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const idsPath = path.join(ROOT, 'local_workflow_ids.json');
const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
const BASE = 'http://127.0.0.1:5678';
const REV = ids.revenueOps || 'WVbBvATKVVQ9MvzL';
const AUTH_NAME = 'AutoMedic AUTH Probe';

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
return [{json:{ok:true}}];`;

const plantAuthCode = `const AUTH_NAME = 'AutoMedic AUTH Probe';
const AUTH_ID = 'automedic_auth_probe';
const wf = $json;
let nodes = JSON.parse(JSON.stringify(wf.nodes || []));
let connections = JSON.parse(JSON.stringify(wf.connections || {}));

function isAuthPlant(n) {
  if (!n) return false;
  if (n.name === AUTH_NAME) return true;
  const code = (n.parameters && n.parameters.jsCode) || '';
  if (/^Code in JavaScript/.test(n.name) && /401|Unauthorized|API key expired/i.test(code)) return true;
  return false;
}

const drop = new Set(nodes.filter(isAuthPlant).map((n) => n.name));
nodes = nodes.filter((n) => !drop.has(n.name));

for (const from of Object.keys(connections)) {
  if (drop.has(from)) {
    delete connections[from];
    continue;
  }
  const main = connections[from] && connections[from].main;
  if (!Array.isArray(main)) continue;
  connections[from].main = main.map((branch) =>
    (branch || [])
      .map((link) => {
        if (link && drop.has(link.node)) {
          return { ...link, node: 'Mock Revenue Event' };
        }
        return link;
      })
      .filter(Boolean)
  );
}

nodes.push({
  id: AUTH_ID,
  name: AUTH_NAME,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [40, 352],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: "throw new Error('401 Unauthorized — API key expired');",
  },
});

connections['Webhook'] = { main: [[{ node: AUTH_NAME, type: 'main', index: 0 }]] };
connections[AUTH_NAME] = { main: [[{ node: 'Mock Revenue Event', type: 'main', index: 0 }]] };
if (connections['Run Manually']) {
  connections['Run Manually'] = { main: [[{ node: AUTH_NAME, type: 'main', index: 0 }]] };
}

return [{
  json: {
    workflowId: wf.id,
    updateBody: {
      name: wf.name,
      nodes,
      connections,
      settings: wf.settings || {},
    },
  },
}];`;

const restoreCode = `const AUTH_NAME = 'AutoMedic AUTH Probe';
const wf = $json;
let nodes = JSON.parse(JSON.stringify(wf.nodes || []));
let connections = JSON.parse(JSON.stringify(wf.connections || {}));

function isAuthPlant(n) {
  if (!n) return false;
  if (n.name === AUTH_NAME) return true;
  const code = (n.parameters && n.parameters.jsCode) || '';
  if (/^Code in JavaScript/.test(n.name) && /401|Unauthorized|API key expired/i.test(code)) return true;
  return false;
}

const drop = new Set(nodes.filter(isAuthPlant).map((n) => n.name));
nodes = nodes.filter((n) => !drop.has(n.name));

for (const from of Object.keys(connections)) {
  if (drop.has(from)) {
    delete connections[from];
    continue;
  }
  const main = connections[from] && connections[from].main;
  if (!Array.isArray(main)) continue;
  connections[from].main = main.map((branch) =>
    (branch || []).map((link) => {
      if (link && drop.has(link.node)) {
        return { ...link, node: 'Mock Revenue Event' };
      }
      return link;
    })
  );
}

connections['Webhook'] = { main: [[{ node: 'Mock Revenue Event', type: 'main', index: 0 }]] };
if (nodes.some((n) => n.name === 'Run Manually')) {
  connections['Run Manually'] = { main: [[{ node: 'Mock Revenue Event', type: 'main', index: 0 }]] };
}

for (const n of nodes) {
  if (n.name === 'Map to CRM Fields') {
    n.parameters = {
      mode: 'manual',
      includeOtherFields: true,
      options: {},
      assignments: {
        assignments: [
          { id: '1', name: 'customerEmail', type: 'string', value: '={{ $json.email_address }}' },
          { id: '2', name: 'accountName', type: 'string', value: '={{ $json.account_name }}' },
          { id: '3', name: 'dealAmount', type: 'string', value: '={{ Number($json.amount_cents||0)/100 }}' },
          { id: '4', name: 'amount', type: 'string', value: '={{ Number($json.amount_cents||0)/100 }}' },
          { id: '5', name: 'sku', type: 'string', value: '={{ $json.sku }}' },
          { id: '6', name: 'segment', type: 'string', value: '={{ $json.segment }}' },
        ],
      },
    };
  }
  if (n.name === 'Is B2B?') {
    let raw = JSON.stringify(n.parameters || {});
    raw = raw.replace(/\\$json\\.is_c2c(?![A-Za-z0-9_])/g, '$json.is_b2b');
    n.parameters = JSON.parse(raw);
  }
  if (n.name === 'Assert Segment' && n.parameters.jsCode) {
    n.parameters.jsCode = n.parameters.jsCode
      .replace(/\\$json\\.ooooo(?![A-Za-z0-9_])/g, '$json.segment')
      .replace(/\\$json\\.segment123(?![A-Za-z0-9_])/g, '$json.segment');
  }
  if (n.name === 'Finalize Success' && n.parameters.jsCode) {
    n.parameters.jsCode = \`return {
  json: {
    ok: true,
    synced: true,
    crmOpportunityId: $json.crmOpportunityId,
    customerEmail: $json.customerEmail,
    accountName: $json.accountName,
    commission: $json.commission,
    ledger_line: $json.ledger_line,
    notify_text: $json.notify_text,
    event_id: $json.event_id,
  },
};\`;
  }
}

return [{
  json: {
    workflowId: wf.id,
    updateBody: {
      name: wf.name,
      nodes,
      connections,
      settings: wf.settings || {},
    },
  },
}];`;

async function upsertAuthBreak() {
  const breakWf = await api('GET', `/api/v1/workflows/${ids.break}`);
  const n8nCred = breakWf.nodes.find((n) => n.credentials && n.credentials.n8nApi)?.credentials
    ?.n8nApi;

  const nodes = [
    {
      id: 'ab-wh',
      name: 'Auth Break Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      parameters: {
        httpMethod: 'POST',
        path: 'automedic/break-auth',
        responseMode: 'lastNode',
        options: { allowedOrigins: '*' },
      },
      webhookId: 'automedic-break-auth',
    },
    {
      id: 'ab-sec',
      name: 'Check Secret',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: secretCode },
    },
    {
      id: 'ab-get',
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
      id: 'ab-plant',
      name: 'Plant AUTH Probe',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: plantAuthCode },
    },
    {
      id: 'ab-put',
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
      id: 'ab-run',
      name: 'Execute Broken Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1100, 0],
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
      id: 'ab-res',
      name: 'Auth Break Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1320, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `return [{json:{ok:true,mode:'local-api',broken:true,kind:'AUTH',workflowId:'${REV}',message:'Planted AutoMedic AUTH Probe (401). Run failed. Press Scan — expect escalate, no mutation. Reset removes the probe.'}}];`,
      },
    },
  ];

  const connections = {
    'Auth Break Webhook': { main: [[{ node: 'Check Secret', type: 'main', index: 0 }]] },
    'Check Secret': { main: [[{ node: 'Get Victim', type: 'main', index: 0 }]] },
    'Get Victim': { main: [[{ node: 'Plant AUTH Probe', type: 'main', index: 0 }]] },
    'Plant AUTH Probe': { main: [[{ node: 'Update Victim', type: 'main', index: 0 }]] },
    'Update Victim': { main: [[{ node: 'Execute Broken Victim', type: 'main', index: 0 }]] },
    'Execute Broken Victim': { main: [[{ node: 'Auth Break Response', type: 'main', index: 0 }]] },
  };

  let existingId = ids.breakAuth;
  if (!existingId) {
    const list = await api('GET', '/api/v1/workflows?limit=100');
    const hit = (list.data || []).find((w) => /break-auth|Auth Break/i.test(w.name));
    if (hit) existingId = hit.id;
  }

  const body = {
    name: 'AutoMedic Auth Break (Local)',
    nodes,
    connections,
    settings: breakWf.settings || {},
  };

  let wf;
  if (existingId) {
    wf = await api('PUT', `/api/v1/workflows/${existingId}`, body);
  } else {
    wf = await api('POST', '/api/v1/workflows', body);
  }
  await api('POST', `/api/v1/workflows/${wf.id}/activate`);
  ids.breakAuth = wf.id;
  fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n');
  console.log('auth break:', wf.id, 'active');
}

async function updateReset() {
  const wf = await api('GET', `/api/v1/workflows/${ids.reset}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
  for (const n of nodes) {
    if (n.name === 'Restore Healthy Mapping') n.parameters.jsCode = restoreCode;
    if (n.name === 'Check Secret') n.parameters.jsCode = secretCode;
    if (n.name === 'Reset Response') {
      n.parameters.jsCode =
        "return [{json:{ok:true,mode:'local-api',status:'WATCHING',message:'Cleared, restored Revenue Ops (Map + removed AUTH probe).'}}];";
    }
  }
  await api('PUT', `/api/v1/workflows/${ids.reset}`, {
    name: wf.name,
    nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  });
  console.log('reset: strips AUTH probe');
}

async function cleanVictimNow() {
  const wf = await api('GET', `/api/v1/workflows/${REV}`);
  // reuse plant then restore via putting restore logic inline
  let nodes = JSON.parse(JSON.stringify(wf.nodes || []));
  let connections = JSON.parse(JSON.stringify(wf.connections || {}));
  function isAuthPlant(n) {
    if (n.name === AUTH_NAME) return true;
    const code = (n.parameters && n.parameters.jsCode) || '';
    if (/^Code in JavaScript/.test(n.name) && /401|Unauthorized|API key expired/i.test(code))
      return true;
    return false;
  }
  const drop = new Set(nodes.filter(isAuthPlant).map((n) => n.name));
  // also drop empty leftover Code in JavaScript* even without 401 if they're between webhook and mock
  for (const n of nodes) {
    if (/^Code in JavaScript/.test(n.name)) drop.add(n.name);
  }
  nodes = nodes.filter((n) => !drop.has(n.name));
  for (const from of Object.keys(connections)) {
    if (drop.has(from)) delete connections[from];
    else if (connections[from]?.main) {
      connections[from].main = connections[from].main.map((branch) =>
        (branch || []).map((link) =>
          link && drop.has(link.node) ? { ...link, node: 'Mock Revenue Event' } : link
        )
      );
    }
  }
  connections['Webhook'] = { main: [[{ node: 'Mock Revenue Event', type: 'main', index: 0 }]] };
  if (nodes.some((n) => n.name === 'Run Manually')) {
    connections['Run Manually'] = {
      main: [[{ node: 'Mock Revenue Event', type: 'main', index: 0 }]],
    };
  }
  await api('PUT', `/api/v1/workflows/${REV}`, {
    name: wf.name,
    nodes,
    connections,
    settings: wf.settings || {},
  });
  console.log('victim cleaned of leftover Code nodes:', [...drop].join(', ') || '(none)');
}

async function main() {
  await cleanVictimNow();
  await updateReset();
  await upsertAuthBreak();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
