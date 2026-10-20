import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
const root = process.cwd(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 't5-origin-'));
const base = { ...process.env, GITHUB_ACTIONS: '', GITHUB_WORKFLOW: '', TESTED_SHA: '' };
const script = path.join(root, 'scripts/prepare-release.mjs');
const call = (mode, env = {}) => spawnSync(process.execPath, [script,mode], { cwd: dir, env: { ...base,...env }, encoding: 'utf8' });
try {
  execFileSync('git',['init','--quiet'],{cwd:dir});
  execFileSync('git',['-c','user.name=Local Test','-c','user.email=test@example.invalid','commit','--quiet','--allow-empty','-m','fixture'],{cwd:dir});
  const sha = execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
  assert.notEqual(call('--production').status,0,'non-GitHub deployment cannot stamp production');
  assert.notEqual(call('--ci').status,0,'Cloudflare/local environment cannot produce the CI module implicitly');
  assert.notEqual(call('--production',{GITHUB_ACTIONS:'true',GITHUB_WORKFLOW:'Deploy Production',TESTED_SHA:'a'.repeat(40)}).status,0,'wrong tested revision rejected');
  assert.notEqual(call('--production',{GITHUB_ACTIONS:'true',GITHUB_WORKFLOW:'Other Workflow',TESTED_SHA:sha}).status,0,'unintended workflow rejected');
  // A fresh repository source checkout must fail to resolve the Worker without
  // generated release data, even when a provider skips Wrangler custom builds.
  fs.cpSync(path.join(root,'src'),path.join(dir,'src'),{recursive:true});
  fs.rmSync(path.join(dir,'src/release-info.js'),{force:true});
  const unprepared=spawnSync(process.execPath,['--input-type=module','-e',"await import('./src/runtime-worker.js')"],{cwd:dir,encoding:'utf8'});
  assert.notEqual(unprepared.status,0);assert.match(unprepared.stderr,/release-info.js/);
  assert.equal(call('--ci',{GITHUB_ACTIONS:'true'}).status,0);
  assert.match(fs.readFileSync(path.join(dir,'src/release-info.js'),'utf8'),new RegExp(sha));
  assert.equal(call('--production',{GITHUB_ACTIONS:'true',GITHUB_WORKFLOW:'Deploy Production',TESTED_SHA:sha}).status,0);
  const prepared=spawnSync(process.execPath,['--input-type=module','-e',"await import('./src/runtime-worker.js')"],{cwd:dir,encoding:'utf8'});
  assert.equal(prepared.status,0,prepared.stderr);
  console.log('Release origin passed: unprepared provider build fails closed; wrong workflow/SHA rejected; verified production and test preparation import successfully.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
