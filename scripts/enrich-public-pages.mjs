import fs from 'node:fs';
import path from 'node:path';

const sitemap=fs.readFileSync('sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>https:\/\/t5quantlab\.com([^<]*)<\/loc>/g)].map(m=>m[1]||'/');
const hubs=new Set(['/','/library/','/market-lab/','/market-lab/practice/','/market-lab/training/','/research/','/verification/','/tools/','/tools/guides/','/tools/indicators/','/tools/ea/','/faq/']);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const localFile=route=>route==='/'?'index.html':path.join(route.replace(/^\//,'').replace(/\/$/,''),'index.html');
const relatedRoute=route=>{
 if(route.startsWith('/library/')&&!hubs.has(route))return true;
 if(route.startsWith('/research/')&&!hubs.has(route))return true;
 if(route.startsWith('/verification/')&&!hubs.has(route))return true;
 if(route.startsWith('/tools/guides/')&&!hubs.has(route))return true;
 if(['/tools/source-code-audit-guide/','/tools/ea-release-checklist/'].includes(route))return true;
 if(/^\/market-lab\/20\d{2}-\d{2}-\d{2}-/.test(route))return true;
 if(route.startsWith('/market-lab/training/')&&!hubs.has(route))return true;
 return false;
};
const insertAfterDescription=(html,tag)=>html.replace(/(<meta name="description" content="[^"]*">)/i,`$1${tag}`);
let changed=0,visited=0;
for(const route0 of urls){
 const route=route0.endsWith('/')?route0:route0+'/';
 const file=localFile(route);
 if(!fs.existsSync(file))continue;
 let html=fs.readFileSync(file,'utf8');visited++;
 const title=html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
 const desc=html.match(/<meta name="description" content="([^"]*)"/i)?.[1]?.trim();
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1]?.trim();
 if(!title||!desc||!canonical)continue;
 const type=hubs.has(route)?'website':'article';
 const tags=[];
 if(!/property="og:title"/i.test(html))tags.push(`<meta property="og:title" content="${esc(title)}">`);
 if(!/property="og:description"/i.test(html))tags.push(`<meta property="og:description" content="${esc(desc)}">`);
 if(!/property="og:type"/i.test(html))tags.push(`<meta property="og:type" content="${type}">`);
 if(!/property="og:url"/i.test(html))tags.push(`<meta property="og:url" content="${esc(canonical)}">`);
 if(!/name="twitter:card"/i.test(html))tags.push('<meta name="twitter:card" content="summary">');
 if(!/name="twitter:title"/i.test(html))tags.push(`<meta name="twitter:title" content="${esc(title)}">`);
 if(!/name="twitter:description"/i.test(html))tags.push(`<meta name="twitter:description" content="${esc(desc)}">`);
 if(tags.length)html=insertAfterDescription(html,tags.join(''));
 if(!html.includes('/assets/seo-structured.js'))html=html.replace('</body>','<script src="/assets/seo-structured.js"></script></body>');
 if(relatedRoute(route)&&!html.includes('/assets/related-content.js'))html=html.replace('</body>','<script src="/assets/related-content.js"></script></body>');
 const before=fs.readFileSync(file,'utf8');
 if(html!==before){fs.writeFileSync(file,html);changed++;}
}
console.log(`Enriched ${changed} public pages out of ${visited} sitemap HTML pages.`);
