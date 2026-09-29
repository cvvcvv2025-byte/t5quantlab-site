import fs from 'node:fs';

const jsPath='assets/source-inspector.js';
const handoffPath='assets/source-inspector-handoff.js';
const continueJsPath='assets/builder-continue.js';
const pagePath='tools/strategy-builder/inspect/index.html';
const continuePagePath='tools/strategy-builder/continue/index.html';
const homePath='index.html';
const toolsPath='tools/index.html';
const js=fs.readFileSync(jsPath,'utf8');
const handoff=fs.readFileSync(handoffPath,'utf8');
const continueJs=fs.readFileSync(continueJsPath,'utf8');
const page=fs.readFileSync(pagePath,'utf8');
const continuePage=fs.readFileSync(continuePagePath,'utf8');
const home=fs.readFileSync(homePath,'utf8');
const tools=fs.readFileSync(toolsPath,'utf8');
const errors=[];
const need=(ok,msg)=>{if(!ok)errors.push(msg);};
const noNetwork=(src,label)=>{
 need(!/await\s+fetch\s*\(/.test(src),label+' must not await fetch()');
 need(!/\bfetch\s*\(\s*['"`]/.test(src),label+' must not issue literal fetch() requests');
 need(!/new\s+XMLHttpRequest\s*\(/.test(src),label+' must not create XMLHttpRequest');
 need(!/new\s+FormData\s*\(/.test(src),label+' must not create FormData uploads');
 need(!/["'`]\/api\//.test(src),label+' must not call /api/*');
};

need(/f\.text\s*\(\s*\)/.test(js),'source inspector must read source locally with File.text()');
need(/512\s*\*\s*1024/.test(js),'source inspector must retain 512 KB local size ceiling');
noNetwork(js,'free inspector');
need(!/openai/i.test(js),'free inspector asset must not reference OpenAI');
need(/source-inspector\.js/.test(page),'inspection page must load source-inspector.js');
need(/source-inspector-handoff\.js/.test(page),'inspection page must load local handoff helper');
need(/免费体检在当前设备完成/.test(page),'inspection page must explain local processing in customer language');
need(/源码不上传/.test(page)||/不会上传服务器/.test(page),'inspection page must disclose source is not uploaded');
need(!/<form\b[^>]*\baction\s*=/i.test(page),'inspection page must not contain posting form actions');

need(/sessionStorage/.test(handoff),'inspection handoff must remain browser-session local');
need(/f\.text\s*\(\s*\)/.test(handoff),'inspection handoff must read the chosen File locally');
need(/512\s*\*\s*1024/.test(handoff),'inspection handoff must retain 512 KB ceiling');
noNetwork(handoff,'inspection handoff');
need(!/openai/i.test(handoff),'inspection handoff must not reference OpenAI');
need(handoff.includes('/tools/strategy-builder/continue/'),'inspection handoff must route through continuation workspace');

need(/builder-continue\.js/.test(continuePage),'continuation page must load builder-continue.js');
need(/noindex,nofollow/.test(continuePage),'continuation workspace must stay out of search index');
need(/sessionStorage/.test(continueJs),'continuation workspace must restore from browser session storage');
need(/DataTransfer/.test(continueJs)&&/new\s+win\.File/.test(continueJs),'continuation workspace must rebuild the local File without server storage');
noNetwork(continueJs,'continuation helper');
need(!/openai/i.test(continueJs),'continuation helper must not reference OpenAI');

need(home.includes('/tools/strategy-builder/inspect/'),'home must link to advanced free inspection');
need(tools.includes('/tools/strategy-builder/inspect/'),'tools hub must link to advanced free inspection');

if(errors.length){
 console.error('Source inspector contract check failed:');
 for(const e of errors)console.error('- '+e);
 process.exit(1);
}
console.log('Source inspector local-processing and local-handoff contract checks passed.');
