import fs from 'node:fs';
const path='docs/PRODUCTION_RUNBOOK.md';
let s=fs.readFileSync(path,'utf8');
const marker='## 12. Automatic production deploy and live smoke';
if(!s.includes(marker)){
  s += `\n\n${marker}\n\nThe normal release path is now an **automatic production deploy** after the GitHub \`Syntax Check\` workflow completes successfully on \`main\`. The deployment workflow checks out the **exact tested commit SHA** from that successful workflow run; it must not silently deploy an untested newer revision.\n\nThe manual \`workflow_dispatch\` entry remains available for controlled recovery or operator-initiated deployment.\n\nAfter Wrangler deploy completes, GitHub Actions polls:\n\n\`\`\`text\nhttps://t5quantlab.com/api/health\n\`\`\`\n\nThe release fails if the public site or free source inspector is not ready. The same smoke output also prints \`account_ready\`, \`paid_builder_ready\`, \`checkout_ready\`, and \`payment_environment\` so incomplete commercial configuration is visible in the deployment log rather than hidden.\n\nA successful public smoke check does **not** replace the private \`/admin/health/?deep=1\` provider verification or the manual real-payment end-to-end test before opening live checkout.\n`;
  fs.writeFileSync(path,s);
}
console.log('Production runbook phase 12 applied.');
