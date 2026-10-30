import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('assets/runtime-licenses.js','utf8');let checks=0;
for(const owner of [false,true]){
 const all=[],calls=[];let downloaded='';
 class Element{constructor(tag,text=''){this.tag=tag;this.children=[];this.handlers={};this.textContent=text;this.value='';all.push(this);}append(...items){this.children.push(...items);if(this.tag==='select'&&!this.value)this.value=items[0]?.value||'';}replaceChildren(...items){this.children=[];this.append(...items);}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.handlers[k]=fn;}click(){downloaded=this.href;}}
 const box=new Element('div'),product={code:'structure_decision_map_mt4',kind:'indicator',enabled:true,platforms:['MT4','MT5'],protocol_version:3};let polls=0;
 const ctx={window:{addEventListener(){}},document:{getElementById:()=>box,createElement:t=>new Element(t),createTextNode:t=>t},setTimeout:fn=>fn(),fetch:async(url,opts)=>{calls.push({url,opts});return{ok:true,headers:{get:()=> 'application/json'},json:async()=>url.includes('/single-file-builds/')?{job_id:'a'.repeat(48),status:++polls<2?'building':'ready',download_url:'/private.zip',file_url:'/private.ex4'}:opts.method==='GET'?{products:[product],licenses:[],owner_profile_supported:owner}:{job_id:'a'.repeat(48),status:'queued'}};}};
 await vm.runInNewContext(source,ctx);const form=all.find(x=>x.tag==='form'),inputs=all.filter(x=>x.tag==='input');inputs.find(x=>x.type==='checkbox').checked=true;inputs.find(x=>x.placeholder?.startsWith('交易账号')).value='123456';inputs.find(x=>x.placeholder?.startsWith('交易服务器')).value='Test-Demo';await form.handlers.submit({preventDefault(){}});
 assert.equal(downloaded,'/private.ex4');checks++;assert.equal(polls,2);checks++;assert.equal(all.some(x=>x.href==='/private.ex4'),true);checks++;assert.equal(all.some(x=>x.readOnly),false);checks++;assert.equal(all.some(x=>x.tag==='p'&&x.textContent.includes('无需授权助手、密钥、模板或SET')),true);checks++;
}
console.log('Single-file UI OK:',checks,'checks; queued -> native build -> private download; no key or helper step.');
