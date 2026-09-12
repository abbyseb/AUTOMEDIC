#!/usr/bin/env node
/**
 * Level 3: AutoMedic Semantic — role/shape critic.
 * Compares mapped field VALUES to declared roles in field-roles.json.
 * LLM explains; deterministic gate decides escalate vs propose preferredSources remap.
 * POST /webhook/automedic/semantic — does NOT auto-PATCH (propose only) unless SEMANTIC_AUTOPATCH=1 and shape+preferredSources agree.
 */
const fs = require('fs');
const path = require('path');
const ROOT = require('path').join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const CRED = fs.readFileSync(path.join(ROOT, 'n8n_cred_id.txt'), 'utf8').trim();
const HDR = fs.readFileSync(path.join(ROOT, 'openai_header_cred_id.txt'), 'utf8').trim();
const INC = fs.readFileSync(path.join(ROOT, 'incidents_table_id.txt'), 'utf8').trim();
const REV = fs.readFileSync(path.join(ROOT, 'revenue_ops_id.txt'), 'utf8').trim();
const ROLES = JSON.parse(
  fs.readFileSync(path.join(ROOT, '..', 'contracts', 'field-roles.json'), 'utf8'),
);
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
const hdrCred = { httpHeaderAuth: { id: HDR, name: 'OpenAI Bearer' } };
const roleJson = JSON.stringify(ROLES.workflows['revenue-ops']);

async function main() {
  const buildCtx = `
const SECRET = 'automedic-demo-secret';
const h = $('Semantic Webhook').first().json.headers || {};
const got = h['x-automedic-secret'] || h['X-AutoMedic-Secret'] || '';
if (!got || got !== SECRET) throw new Error('Unauthorized');

const roles = ${roleJson};
const item = $json || {};
const violations = [];

function shapeOk(shape, value, enumValues) {
  if (shape === 'email') return typeof value === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
  if (shape === 'positive_number') return Number(value) > 0;
  if (shape === 'nonempty_string') return typeof value === 'string' && value.trim().length > 0;
  if (shape === 'enum') return enumValues && enumValues.includes(value);
  return true;
}

for (const role of roles.roles || []) {
  const val = item[role.mappedField];
  if (role.required && (val === undefined || val === null || val === '')) {
    violations.push({ mappedField: role.mappedField, role: role.role, kind: 'missing', value: val, preferredSources: role.preferredSources });
    continue;
  }
  if (val !== undefined && val !== null && val !== '' && !shapeOk(role.shape, val, role.enumValues)) {
    // Find which preferred source might have been wrongly used as the value
    let suspectedSource = null;
    for (const src of role.preferredSources || []) {
      /* value equals some other field? */
    }
    for (const [k, v] of Object.entries(item)) {
      if (k === role.mappedField) continue;
      if (v === val && typeof v === 'string') { suspectedSource = k; break; }
    }
    violations.push({
      mappedField: role.mappedField,
      role: role.role,
      kind: 'shape_mismatch',
      value: val,
      preferredSources: role.preferredSources,
      suspectedSource,
    });
  }
}

return [{ json: {
  workflowId: '${REV}',
  workflowName: 'Revenue Ops Pipeline',
  violations,
  sample: item,
  incidentId: 'inc_sem_' + Date.now(),
  hasViolations: violations.length > 0,
}}];
`.trim();

  const prepLlm = `
const ctx = $json;
const system = 'You are a data-contract reviewer for n8n. Given role violations, explain semantic misuse in one short paragraph. Return ONLY JSON: { reason, suggestedRemaps: [{ mappedField, fromExpressionHint, toSourceField }], autoRepairSafe:boolean }. autoRepairSafe true ONLY if every violation has a preferredSources field present on sample with correct shape.';
return [{ json: {
  ...ctx,
  openaiBody: {
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ violations: ctx.violations, sampleKeys: Object.keys(ctx.sample||{}), sample: ctx.sample }, null, 2) },
    ],
  },
}}];
`.trim();

  const gateCode = `
const ctx = $('Prepare Semantic LLM').first().json;
let ai = {};
try {
  const content = $json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content;
  ai = typeof content === 'string' ? JSON.parse(content) : (content || {});
} catch (e) { ai = {}; }

const violations = ctx.violations || [];
const sample = ctx.sample || {};
const suggestions = [];
for (const v of violations) {
  const prefs = v.preferredSources || [];
  let chosen = null;
  for (const p of prefs) {
    const val = sample[p];
    if (v.role === 'email' || v.mappedField === 'customerEmail') {
      if (typeof val === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val)) { chosen = p; break; }
    } else if (val !== undefined && val !== null && val !== '') {
      chosen = p; break;
    }
  }
  if (chosen) {
    suggestions.push({
      mappedField: v.mappedField,
      expectedField: v.suspectedSource || 'unknown_source_expr',
      replacementField: chosen,
      kind: v.kind,
    });
  }
}

const canPropose = suggestions.length > 0;
return [{ json: {
  ...ctx,
  failureType: 'SEMANTIC_MISMATCH',
  reason: ai.reason || (violations[0] && ('Semantic/shape violation on ' + violations[0].mappedField)) || 'semantic check',
  suggestions,
  autoRepairSafe: false,
  gatePassed: false,
  escalate: true,
  aiRaw: ai,
  status: canPropose ? 'escalated' : 'escalated',
  summary: canPropose
    ? ('GATE REFUSED AUTO-PATCH — semantic proposals ready: ' + suggestions.map((s) => s.mappedField + '→' + s.replacementField).join(', '))
    : 'GATE REFUSED — semantic/shape violations without safe preferredSources',
}}];
`.trim();

  const nodes = [
    {
      id: 'wh',
      name: 'Semantic Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, 0],
      webhookId: 'automedic-semantic',
      parameters: {
        httpMethod: 'POST',
        path: 'automedic/semantic',
        responseMode: 'lastNode',
        options: { allowedOrigins: '*' },
      },
    },
    {
      id: 'execs',
      name: 'Get Recent Success',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [220, 0],
      credentials: n8nCred,
      parameters: {
        method: 'GET',
        url: 'http://localhost:5678/api/v1/executions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'n8nApi',
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'includeData', value: 'true' },
            { name: 'limit', value: '15' },
          ],
        },
        options: {},
      },
    },
    {
      id: 'pick',
      name: 'Pick Latest Item',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const resp = $json || {};
const execs = Array.isArray(resp.data) ? resp.data : [];
const mine = execs.filter((e) => String(e.workflowId) === '${REV}');
for (const e of mine) {
  const rd = (e.data && e.data.resultData && e.data.resultData.runData) || {};
  for (const name of ['Map to CRM Fields', 'Validate Mapped Fields', 'Finalize Success', 'Create CRM Opportunity']) {
    const runs = rd[name];
    const item = runs && runs[0] && runs[0].data && runs[0].data.main && runs[0].data.main[0] && runs[0].data.main[0][0] && runs[0].data.main[0][0].json;
    if (item && item.customerEmail !== undefined) return [{ json: { ...item, _fromExec: String(e.id), _execStatus: e.status } }];
  }
}
return [{ json: { _empty: true } }];
`.trim(),
      },
    },
    {
      id: 'ctx',
      name: 'Build Role Context',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: buildCtx },
    },
    {
      id: 'has',
      name: 'Has Violations?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [880, 0],
      parameters: {
        conditions: {
          combinator: 'and',
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.hasViolations }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
        },
      },
    },
    {
      id: 'prep',
      name: 'Prepare Semantic LLM',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, -100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: prepLlm },
    },
    {
      id: 'ai',
      name: 'OpenAI Semantic',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [1320, -100],
      credentials: hdrCred,
      parameters: {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ $json.openaiBody }}',
        options: {},
      },
    },
    {
      id: 'gate',
      name: 'Semantic Gate',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1540, -100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: gateCode },
    },
    {
      id: 'up',
      name: 'Upsert Semantic Incident',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1,
      position: [1760, -100],
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
            execution_id: 'semantic',
            workflow_id: '={{ $json.workflowId }}',
            workflow_name: '={{ $json.workflowName }}',
            failed_node: 'semantic-critic',
            error_message: '={{ $json.reason }}',
            status: 'escalated',
            failure_type: 'SEMANTIC_MISMATCH',
            confidence: 0.85,
            auto_repair_safe: false,
            reason: '={{ $json.reason }}',
            source_field: "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].expectedField) || '' }}",
            target_field: "={{ ($json.suggestions && $json.suggestions[0] && $json.suggestions[0].replacementField) || '' }}",
            observed_fields: '={{ JSON.stringify(Object.keys($json.sample||{})) }}',
            gate_passed: false,
            gate_summary: '={{ $json.summary }}',
          },
        },
      },
    },
    {
      id: 'out',
      name: 'Semantic Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1980, -100],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const d=$('Semantic Gate').first().json; return [{json:{ok:true,level:3,mode:'semantic',escalated:true,healed:false,incidentId:d.incidentId,failureType:d.failureType,reason:d.reason,suggestions:d.suggestions,gateSummary:d.summary,autoRepairSafe:false}}];`,
      },
    },
    {
      id: 'clean',
      name: 'Clean Semantic Response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, 120],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `return [{json:{ok:true,level:3,mode:'semantic',escalated:false,violations:[],reason:'No role/shape violations on latest success sample.'}}];`,
      },
    },
  ];

  const connections = {
    'Semantic Webhook': { main: [[{ node: 'Get Recent Success', type: 'main', index: 0 }]] },
    'Get Recent Success': { main: [[{ node: 'Pick Latest Item', type: 'main', index: 0 }]] },
    'Pick Latest Item': { main: [[{ node: 'Build Role Context', type: 'main', index: 0 }]] },
    'Build Role Context': { main: [[{ node: 'Has Violations?', type: 'main', index: 0 }]] },
    'Has Violations?': {
      main: [
        [{ node: 'Prepare Semantic LLM', type: 'main', index: 0 }],
        [{ node: 'Clean Semantic Response', type: 'main', index: 0 }],
      ],
    },
    'Prepare Semantic LLM': { main: [[{ node: 'OpenAI Semantic', type: 'main', index: 0 }]] },
    'OpenAI Semantic': { main: [[{ node: 'Semantic Gate', type: 'main', index: 0 }]] },
    'Semantic Gate': { main: [[{ node: 'Upsert Semantic Incident', type: 'main', index: 0 }]] },
    'Upsert Semantic Incident': { main: [[{ node: 'Semantic Response', type: 'main', index: 0 }]] },
  };

  const list = await api('GET', '/api/v1/workflows?limit=50');
  const existing = (list.data || []).find((w) => w.name === 'AutoMedic Semantic (Level 3)');
  let id;
  const body = {
    name: 'AutoMedic Semantic (Level 3)',
    nodes,
    connections,
    settings: {},
  };
  if (existing) {
    await api('PUT', `/api/v1/workflows/${existing.id}`, body);
    id = existing.id;
  } else {
    const created = await api('POST', '/api/v1/workflows', body);
    id = created.id;
  }
  await api('POST', `/api/v1/workflows/${id}/activate`);
  const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
  ids.semantic = id;
  fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, semantic: id }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
