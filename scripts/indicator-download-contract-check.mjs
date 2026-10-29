import fs from 'node:fs';

const errors = [];
const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const need = (src, text, label) => { if (!src.includes(text)) errors.push(`${label}: missing ${JSON.stringify(text)}`); };
const forbid = (src, re, label) => { if (re.test(src)) errors.push(`${label}: forbidden ${re}`); };

const worker = read('src/account-worker.js');
const schema = read('builder-schema.sql');
const page = read('tools/indicators/mtf-structure-panel/index.html');
const member = read('account/member-center/index.html');
const admin = read('admin/members/index.html');
const hub = read('admin/index.html');

for (const route of ['/api/admin/indicator-artifacts/upload', '/api/admin/member-entitlements']) {
  need(worker, route, `worker route ${route}`);
}
for (const slug of ['mtf-structure-panel', 'neckline-mtf', 'progress-candle', 'mtf-structure-panel-mt5', 'neckline-mtf-mt5', 'progress-candle-mt5']) {
  need(worker, `"${slug}": {`, `artifact catalog ${slug}`);
  need(member, `data-download="${slug}"`, `member download control ${slug}`);
}
need(worker, '77818578ebfbc3f870d1fd2074f55dc00d0cf7692a280805194bb53f4f63d63f', 'mtf-structure-panel-mt5 pinned hash');
need(admin, 'value="mtf-structure-panel-mt5"', 'mtf-structure-panel-mt5 admin upload option');
need(worker, '71e7e0d424ca8939215998a7338f2d38a6f92d636ff7d47157c3ce371386b738', 'neckline-mtf-mt5 pinned hash');
need(admin, 'value="neckline-mtf-mt5"', 'neckline-mtf-mt5 admin upload option');
need(worker, '8d52e157f304a05651c2a88e2c67473680dde164570e535d93e9bc422dbe86e4', 'progress-candle-mt5 pinned hash');
need(admin, 'value="progress-candle-mt5"', 'progress-candle-mt5 admin upload option');
need(worker, 'const indicatorRoute = p.match', 'generic protected indicator route');

need(worker, 'const INDICATOR_MEMBERSHIP_PRODUCTS = ["indicator_membership", "premium_membership"]', 'tier allowlist');
need(worker, '780f39d9da869d61b8dce6e6b1d439b111435137f22151d10c231def92eab88c', 'pinned customer-pack sha256');
need(worker, 'bc8b4620630a05a1982396caa27471b84816e0ac9255b2bfb559f5088a4f10c8', 'pinned neckline customer-pack sha256');
need(worker, '39246be933880c47daa840af23f7733146cb537b24714f233d326934243e58b6', 'pinned progress customer-pack sha256');
need(worker, 'member-artifacts/mtf-structure-panel/0.1.1-license.3/', 'private R2 artifact key');
need(worker, 'member-artifacts/neckline-mtf/0.1.2-license.3/', 'private neckline R2 artifact key');
need(worker, 'member-artifacts/progress-candle/0.1.2-license.3/', 'private progress R2 artifact key');
need(worker, 'INDICATOR_ENTITLEMENT_REQUIRED', 'fail-closed entitlement response');
need(worker, 'Cache-Control": "private, no-store, max-age=0"', 'download cache boundary');
need(worker, 'Content-Disposition', 'attachment response');
need(worker, 'INSERT INTO member_download_events', 'download audit ledger');
need(worker, 'ARTIFACT_HASH_MISMATCH', 'admin upload hash rejection');
need(worker, 'ARTIFACT_CONTENT_MISMATCH', 'download object content verification');
need(worker, 'const actualHash = await sha256BytesHex(bytes)', 'download must hash the stored object bytes');
need(worker, 'entitlements: entitlementResult?.results || []', 'account summary entitlement visibility');

const downloadStart = worker.indexOf('async function downloadIndicator');
const downloadEnd = worker.indexOf('async function adminUploadIndicator');
const download = downloadStart >= 0 && downloadEnd > downloadStart ? worker.slice(downloadStart, downloadEnd) : '';
const sessionAt = download.indexOf('resolveSession(request, env)');
const entitlementAt = download.indexOf('activeIndicatorEntitlement(env, user.user_id, artifact)');
const objectAt = download.indexOf('USER_CODE_BUCKET.get');
if (!(sessionAt >= 0 && entitlementAt > sessionAt && objectAt > entitlementAt)) {
  errors.push('download route must resolve session, then active entitlement, then read private object');
}

for (const text of ['CREATE TABLE IF NOT EXISTS product_entitlements', 'UNIQUE(user_id, product_code)', 'CREATE TABLE IF NOT EXISTS member_download_events']) {
  need(schema, text, 'membership schema');
}
need(member, "/api/member/${isEa?'eas':'indicators'}/${encodeURIComponent(slug)}/download", 'generic member download client');
need(member, '检查权限并下载', 'download control');
forbid(member, /href=["'][^"']+\.(?:zip|ex4|ex5|mq4|mq5)(?:[?#][^"']*)?["']/i, 'public binary link');
need(admin, 'noindex,nofollow', 'admin indexing boundary');
need(admin, 'sessionStorage', 'tab-scoped admin key');
need(admin, '/api/admin/indicator-artifacts/upload', 'admin artifact upload');
need(admin, '/api/admin/member-entitlements', 'admin entitlement management');
forbid(admin, /localStorage|document\.cookie/i, 'admin persistent key storage');
need(hub, '/admin/members/', 'admin members navigation');

const publicBinaryFiles = [];
for (const root of ['tools', 'assets', 'membership', 'account']) {
  if (!fs.existsSync(root)) continue;
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:zip|ex4|ex5|mq4|mq5)$/i.test(entry.name)) publicBinaryFiles.push(path);
    }
  };
  walk(root);
}
if (publicBinaryFiles.length) errors.push(`public binary artifacts found: ${publicBinaryFiles.join(', ')}`);

if (errors.length) {
  console.error('Indicator download contract failed:');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}
console.log('Indicator download contract OK: account, entitlement, private R2 object, audit ledger, admin hash gate, and no public binary link are enforced.');
