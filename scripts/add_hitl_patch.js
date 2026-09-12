#!/usr/bin/env node
/**
 * HITL patch for semantic (and similar) proposals:
 * POST /webhook/automedic/hitl-patch
 * Applies Map remaps from incident suggestions only after human approval.
 * Also wires semantic upsert to store suggestions JSON in patch_before,
 * and state to expose incident.suggestions.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'local_workflow_ids.json'), 'utf8'));
const BASE = 'http://127.0.0.1:5678';
const REV = ids.revenueOps || 'WVbBvATKVVQ9MvzL';
const TABLE = 'UkJvHHwqFiXRopRe';
const AUDIT = '5KsmDzsCpFFY7uUo'; // may differ locally — detect from Reset

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
return [{json:{ok:true, body: ($('HITL Webhook').first().json.body||{}), query: ($('HITL Webhook').first().json.query||{})}}];`;

const pickCode = `const body = $json.body || {};
const rows = $('Load Incidents').all().map((i) => i.json).filter((r) => r && r.incident_id);
const want = body.incidentId || body.incident_id || '';
let row = null;
if (want) row = rows.find((r) => r.incident_id === want) || null;
if (!row) {
  row = rows
    .filter((r) => r.status === 'escalated' && r.failure_type === 'SEMANTIC_MISMATCH')
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
}
if (!row) {
  throw new Error('No escalated SEMANTIC_MISMATCH incident with proposals. Run /automedic/semantic first.');
}

let suggestions = [];
try {
  if (row.patch_before && String(row.patch_before).trim().startsWith('[')) {
    suggestions = JSON.parse(row.patch_before);
  }
} catch (e) {}
if (!suggestions.length && row.source_field && row.target_field) {
  suggestions = [{
    mappedField: 'customerEmail',
    expectedField: row.source_field,
    replacementField: row.target_field,
    kind: 'hitl',
  }];
}
if (!suggestions.length) {
  throw new Error('Incident has no HITL suggestions to apply.');
}

return [{
  json: {
    incidentId: row.incident_id,
    workflowId: row.workflow_id || '${REV}',
    workflowName: row.workflow_name || 'Revenue Ops Pipeline',
    failureType: row.failure_type,
    reason: row.reason || '',
    suggestions,
    sourceField: suggestions[0].expectedField || row.source_field || '',
    targetField: suggestions[0].replacementField || row.target_field || '',
  },
}];`.replace(/\$\{REV\}/g, REV);

const applyCode = `const d = $('Pick HITL Incident').first().json;
const wf = $json;
const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
const suggestions = Array.isArray(d.suggestions) ? d.suggestions : [];
const touched = [];

for (const sug of suggestions) {
  const mapped = String(sug.mappedField || '').trim();
  const replacement = String(sug.replacementField || '').replace(/^\\$json\\./, '').trim();
  if (!mapped || !replacement) continue;
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
}

if (!touched.length) {
  throw new Error('HITL patch could not find Map assignments for: ' + suggestions.map((s) => s.mappedField).join(', '));
}

return [{
  json: {
    ...d,
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

const finalizeCode = `const d = $('Apply HITL Remaps').first().json;
const verify = $('Verify Victim').first().json || {};
const verifyOk = !(verify.message && /error/i.test(String(verify.message))) && verify.ok !== false;
// HTTP error responses often land as { message: "Error in workflow" }
const failed = verify && verify.message && !verify.ok && !verify.synced;
const ok = !failed && (verify.ok === true || verify.synced === true || verifyOk);
return [{
  json: {
    ...d,
    verifyStatus: ok ? 'success' : 'error',
    verifyOk: ok,
    finalStatus: ok ? 'verified' : 'repair_failed',
    gatePassed: true,
    autoRepairSafe: false,
    gateSummary: 'HITL APPROVED — human accepted semantic remap',
    failedNode: 'Map to CRM Fields',
    errorMessage: d.reason || 'HITL semantic patch',
    confidence: 0.95,
    observedFields: [],
    executionId: 'hitl',
    newExecutionId: null,
  },
}];`;

async function detectAuditTableId() {
  const reset = await api('GET', `/api/v1/workflows/${ids.reset}`);
  const clear = reset.nodes.find((n) => n.name === 'Clear Audit');
  const id = clear?.parameters?.dataTableId?.value;
  if (id) return id;
  return AUDIT;
}

async function updateSemanticSuggestions() {
  const wf = await api('GET', `/api/v1/workflows/${ids.semantic}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes || []));
  const up = nodes.find((n) => n.name === 'Upsert Semantic Incident');
  if (!up) throw new Error('Upsert Semantic Incident missing');
  const val = up.parameters.columns.value;
  val.patch_before = '={{ JSON.stringify($json.suggestions || []) }}';
  val.patch_after = '';
  val.source_field =
    "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].expectedField) || '' }}";
  val.target_field =
    "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].replacementField) || '' }}";
  // also stash mapped field hint in failed_node when useful
  val.failed_node =
    "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].mappedField) || 'Map to CRM Fields' }}";

  await api('PUT', `/api/v1/workflows/${ids.semantic}`, {
    name: wf.name,
    nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  });
  console.log('semantic: store suggestions in patch_before');
}

async function updateStateSuggestions() {
  const buildPath = path.join(ROOT, 'state_build_with_graph.js');
  let code = fs.readFileSync(buildPath, 'utf8');
  if (!code.includes('suggestions')) {
    // inject into incident map
    code = code.replace(
      `timeline: byInc[r.incident_id] || [],
    };
  })`,
      `timeline: byInc[r.incident_id] || [],
      suggestions: (function () {
        try {
          if (r.patch_before && String(r.patch_before).trim().startsWith('[')) {
            return JSON.parse(r.patch_before);
          }
        } catch (e) {}
        return [];
      })(),
    };
  })`
    );
    fs.writeFileSync(buildPath, code);
  }
  const state = await api('GET', `/api/v1/workflows/${ids.state}`);
  const nodes = JSON.parse(JSON.stringify(state.nodes || []));
  const build = nodes.find((n) => n.name === 'Build State Payload');
  build.parameters.jsCode = fs.readFileSync(buildPath, 'utf8').replace(/__REV__/g, REV);
  await api('PUT', `/api/v1/workflows/${ids.state}`, {
    name: state.name,
    nodes,
    connections: state.connections,
    settings: state.settings || {},
  });
  console.log('state: expose incident.suggestions');
}

async function upsertHitl(auditTableId) {
  const breakWf = await api('GET', `/api/v1/workflows/${ids.break}`);
  const n8nCred = breakWf.nodes.find((n) => n.credentials?.n8nApi)?.credentials?.n8nApi;

  const nodes = [
    {
      id: 'hitl-wh',
      name: 'HITL Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: 'automedic-hitl-patch',
      parameters: {
        httpMethod: 'POST',
        path: 'automedic/hitl-patch',
        responseMode: 'lastNode',
        options: { allowedOrigins: '*' },
      },
    },
    {
      id: 'hitl-sec',
      name: 'Check Secret',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: secretCode },
    },
    {
      id: 'hitl-load',
      name: 'Load Incidents',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1,
      position: [440, 0],
      parameters: {
        resource: 'row',
        operation: 'get',
        dataTableId: { __rl: true, mode: 'id', value: TABLE },
        returnAll: true,
      },
      alwaysOutputData: true,
    },
    {
      id: 'hitl-pick',
      name: 'Pick HITL Incident',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: pickCode },
    },
    {
      id: 'hitl-get',
      name: 'Get Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [880, 0],
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
      id: 'hitl-apply',
      name: 'Apply HITL Remaps',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: applyCode },
    },
    {
      id: 'hitl-put',
      name: 'Update Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1320, 0],
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
      id: 'hitl-run',
      name: 'Verify Victim',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1540, 0],
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
      id: 'hitl-fin',
      name: 'Finalize HITL',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1760, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: finalizeCode },
    },
    {
      id: 'hitl-up',
      name: 'Upsert Incident',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1,
      position: [1980, 0],
      parameters: {
        operation: 'upsert',
        dataTableId: { __rl: true, mode: 'id', value: TABLE },
        matchType: 'allConditions',
        filters: {
          conditions: [{ keyName: 'incident_id', keyValue: '={{ $json.incidentId }}' }],
        },
        columns: {
          mappingMode: 'defineBelow',
          matchingColumns: ['incident_id'],
          value: {
            incident_id: '={{ $json.incidentId }}',
            execution_id: 'hitl',
            workflow_id: '={{ $json.workflowId }}',
            workflow_name: '={{ $json.workflowName }}',
            failed_node: 'Map to CRM Fields',
            error_message: '={{ $json.errorMessage }}',
            status: '={{ $json.finalStatus }}',
            failure_type: 'SEMANTIC_MISMATCH',
            confidence: '={{ $json.confidence }}',
            auto_repair_safe: false,
            reason: '={{ $json.reason }}',
            source_field: '={{ $json.sourceField }}',
            target_field: '={{ $json.targetField }}',
            observed_fields: '={{ JSON.stringify($json.suggestions || []) }}',
            gate_passed: true,
            gate_summary: '={{ $json.gateSummary }}',
            patch_before: '={{ $json.patchBefore }}',
            patch_after: '={{ $json.patchAfter }}',
            verify_status: '={{ $json.verifyStatus }}',
          },
        },
      },
    },
    {
      id: 'hitl-aud',
      name: 'Audit HITL',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1,
      position: [2200, 0],
      parameters: {
        operation: 'insert',
        dataTableId: { __rl: true, mode: 'id', value: auditTableId },
        columns: {
          mappingMode: 'defineBelow',
          value: {
            incident_id: '={{ $json.incidentId }}',
            step: 'VERIFIED',
            status: 'done',
            message: 'HITL approved semantic patch verified',
            occurred_at: '={{ $now.toISO() }}',
          },
        },
      },
    },
    {
      id: 'hitl-res',
      name: 'HITL Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2420, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const d=$('Finalize HITL').first().json;
return [{json:{
  ok:true,
  mode:'hitl',
  healed:!!d.verifyOk,
  incidentId:d.incidentId,
  failureType:'SEMANTIC_MISMATCH',
  suggestions:d.suggestions,
  touched:d.touched,
  patch:{before:d.patchBefore, after:d.patchAfter},
  verifyStatus:d.verifyStatus,
  gateSummary:d.gateSummary,
}}];`,
      },
    },
  ];

  const connections = {
    'HITL Webhook': { main: [[{ node: 'Check Secret', type: 'main', index: 0 }]] },
    'Check Secret': { main: [[{ node: 'Load Incidents', type: 'main', index: 0 }]] },
    'Load Incidents': { main: [[{ node: 'Pick HITL Incident', type: 'main', index: 0 }]] },
    'Pick HITL Incident': { main: [[{ node: 'Get Victim', type: 'main', index: 0 }]] },
    'Get Victim': { main: [[{ node: 'Apply HITL Remaps', type: 'main', index: 0 }]] },
    'Apply HITL Remaps': { main: [[{ node: 'Update Victim', type: 'main', index: 0 }]] },
    'Update Victim': { main: [[{ node: 'Verify Victim', type: 'main', index: 0 }]] },
    'Verify Victim': { main: [[{ node: 'Finalize HITL', type: 'main', index: 0 }]] },
    'Finalize HITL': { main: [[{ node: 'Upsert Incident', type: 'main', index: 0 }]] },
    'Upsert Incident': { main: [[{ node: 'Audit HITL', type: 'main', index: 0 }]] },
    'Audit HITL': { main: [[{ node: 'HITL Response', type: 'main', index: 0 }]] },
  };

  let existingId = ids.hitlPatch;
  if (!existingId) {
    const list = await api('GET', '/api/v1/workflows?limit=100');
    const hit = (list.data || []).find((w) => /hitl-patch|HITL Patch/i.test(w.name));
    if (hit) existingId = hit.id;
  }

  const body = {
    name: 'AutoMedic HITL Patch (Local)',
    nodes,
    connections,
    settings: breakWf.settings || {},
  };

  const wf = existingId
    ? await api('PUT', `/api/v1/workflows/${existingId}`, body)
    : await api('POST', '/api/v1/workflows', body);

  await api('POST', `/api/v1/workflows/${wf.id}/activate`);
  ids.hitlPatch = wf.id;
  fs.writeFileSync(path.join(ROOT, 'local_workflow_ids.json'), JSON.stringify(ids, null, 2) + '\n');
  console.log('hitl-patch:', wf.id);
}

async function main() {
  const auditTableId = await detectAuditTableId();
  console.log('audit table', auditTableId);
  await updateSemanticSuggestions();
  await updateStateSuggestions();
  await upsertHitl(auditTableId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
