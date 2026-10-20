import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
if (!['--ci', '--production', '--local-test'].includes(mode)) throw Error('Use --ci, --production, or --local-test');
if (mode !== '--local-test' && process.env.GITHUB_ACTIONS !== 'true') throw Error('Release preparation requires the verified GitHub Actions workflow');
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(actual)) throw Error('Cannot identify checkout revision');
if (mode === '--production' && (process.env.GITHUB_WORKFLOW !== 'Deploy Production' || process.env.TESTED_SHA !== actual)) throw Error('Production release must match the exact tested checkout in Deploy Production');
const release = { commit: mode === '--local-test' ? 'local-test' : actual, built_at: mode === '--production' ? new Date().toISOString() : null };
fs.mkdirSync('src', { recursive: true });
fs.writeFileSync('src/release-info.js', 'export const releaseInfo = ' + JSON.stringify(release) + ';\n');
console.log(mode === '--production' ? 'Prepared tested production revision: ' + actual : 'Prepared test-only release module');
