const d = $('Pick HITL Incident').first().json;
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
  const expected = String(sug.expectedField || '').replace(/^\$json\./, '').trim();
  const replacement = String(sug.replacementField || '').replace(/^\$json\./, '').trim();
  const mapped = String(sug.mappedField || '').trim();
  if (!expected || !replacement || expected === replacement) continue;

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

  const esc = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reDot = new RegExp('\\$json\\.' + esc + '(?![A-Za-z0-9_])', 'g');
  const reBracket = new RegExp('\\$json\\[[\'"]' + esc + '[\'"]\\]', 'g');
  for (const n of nodes) {
    const before = JSON.stringify(n.parameters || {});
    const s = before.replace(reDot, '$json.' + replacement).replace(reBracket, '$json.' + replacement);
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
}];
