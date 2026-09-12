#!/usr/bin/env node
/**
 * Fix Opus audit findings: Map accountName, full L2 roles, Reset restore, require secrets.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'local_workflow_ids.json'), 'utf8'));
const BASE = 'http://127.0.0.1:5678';

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 600)}`);
  return json;
}

const validateCode = `const email = String($json.customerEmail || '');
const account = String($json.accountName || '');
const amount = Number($json.dealAmount ?? $json.amount);
const segment = String($json.segment || '');
const emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
if (!emailOk) {
  throw new Error(
    "SHAPE_VIOLATION: customerEmail must look like an email. Got: " +
      JSON.stringify(email) +
      ". Prefer source keys: email_address, email. Input keys: " +
      Object.keys($json).join(', ')
  );
}
if (!account.trim()) {
  throw new Error(
    "SHAPE_VIOLATION: accountName must be a non-empty string. Got: " +
      JSON.stringify($json.accountName) +
      ". Prefer source keys: account_name."
  );
}
if (!(amount > 0)) {
  throw new Error('SHAPE_VIOLATION: dealAmount must be a positive number. Got: ' + String($json.dealAmount));
}
if (!['B2B', 'B2C', 'SMB'].includes(segment)) {
  throw new Error('SHAPE_VIOLATION: segment must be one of B2B|B2C|SMB. Got: ' + JSON.stringify(segment));
}
return { json: { ...$json, shapeValidated: true } };`;

const secretCode = `const SECRET='automedic-demo-secret';
const h=$json.headers||{};
const got=h['x-automedic-secret']||h['X-AutoMedic-Secret']||'';
if(!got || got!==SECRET) throw new Error('Unauthorized');
return [{json:{ok:true}}];`;

const restoreCode = `const wf = $json;
const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
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
return [{ json: { workflowId: wf.id, updateBody: { name: wf.name, nodes, connections: wf.connections || {}, settings: wf.settings || {} } } }];`;

async function fixVictim() {
  const wf = await api('GET', `/api/v1/workflows/${ids.revenueOps}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
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
    if (n.name === 'Validate Mapped Fields') {
      n.parameters.jsCode = validateCode;
    }
    if (n.name === 'Is B2B?') {
      let raw = JSON.stringify(n.parameters || {});
      raw = raw.replace(/\$json\.is_c2c(?![A-Za-z0-9_])/g, '$json.is_b2b');
      n.parameters = JSON.parse(raw);
    }
    if (n.name === 'Finalize Success') {
      n.parameters.jsCode = `return {
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
};`;
    }
  }
  await api('PUT', `/api/v1/workflows/${ids.revenueOps}`, {
    name: wf.name,
    nodes,
    connections: wf.connections || {},
    settings: wf.settings || {},
  });
  console.log('victim: Map healthy + full L2 validate + Finalize fix');
}

async function fixReset() {
  const wf = await api('GET', `/api/v1/workflows/${ids.reset}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
  for (const n of nodes) {
    if (n.name === 'Check Secret') n.parameters.jsCode = secretCode;
    if (n.name === 'Restore Healthy Mapping') n.parameters.jsCode = restoreCode;
  }
  await api('PUT', `/api/v1/workflows/${ids.reset}`, {
    name: wf.name,
    nodes,
    connections: wf.connections || {},
    settings: wf.settings || {},
  });
  console.log('reset: full Map restore + require secret');
}

async function hardenSecrets(workflowId, label) {
  const wf = await api('GET', `/api/v1/workflows/${workflowId}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
  let changed = 0;
  for (const n of nodes) {
    if (n.name === 'Check Secret' || (n.parameters && n.parameters.jsCode && /automedic-demo-secret/.test(n.parameters.jsCode) && /Unauthorized/.test(n.parameters.jsCode))) {
      if (n.parameters.jsCode !== secretCode) {
        n.parameters.jsCode = secretCode;
        changed++;
      }
    }
    // Audit/Semantic inline secret in Analyze/Build nodes
    if (n.parameters && n.parameters.jsCode && n.parameters.jsCode.includes("if (got && got !== SECRET)")) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        /if \(got && got !== SECRET\) throw new Error\('Unauthorized'\);/,
        "if (!got || got !== SECRET) throw new Error('Unauthorized');",
      );
      changed++;
    }
  }
  if (changed) {
    await api('PUT', `/api/v1/workflows/${workflowId}`, {
      name: wf.name,
      nodes,
      connections: wf.connections || {},
      settings: wf.settings || {},
    });
  }
  console.log(label + ': secret hardened x' + changed);
}

async function main() {
  await fixVictim();
  await fixReset();
  for (const [key, label] of [
    ['break', 'break'],
    ['scan', 'scan'],
    ['state', 'state'],
    ['audit', 'audit'],
    ['semantic', 'semantic'],
  ]) {
    if (ids[key]) await hardenSecrets(ids[key], label);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
