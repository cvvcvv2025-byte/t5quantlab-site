import fs from 'node:fs';

const jsPath='assets/source-inspector.js';
const pagePath='tools/strategy-builder/inspect/index.html';
const homePath='index.html';
const toolsPath='tools/index.html';
const js=fs.readFileSync(jsPath,'utf8');
const page=fs.readFileSync(pagePath,'utf8');
const home=fs.readFileSync(homePath,'utf8');
const tools=fs.readFileSync(toolsPath,'utf8');
const errors=[];
const need=(ok,msg)=>{if(!ok)errors.push(msg);};

need(/f\.text\s*\(\s*\)/.test(js),'source inspector must read source locally with File.text()');
need(/512\s*\*\s*1024/.test(js),'source inspector must retain 512 KB local size ceiling');
need(!/await\s+fetch\s*\(/.test(js),'free inspector must not await fetch()');
need(!/\bfetch\s*\(\s*['"`]/.test(js),'free inspector must not issue literal fetch() requests');
need(!/new\s+XMLHttpRequest\s*\(/.test(js),'free inspector must not create XMLHttpRequest');
need(!/new\s+FormData\s*\(/.test(js),'free inspector must not create FormData uploads');
need(!/["'`]\/api\//.test(js),'free inspector must not call /api/*');
need(!/openai/i.test(js),'free inspector asset must not reference OpenAI');
need(/source-inspector\.js/.test(page),'inspection page must load source-inspector.js');
need(/0 API/.test(page),'inspection page must disclose zero API behavior');
need(/不上传源码/.test(page)||/不会上传服务器/.test(page),'inspection page must disclose source is not uploaded');
need(!/<form\b[^>]*\baction\s*=/i.test(page),'inspection page must not contain posting form actions');
need(home.includes('/tools/strategy-builder/inspect/'),'home must link to advanced free inspection');
need(tools.includes('/tools/strategy-builder/inspect/'),'tools hub must link to advanced free inspection');

if(errors.length){
 console.error('Source inspector contract check failed:');
 for(const e of errors)console.error('- '+e);
 process.exit(1);
}
console.log('Source inspector zero-API contract checks passed.');