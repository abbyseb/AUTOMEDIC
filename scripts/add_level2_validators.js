#!/usr/bin/env node
/**
 * Level 2: insert Validate Mapped Fields after Map to CRM Fields on Revenue Ops.
 * Fails hard when customerEmail does not look like an email (catches account_name misuse).
 */
const fs = require('fs');
const path = require('path');
const ROOT = require('path').join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const REV = fs.readFileSync(path.join(ROOT, 'revenue_ops_id.txt'), 'utf8').trim();
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
const amount = Number($json.dealAmount ?? $json.amount);
const emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
if (!emailOk) {
  throw new Error(
    "SHAPE_VIOLATION: customerEmail must look like an email. Got: " +
      JSON.stringify(email) +
      ". Prefer source keys: email_address, email. Input keys: " +
      Object.keys($json).join(', ')
  );
}
if (!(amount > 0)) {
  throw new Error('SHAPE_VIOLATION: dealAmount must be a positive number. Got: ' + String($json.dealAmount));
}
return { json: { ...$json, shapeValidated: true } };`;

async function main() {
  const wf = await api('GET', `/api/v1/workflows/${REV}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
  const connections = JSON.parse(JSON.stringify(wf.connections || {}));

  if (nodes.some((n) => n.name === 'Validate Mapped Fields')) {
    console.log('Validate Mapped Fields already present');
    return;
  }

  const map = nodes.find((n) => n.name === 'Map to CRM Fields');
  if (!map) throw new Error('Map to CRM Fields missing');
  const pos = map.position || [1568, 128];

  const validateNode = {
    id: 'validate_mapped_fields',
    name: 'Validate Mapped Fields',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [pos[0] + 220, pos[1]],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: validateCode,
    },
  };
  nodes.push(validateNode);

  // Map → Validate → Create CRM (was Map → Create CRM)
  connections['Map to CRM Fields'] = {
    main: [[{ node: 'Validate Mapped Fields', type: 'main', index: 0 }]],
  };
  connections['Validate Mapped Fields'] = {
    main: [[{ node: 'Create CRM Opportunity', type: 'main', index: 0 }]],
  };

  await api('PUT', `/api/v1/workflows/${REV}`, {
    name: wf.name,
    nodes,
    connections,
    settings: wf.settings || {},
  });
  try {
    await api('POST', `/api/v1/workflows/${REV}/activate`);
  } catch (_) {}
  console.log(JSON.stringify({ ok: true, added: 'Validate Mapped Fields' }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
