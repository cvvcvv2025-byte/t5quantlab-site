import fs from 'node:fs';
import path from 'node:path';

const ignored = new Set(['.git', 'node_modules', 'admin', 'docs']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ');
}

const forbidden = [
  /这个导航器为什么存在/,
  /客户先从/,
  /不一次塞\d+题/,
  /\buser_id\b/,
  /Builder访问cookie/i,
  /免费层不烧API/i,
  /OpenAI调用前/i,
  /付费Grant门禁/i,
  /账户API/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\b0 API\b/i,
  /\bNO API\b/i,
  /SOURCE STAYS LOCAL/i,
  /未付费不调用AI/i,
  /不产生API(?:成本|费用)/i,
  /用户愿意为实际价值付费/,
  /真正产生AI成本/,
  /为什么不先做复杂订阅/,
  /不再代表T5全部客户/,
  /项目内部历史审计结论/,
  /最后三组专项也已补齐/,
  /六组新增专项训练/,
  /原96题继续保留/,
  /原7个Pack完整保留/,
  /接下来题包会/,
  /会按真实样本继续补/,
  /Indicator Foundations 已上线/,
  /· EXPANDED/,
  /CURRENT TRAINING SYSTEM/,
  /NEXT PACKS/,
  /PayPal验证后开放/,
  /EA审计完成后开放/,
  /Research Build/i,
  /Candidate R1/i,
  /NEXT GATE/i,
  /首发版本/,
  /PayPal首发/,
  /首批指标会员工具/,
  /Research Hub 仍在持续建设/,
  /当前研究状态/,
  /Primary Candidate/i,
];

const forbiddenMarkup = [
  /<span\s+class=["']tag live["']>New<\/span>/i,
  /<span\s+class=["']tag wait["']>Pending<\/span>/i,
  /<h3>Build<\/h3>/i,
  /<h3>Audit<\/h3>/i,
  /<h3>Release<\/h3>/i,
];

walk('.');
const errors = [];
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const text = visibleText(html);
  for (const pattern of forbidden) {
    if (pattern.test(text)) errors.push(`${file}: ${pattern}`);
  }
  for (const pattern of forbiddenMarkup) {
    if (pattern.test(html)) errors.push(`${file}: ${pattern}`);
  }
}

if (errors.length) {
  console.error('Customer-facing copy boundary check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Customer-facing copy boundary check passed across ${files.length} public HTML pages.`);
