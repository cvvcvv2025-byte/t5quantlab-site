import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('assets/runtime-licenses.js','utf8');let checks=0;
for(const owner of [false,true]){
 const all=[],calls=[];let downloaded=false;
 class Element{constructor(tag,text=''){this.tag=tag;this.children=[];this.handlers={};this.textContent=text;this.value='';all.push(this);}append(...items){this.children.push(...items);if(this.tag==='select'&&!this.value)this.value=items[0]?.value||'';}replaceChildren(...items){this.children=[];this.append(...items);}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.handlers[k]=fn;}click(){downloaded=true;}}
 const box=new Element('div'),product={code:'structure_decision_map_mt4',kind:'indicator',enabled:true,platforms:['MT4','MT5'],protocol_version:3};
 const context={document:{getElementById:()=>box,createElement:t=>new Element(t),createTextNode:t=>t},fetch:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>opts.method==='GET'?{products:[product],licenses:[],owner_profile_supported:owner}:{license_key:'a'.repeat(64)},blob:async()=>new Blob(['signed-profile'])};},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout(){},Blob};
 await vm.runInNewContext(source,context);
 const form=all.find(x=>x.tag==='form'),inputs=all.filter(x=>x.tag==='input');const accept=inputs.find(x=>x.type==='checkbox');assert.equal(accept.required,true);checks++;
 accept.checked=true;inputs.find(x=>x.placeholder?.startsWith('交易账号')).value='123456';inputs.find(x=>x.placeholder?.startsWith('交易服务器')).value='QA-Broker-Demo';
 await form.handlers.submit({preventDefault(){}});
 const call=calls.at(-1),body=JSON.parse(call.opts.body);assert.equal(body.license_policy_version,'signed-v3-20261028');assert.equal(body.platform,'MT4');assert.equal(body.account_login,'123456');checks+=3;
 assert.equal(call.url,owner?'/api/account/runtime-licenses/owner-profile':'/api/account/runtime-licenses');checks++;
 if(owner){assert.equal(downloaded,true);assert.equal(all.some(x=>x.download==='T5Owner3_structure_decision_map_mt4_MT4.credential'),true);checks+=2;}else{assert.equal(all.some(x=>x.readOnly&&x.value==='a'.repeat(64)),true);assert.equal(all.some(x=>x.textContent.includes('T5 License Bridge')),true);checks+=2;}
}
console.log(`Signed runtime UI OK: ${checks} checks; normal activation and owner signed-profile download. No live provider calls.`);
