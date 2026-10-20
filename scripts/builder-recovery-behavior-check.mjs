import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const state of ['modified', 'analyzed', 'uploaded', 'running']) {
  const nodes = new Map(), calls = [], events = new Map(); let paneOpened = false;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', disabled: false, children: [], handlers: {},
      classList: { hidden: new Set(['hidden']), add(k) { this.hidden.add(k); }, remove(k) { this.hidden.delete(k); }, toggle(k, on) { on ? this.hidden.add(k) : this.hidden.delete(k); } },
      addEventListener(k, f) { this.handlers[k] = f; }, add(o) { this.children.push(o); }, replaceChildren(...items) { this.children = items; }
    });
    return nodes.get(id);
  }
  const context = vm.createContext({
    project: null, latestAnalysis: null, URLSearchParams, Response, console, location: { search: '?project=p1' },
    sessionStorage: { getItem() { return null; } },
    window: { addEventListener(k, f) { events.set(k, f); } },
    document: { getElementById: node, querySelector() { return { click() { paneOpened = true; } }; } },
    Option: function (text, value) { return { text, value }; }, el: node,
    errMessage: e => e.message, formatAnalysis: a => a.summary, refreshAccess: async () => {},
    setTimeout: () => 1, clearTimeout: () => {},
    async apiJson(url) {
      calls.push(url);
      if (url === '/api/account/builder-projects') return { projects: [{ project_id: 'p1', filename: 'saved.mq5', status: state }] };
      if (url.startsWith('/api/builder/status')) return { running: state === 'running', project: { filename: 'saved.mq5', status: state === 'running' ? 'uploaded' : state, output_filename: 'saved_v1.mq5' } };
      throw new Error('Unexpected API during recovery: ' + url);
    },
    async fetch(url) { calls.push(url); return Response.json({ summary: 'Recovered analysis' }); }
  });
  vm.runInContext(fs.readFileSync('assets/builder-recovery.js', 'utf8'), context);
  for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve));
  assert(paneOpened, 'restored results must open the visible source pane');
  assert(!calls.some(x => /\/api\/builder\/(analyze|modify|upload)$/.test(x)), 'recovery must never spend a credit');
  if (state === 'modified') {
    assert(!node('modifyBox').classList.hidden.has('hidden')); assert(node('confirmModify').disabled);
    assert(node('modifyText').textContent.includes('saved_v1.mq5'));
  }
  if (state === 'analyzed') { assert(!node('analysisBox').classList.hidden.has('hidden')); assert.equal(node('analysisText').textContent, 'Recovered analysis'); }
  if (state === 'uploaded') assert(!node('retryAnalysis').classList.hidden.has('hidden'));
  if (state === 'running') { assert(node('retryAnalysis').classList.hidden.has('hidden')); assert(node('confirmModify').disabled); }
}
console.log('Builder recovery behavior OK: refresh restores the visible pane and saved result; recovery never uploads, analyses, modifies or spends credits; running attempts stay disabled.');
