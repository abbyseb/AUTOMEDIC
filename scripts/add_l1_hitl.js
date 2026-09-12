#!/usr/bin/env node
/**
 * L1 HITL: Audit stores remap proposals; HITL patch applies dangling→closest;
 * POST /automedic/hitl-ignore suppresses an escalated incident.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'local_workflow_ids.json'), 'utf8'));
const BASE = 'http://127.0.0.1:5678';
const TABLE = 'UkJvHHwqFiXRopRe';
const REV = ids.revenueOps || 'WVbBvATKVVQ9MvzL';

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

const analyzeCode = `const SECRET = 'automedic-demo-secret';
const h = $('Audit Webhook').first().json.headers || {};
const got = h['x-automedic-secret'] || h['X-AutoMedic-Secret'] || '';
if (!got || got !== SECRET) throw new Error('Unauthorized');

const wf = $json || {};
const known = new Set();
for (const n of wf.nodes || []) {
  const assigns = n.parameters && n.parameters.assignments && n.parameters.assignments.assignments;
  if (Array.isArray(assigns)) for (const a of assigns) if (a && a.name) known.add(String(a.name));
}
for (const k of [
  'validated','is_b2b','crmOpportunityId','crmSynced','commission','commission_rate','currency_upper',
  'notify_text','ledger_line','ledger_status','shapeValidated','ok','synced','amount','dealAmount',
  'account_key','tier','pipeline','owner_team','net_terms_days','email_address','account_name',
  'amount_cents','sku','segment','currency','event_id','region','notify_channel'
]) known.add(k);

function scorePair(broken, candidate) {
  const a = String(broken).toLowerCase();
  const b = String(candidate).toLowerCase();
  let score = 0;
  if (a.includes(b) || b.includes(a)) score += 6;
  if (a.replace(/_/g, '') === b.replace(/_/g, '')) score += 4;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  score += Math.min(i, 8);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let x = 0; x <= n; x++) dp[x][0] = x;
  for (let y = 0; y <= m; y++) dp[0][y] = y;
  for (let x = 1; x <= n; x++) {
    for (let y = 1; y <= m; y++) {
      const cost = a[x - 1] === b[y - 1] ? 0 : 1;
      dp[x][y] = Math.min(dp[x - 1][y] + 1, dp[x][y - 1] + 1, dp[x - 1][y - 1] + cost);
    }
  }
  const dist = dp[n][m];
  const maxLen = Math.max(n, m) || 1;
  if (dist === 1) score += 8;
  else if (dist === 2) score += 5;
  else if (dist / maxLen <= 0.25) score += 4;
  return score;
}

const refs = new Set();
const blob = JSON.stringify(wf.nodes || []);
for (const m of blob.matchAll(/\\$json\\.([A-Za-z0-9_]+)/g)) refs.add(m[1]);
for (const skip of ['Number','String','Boolean','Object','Array','Math','JSON','Date']) refs.delete(skip);
const danglingRefs = [...refs].filter((r) => !known.has(r));

const knownList = [...known];
const suggestions = [];
for (const d of danglingRefs) {
  const scored = knownList
    .filter((k) => k !== d)
    .map((k) => ({ k, score: scorePair(d, k) }))
    .sort((x, y) => y.score - x.score);
  if (scored[0] && scored[0].score >= 5) {
    suggestions.push({
      mappedField: 'expression',
      expectedField: d,
      replacementField: scored[0].k,
      kind: 'silent_drift',
    });
  }
}

return [{ json: {
  workflowId: String(wf.id),
  workflowName: wf.name,
  danglingRefs,
  expressionRefs: [...refs],
  observedFields: [...known],
  suggestions,
  incidentId: 'inc_audit_' + String(wf.id) + '_' + Date.now(),
  status: danglingRefs.length ? 'escalated' : 'clean',
  failureType: danglingRefs.length ? 'SILENT_DRIFT' : null,
  reason: danglingRefs.length
    ? ('Workflow is publishable/green-capable but references missing keys: ' + danglingRefs.map((d) => '$json.' + d).join(', ') + '. No auto-patch — awaiting approval.')
    : 'No dangling refs vs declared assignment/output keys.',
  autoRepairSafe: false,
}}];`;

const pickCode = `const body = $json.body || {};
const rows = $('Load Incidents').all().map((i) => i.json).filter((r) => r && r.incident_id);
const want = body.incidentId || body.incident_id || '';
const action = String(body.action || 'patch').toLowerCase();
let row = null;
if (want) row = rows.find((r) => r.incident_id === want) || null;
if (!row) {
  row = rows
    .filter((r) => r.status === 'escalated' && ['SEMANTIC_MISMATCH', 'SILENT_DRIFT'].includes(r.failure_type))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
}
if (!row) {
  throw new Error('No escalated SEMANTIC_MISMATCH / SILENT_DRIFT incident. Run L1 audit or L3 semantic first.');
}

let suggestions = [];
try {
  if (row.patch_before && String(row.patch_before).trim().startsWith('[')) {
    suggestions = JSON.parse(row.patch_before);
  }
} catch (e) {}
if (!suggestions.length && row.source_field && row.target_field) {
  suggestions = [{
    mappedField: row.failure_type === 'SILENT_DRIFT' ? 'expression' : 'customerEmail',
    expectedField: row.source_field,
    replacementField: row.target_field,
    kind: row.failure_type === 'SILENT_DRIFT' ? 'silent_drift' : 'hitl',
  }];
}
if (action !== 'ignore' && !suggestions.length) {
  throw new Error('Incident has no HITL suggestions to apply.');
}

return [{
  json: {
    action,
    incidentId: row.incident_id,
    workflowId: row.workflow_id || '${REV}',
    workflowName: row.workflow_name || 'Revenue Ops Pipeline',
    failureType: row.failure_type,
    reason: row.reason || '',
    suggestions,
    sourceField: (suggestions[0] && suggestions[0].expectedField) || row.source_field || '',
    targetField: (suggestions[0] && suggestions[0].replacementField) || row.target_field || '',
  },
}];`.replace(/\$\{REV\}/g, REV);

const applyCode = `const d = $('Pick HITL Incident').first().json;
if (d.action === 'ignore') {
  return [{
    json: {
      ...d,
      skipMutate: true,
      touched: [],
      patchBefore: '',
      patchAfter: '',
      updateBody: null,
      workflowId: d.workflowId,
    },
  }];
}

const wf = $json;
const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
const suggestions = Array.isArray(d.suggestions) ? d.suggestions : [];
const touched = [];

for (const sug of suggestions) {
  const expected = String(sug.expectedField || '').replace(/^\\$json\\./, '').trim();
  const replacement = String(sug.replacementField || '').replace(/^\\$json\\./, '').trim();
  const mapped = String(sug.mappedField || '').trim();
  if (!expected || !replacement || expected === replacement) continue;

  // Semantic: remap a Map assignment by CRM field name
  if (mapped && mapped !== 'expression') {
    for (const n of nodes) {
      if (n.name !== 'Map to CRM Fields') continue;
      const assigns = n.parameters && n.parameters.assignments && n.parameters.assignments.assignments;
      if (!Array.isArray(assigns)) continue;
      for (const a of assigns) {
        if (a.name !== mapped) continue;
        const before = a.value;
        a.value = '={{ $json.' + replacement + ' }}';
        touched.push({ mappedField: mapped, before, after: a.value, replacementField: replacement });
      }
    }
    continue;
  }

  // Silent drift: replace $json.expected → $json.replacement anywhere in the graph
  const esc = expected.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const reDot = new RegExp('\\\\$json\\\\.' + esc + '(?![A-Za-z0-9_])', 'g');
  const reBracket = new RegExp('\\\\$json\\\\[[\\'\"]' + esc + '[\\'\"]\\]', 'g');
  for (const n of nodes) {
    const before = JSON.stringify(n.parameters || {});
    let s = before.replace(reDot, '$json.' + replacement).replace(reBracket, '$json.' + replacement);
    if (s !== before) {
      n.parameters = JSON.parse(s);
      touched.push({
        mappedField: n.name,
        before: '{{$json.' + expected + '}}',
        after: '{{$json.' + replacement + '}}',
        replacementField: replacement,
      });
    }
  }
}

if (!touched.length) {
  throw new Error('HITL patch could not apply suggestions: ' + JSON.stringify(suggestions));
}

return [{
  json: {
    ...d,
    skipMutate: false,
    workflowId: String(wf.id || d.workflowId),
    touched,
    patchBefore: touched.map((t) => t.before).join(' | '),
    patchAfter: touched.map((t) => t.after).join(' | '),
    updateBody: {
      name: wf.name,
      nodes,
      connections: wf.connections || {},
      settings: wf.settings || {},
    },
  },
}];`;

async function updateAudit() {
  const wf = await api('GET', `/api/v1/workflows/${ids.audit}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const an = nodes.find((n) => n.name === 'Analyze Dangling');
  an.parameters.jsCode = analyzeCode;
  const up = nodes.find((n) => /Upsert/i.test(n.name));
  if (up?.parameters?.columns?.value) {
    const v = up.parameters.columns.value;
    v.patch_before = '={{ JSON.stringify($json.suggestions || []) }}';
    v.patch_after = '';
    v.source_field =
      "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].expectedField) || ($json.danglingRefs || [])[0] || '' }}";
    v.target_field =
      "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].replacementField) || '' }}";
    v.gate_summary = 'LEVEL1 SILENT_DRIFT — awaiting HITL patch or ignore';
  }
  await api('PUT', `/api/v1/workflows/${wf.id}`, {
    name: wf.name,
    nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  });
  console.log('audit: suggestions + HITL copy');
}

async function updateHitl() {
  const wf = await api('GET', `/api/v1/workflows/${ids.hitlPatch}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const connections = JSON.parse(JSON.stringify(wf.connections));

  const pick = nodes.find((n) => n.name === 'Pick HITL Incident');
  pick.parameters.jsCode = pickCode;
  const apply = nodes.find((n) => n.name === 'Apply HITL Remaps');
  apply.parameters.jsCode = applyCode;

  // After Apply: if skipMutate, jump to Finalize via IF
  // Simpler: Update Victim continueOnFail and use empty body skip — better IF

  let ifNode = nodes.find((n) => n.name === 'Should Mutate?');
  if (!ifNode) {
    ifNode = {
      id: 'hitl-if-mut',
      name: 'Should Mutate?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1200, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.skipMutate }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
    };
    nodes.push(ifNode);
  }

  // Finalize must handle ignore
  const fin = nodes.find((n) => n.name === 'Finalize HITL');
  fin.parameters.jsCode = `const d = $('Apply HITL Remaps').first().json;
if (d.action === 'ignore' || d.skipMutate) {
  return [{
    json: {
      ...d,
      verifyStatus: 'skipped',
      verifyOk: true,
      finalStatus: 'suppressed',
      gatePassed: false,
      autoRepairSafe: false,
      gateSummary: 'HITL IGNORED — no workflow mutation',
      failedNode: d.failureType === 'SILENT_DRIFT' ? 'graph-audit' : 'Map to CRM Fields',
      errorMessage: d.reason || 'HITL ignore',
      confidence: 0.9,
      observedFields: [],
      executionId: 'hitl',
      newExecutionId: null,
    },
  }];
}
const verify = $('Verify Victim').first().json || {};
const failed = verify && verify.message && !verify.ok && !verify.synced;
const ok = !failed && (verify.ok === true || verify.synced === true);
let newExecutionId = null;
try {
  const list = ($('Get Verify Exec').first().json.data) || [];
  if (list[0] && list[0].id) newExecutionId = String(list[0].id);
} catch (e) {}
const execOk = (() => { try { return String(($('Get Verify Exec').first().json.data||[])[0]?.status||'') === 'success'; } catch(e){ return false; }})();
const healed = ok || execOk;
return [{
  json: {
    ...d,
    verifyStatus: healed ? 'success' : 'error',
    verifyOk: healed,
    finalStatus: healed ? 'verified' : 'repair_failed',
    gatePassed: true,
    autoRepairSafe: false,
    gateSummary: 'HITL APPROVED — human accepted remap',
    failedNode: d.failureType === 'SILENT_DRIFT' ? 'graph-audit' : 'Map to CRM Fields',
    errorMessage: d.reason || 'HITL patch',
    confidence: 0.95,
    observedFields: [],
    executionId: 'hitl',
    newExecutionId,
  },
}];`;

  const up = nodes.find((n) => n.name === 'Upsert Incident');
  if (up?.parameters?.columns?.value) {
    up.parameters.columns.value.failure_type = '={{ $json.failureType }}';
    up.parameters.columns.value.new_execution_id = '={{ $json.newExecutionId }}';
  }

  // Rewire: Apply → Should Mutate?
  // true (skip) → Finalize HITL
  // false → Update Victim → Verify → Get Verify Exec → Finalize
  connections['Apply HITL Remaps'] = { main: [[{ node: 'Should Mutate?', type: 'main', index: 0 }]] };
  connections['Should Mutate?'] = {
    main: [
      [{ node: 'Finalize HITL', type: 'main', index: 0 }],
      [{ node: 'Update Victim', type: 'main', index: 0 }],
    ],
  };

  await api('PUT', `/api/v1/workflows/${wf.id}`, {
    name: wf.name,
    nodes,
    connections,
    settings: wf.settings || {},
  });
  console.log('hitl: L1+L3 patch/ignore');
}

async function main() {
  await updateAudit();
  await updateHitl();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
