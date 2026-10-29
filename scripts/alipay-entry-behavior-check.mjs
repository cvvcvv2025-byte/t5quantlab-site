import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('assets/alipay-entry.js','utf8');let checks=0;
for(const path of ['/membership/checkout/','/membership/automation-checkout/','/checkout/'])for(const state of ['ready','disabled','unpriced','held']){
 let inserted=null;const code=path==='/membership/checkout/'?'indicator_membership':path==='/membership/automation-checkout/'?'premium_membership':'code_workshop_single';
 const box={after(node){inserted=node;},before(){throw Error('Alipay must be below PayPal');}};
 const context={location:{pathname:path},document:{getElementById:id=>id==='paypalBox'?box:null,createElement:()=>({})},fetch:async()=>({json:async()=>({ok:true,providers:{alipay:{enabled:state!=='disabled'}},products:[{code,prices:{CNY:state==='unpriced'?null:9336},delivery_ready:state!=='held'}]})})};vm.runInNewContext(source,context);await new Promise(setImmediate);
 assert.equal(Boolean(inserted),state==='ready');checks++;if(inserted){assert.equal(inserted.href,'/checkout/alipay/?product='+code);assert.equal(inserted.textContent,'使用支付宝付款 · ¥93.36');checks+=2;}
}
console.log('Alipay entry:',checks,'checks; correct placement below PayPal, product mapping, approved price, enabled and delivery gates.');
