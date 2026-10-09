import fs from 'node:fs';

const files = [
  'checkout/index.html',
  'membership/checkout/index.html',
  'tools/strategy-builder/index.html'
];

let failed = false;
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1])
    .filter(code => code.trim());

  if (!scripts.length) {
    console.log(`${file}: no inline script`);
    continue;
  }

  scripts.forEach((code, index) => {
    try {
      new Function(code);
      console.log(`${file}: inline script ${index + 1} OK`);
    } catch (error) {
      failed = true;
      console.error(`${file}: inline script ${index + 1} FAILED`);
      console.error(error.stack || error);
    }
  });
}

if (failed) process.exit(1);
