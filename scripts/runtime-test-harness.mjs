// Future signed-client releases remain covered by payment regression tests.
// The substitution exists only in a temporary test module, never in production.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const original = fs.readFileSync(new URL('../src/runtime-worker.js', import.meta.url), 'utf8');
const source = original.replace('async function deliveryState(request, env, ctx) {', `let testCatalog = null;
export function setAcceptedDeliveryFixture(items) { testCatalog = items; }
async function deliveryState(request, env, ctx) {
  if (testCatalog !== null) return testCatalog;`);
const temporary = new URL('../src/.runtime-test-' + randomUUID() + '.mjs', import.meta.url);
let module;
try { fs.writeFileSync(temporary, source, {flag: 'wx'}); module = await import(temporary.href); }
finally { fs.rmSync(temporary, {force: true}); }
export default module.default;
export const setAcceptedDeliveryFixture = module.setAcceptedDeliveryFixture;
export function futureAcceptedCatalog() {
  return Array.from({length: 7}, (_, i) => ({kind: i < 3 ? 'indicator' : 'ea', ready: true, download_allowed: true, runtime_license_ready: true}));
}
