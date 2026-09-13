#!/usr/bin/env node
/**
 * P0 demo fixes (Opus bug hunt):
 * 1. Stale error vs restored graph → no self-remap HITL; discard pre-updateAt errors
 * 2. L3 Semantic Get Recent Success filters by Revenue Ops workflowId
 * 3. Reset restores Is B2B? to literal healthy $json.is_b2b
 *
 * Usage: node scripts/fix_p0_demo_bugs.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '.local');
const KEY = fs.readFileSync(path.join(ROOT, 'n8n_api_key.txt'), 'utf8').trim();
const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'local_workflow_ids.json'), 'utf8'));
const BASE = 'http://127.0.0.1:5678';
const REV = ids.revenueOps;

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 900)}`);
  return json;
}

async function putWf(wf, nodes) {
  await api('PUT', `/api/v1/workflows/${wf.id}`, {
    name: wf.name,
    nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  });
}

async function fixScan() {
  const wf = await api('GET', `/api/v1/workflows/${ids.scan}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const by = Object.fromEntries(nodes.map((n) => [n.name, n]));

  for (const name of ['Has Failure?', 'Has Graph Work?']) {
    const n = by[name];
    if (!n) continue;
    const cond = n.parameters?.conditions?.conditions?.[0];
    if (cond) {
      cond.leftValue = '={{ $json.executionId }}';
      cond.operator = { type: 'string', operation: 'notEmpty', singleValue: true };
    }
  }

  // Tighten lookback + keep stoppedAtMs for stale compare
  let extract = by['Extract Failure Context'].parameters.jsCode;
  extract = extract.replace(
    /const LOOKBACK_MS = 10 \* 60 \* 1000;/,
    'const LOOKBACK_MS = 2 * 60 * 1000;',
  );
  by['Extract Failure Context'].parameters.jsCode = extract;

  // Enrich: stale AUTH + stale vs workflow.updatedAt
  let enrich = by['Enrich Dangling Refs'].parameters.jsCode;
  if (!enrich.includes('Stale failure vs restored graph')) {
    const marker = 'const known = new Set((ctx.observedFields || []).map(String));';
    if (!enrich.includes(marker)) throw new Error('Enrich marker missing');
    const staleBlock = `
// Stale failure vs restored graph: error stopped before last workflow save → re-probe
const wfUpdatedMs = Date.parse(wf.updatedAt || '') || 0;
const stoppedMs = Number(ctx.stoppedAtMs || 0);
if (!ctx.probe && wfUpdatedMs && stoppedMs && stoppedMs < wfUpdatedMs) {
  ctx.probe = true;
  ctx.executionId = 'graph';
  ctx.failedNode = '';
  ctx.errorMessage = 'Graph probe: prior failure is older than last workflow save (stale evidence).';
  ctx.errorDescription = '';
  ctx.incidentId = 'inc_graph_' + Date.now();
  ctx.availableData = {};
  ctx.staleEvidence = true;
}

${marker}`;
    enrich = enrich.replace(marker, staleBlock.trim());
  }
  by['Enrich Dangling Refs'].parameters.jsCode = enrich;

  // Gate: shape HITL from Got-matching source; never self-remap
  let gate = by['Evidence Gate'].parameters.jsCode;
  if (!gate.includes('sourceKeyForGotValue')) {
    const insertAfter = 'function mapSourceForField(victimWorkflow, mappedField) {';
    const idx = gate.indexOf(insertAfter);
    if (idx < 0) throw new Error('mapSourceForField missing');
    // find end of mapSourceForField function
    const afterFn = gate.indexOf('\nconst observed =', idx);
    const helper = `
function sourceKeyForGotValue(gotRaw, availableData) {
  const want = String(gotRaw);
  if (!want) return '';
  for (const item of Object.values(availableData || {})) {
    if (!item || typeof item !== 'object') continue;
    for (const [k, v] of Object.entries(item)) {
      if (String(v) === want) return String(k);
    }
  }
  return '';
}

`;
    gate = gate.slice(0, afterFn) + helper + gate.slice(afterFn);
  }

  // Replace shape else-branch suggestion logic: use Got source; skip self-remap
  const badElse = `  } else {
    failureType = 'SEMANTIC_MISMATCH';
    autoRepairSafe = false;
    reason =
      'Shape gate blocked poison data: ' +
      mappedField +
      ' received ' +
      JSON.stringify(String(gotRaw)) +
      ' which is not a valid shape. Map currently reads $json.' +
      (expected || '?') +
      '; prefer $json.' +
      (replacement || prefer[0] || 'email_address') +
      '. AutoMedic will not auto-patch semantics — awaiting HITL.';
    if (mappedField && replacement) {
      suggestions.push({
        mappedField,
        expectedField: expected || currentSource || mappedField,
        replacementField: replacement,
        kind: 'shape_mismatch',
      });
    }
  }
}`;

  const goodElse = `  } else {
    failureType = 'SEMANTIC_MISMATCH';
    autoRepairSafe = false;
    const fromGot = bare(sourceKeyForGotValue(gotRaw, ctx.availableData));
    // Prefer the payload key that produced the poison value; fall back to live Map source only if distinct
    if (fromGot && fromGot !== replacement) expected = fromGot;
    else if (currentSource && currentSource !== replacement) expected = bare(currentSource);
    expected = bare(expected);
    replacement = bare(replacement);
    const actionable = !!mappedField && !!expected && !!replacement && expected !== replacement;
    reason =
      'Shape gate blocked poison data: ' +
      mappedField +
      ' received ' +
      JSON.stringify(String(gotRaw)) +
      ' which is not a valid shape. ' +
      (actionable
        ? ('Suspect source $json.' + expected + '; prefer $json.' + replacement + '. Awaiting HITL.')
        : ('Live Map already reads preferred $json.' +
            (replacement || currentSource || '?') +
            ' — likely stale failure evidence; re-plant L2 or ignore.'));
    if (actionable) {
      suggestions.push({
        mappedField,
        expectedField: expected,
        replacementField: replacement,
        kind: 'shape_mismatch',
      });
    }
  }
}`;

  if (gate.includes(badElse)) {
    gate = gate.replace(badElse, goodElse);
  } else if (!gate.includes('sourceKeyForGotValue(gotRaw')) {
    // already partially patched or different formatting — try looser replace of suggestions.push in shape else
    console.warn('shape else block exact match missed; gate may already be patched');
  }

  // Also fix empty-path expected: when gotEmpty, prefer dangling/email over healthy currentSource
  gate = gate.replace(
    `  const currentSource = mapSourceForField(victimWorkflow, mappedField) || expected;
  const repl =
    prefer.find((k) => observed.includes(k)) ||
    prefer[0] ||
    (observed.includes('email_address') ? 'email_address' : '') ||
    replacement;
  expected = bare(currentSource) || bare(mappedField);
  replacement = bare(repl);`,
    `  const currentSource = mapSourceForField(victimWorkflow, mappedField) || expected;
  const repl =
    prefer.find((k) => observed.includes(k)) ||
    prefer[0] ||
    (observed.includes('email_address') ? 'email_address' : '') ||
    replacement;
  const fromGotEarly = bare(sourceKeyForGotValue(gotRaw, ctx.availableData));
  // For empty shape (L0), prefer broken Map source / dangling over already-healed graph
  if (gotEmpty) {
    const dang = (ctx.danglingRefs || []).map(bare).find((d) => d && d !== repl);
    expected = bare(currentSource !== repl ? currentSource : '') || dang || bare(mappedField);
  } else {
    expected = bare(fromGotEarly) || bare(currentSource !== repl ? currentSource : '') || bare(mappedField);
  }
  replacement = bare(repl);`,
  );

  by['Evidence Gate'].parameters.jsCode = gate;
  await putWf(wf, nodes);
  console.log('scan: stale filter + shape self-remap guard');
}

async function fixSemantic() {
  const wf = await api('GET', `/api/v1/workflows/${ids.semantic}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const get = nodes.find((n) => n.name === 'Get Recent Success');
  if (!get) throw new Error('Get Recent Success missing');
  const params = get.parameters.queryParameters.parameters || [];
  if (!params.some((p) => p.name === 'workflowId')) {
    params.unshift({ name: 'workflowId', value: REV });
  }
  // Prefer success samples for role critic when available
  if (!params.some((p) => p.name === 'status')) {
    params.push({ name: 'status', value: 'success' });
  }
  get.parameters.queryParameters.parameters = params;
  await putWf(wf, nodes);
  console.log('semantic: workflowId + status=success on Get Recent Success');
}

async function fixReset() {
  const wf = await api('GET', `/api/v1/workflows/${ids.reset}`);
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const rest = nodes.find((n) => n.name === 'Restore Healthy Mapping');
  if (!rest) throw new Error('Restore Healthy Mapping missing');
  let code = rest.parameters.jsCode;

  const oldIf = `  if (n.name === 'Is B2B?') {
    let raw = JSON.stringify(n.parameters || {});
    raw = raw.replace(/\\$json\\.is_c2c(?![A-Za-z0-9_])/g, '$json.is_b2b');
    n.parameters = JSON.parse(raw);
  }`;

  // Broader: any Is B2B block — replace with literal healthy IF
  const literalIf = `  if (n.name === 'Is B2B?') {
    n.parameters = {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'c1',
            leftValue: '={{ $json.is_b2b }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    };
  }`;

  if (code.includes("n.name === 'Is B2B?'")) {
    code = code.replace(
      /if \(n\.name === 'Is B2B\?'\) \{[\s\S]*?\n  \}/,
      literalIf.trim().replace(/^/, '').replace(/^/, '') || literalIf,
    );
    // The replace above might be messy — do explicit
    const start = code.indexOf("if (n.name === 'Is B2B?')");
    if (start >= 0) {
      // find matching closing brace for this if block at indent level
      let i = start;
      let depth = 0;
      let end = -1;
      for (; i < code.length; i++) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > start) {
        code = code.slice(0, start) + literalIf.trim() + code.slice(end);
      }
    }
  } else {
    // insert before Finalize Success handling
    const fin = code.indexOf("if (n.name === 'Finalize Success'");
    if (fin < 0) throw new Error('cannot find insert point for Is B2B restore');
    code = code.slice(0, fin) + literalIf.trim() + '\n\n  ' + code.slice(fin);
  }

  rest.parameters.jsCode = code;
  await putWf(wf, nodes);
  console.log('reset: literal Is B2B? restore');
}

async function main() {
  await fixScan();
  await fixSemantic();
  await fixReset();
  console.log(JSON.stringify({ ok: true, rev: REV }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
