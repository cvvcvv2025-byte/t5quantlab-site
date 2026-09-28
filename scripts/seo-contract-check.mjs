import fs from 'node:fs';
import path from 'node:path';

const errors=[];
const need=(ok,msg)=>{if(!ok)errors.push(msg);};
const read=p=>fs.readFileSync(p,'utf8');
const hubs=new Set(['/','/library/','/market-lab/','/market-lab/practice/','/market-lab/training/','/research/','/verification/','/tools/','/tools/guides/','/tools/indicators/','/tools/ea/','/faq/']);
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
const localFile=route=>route==='/'?'index.html':path.join(route.replace(/^\//,'').replace(/\/$/,''),'index.html');
const sitemap=read('sitemap.xml');
const routes=[...sitemap.matchAll(/<loc>https:\/\/t5quantlab\.com([^<]*)<\/loc>/g)].map(m=>{const r=m[1]||'/';return r.endsWith('/')?r:r+'/';});
need(routes.length>=90,`sitemap public route count unexpectedly low: ${routes.length}`);
let publicHtml=0;
for(const route of routes){
 const file=localFile(route);if(!fs.existsSync(file))continue;publicHtml++;
 const html=read(file);
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1]||'';
 const ogUrl=html.match(/<meta property="og:url" content="([^"]+)"/i)?.[1]||'';
 const ogType=html.match(/<meta property="og:type" content="([^"]+)"/i)?.[1]||'';
 need(Boolean(canonical),`${file}: canonical missing`);
 need(/<meta name="description" content="[^"]+"/i.test(html),`${file}: meta description missing`);
 need(/<meta property="og:title" content="[^"]+"/i.test(html),`${file}: og:title missing`);
 need(/<meta property="og:description" content="[^"]+"/i.test(html),`${file}: og:description missing`);
 need(Boolean(ogType),`${file}: og:type missing`);
 need(ogType===(hubs.has(route)?'website':'article'),`${file}: og:type must be ${hubs.has(route)?'website':'article'}, found ${ogType||'missing'}`);
 need(Boolean(ogUrl)&&ogUrl===canonical,`${file}: og:url must match canonical`);
 need(/<meta name="twitter:card" content="summary"/i.test(html),`${file}: twitter summary card missing`);
 need(/<meta name="twitter:title" content="[^"]+"/i.test(html),`${file}: twitter:title missing`);
 need(/<meta name="twitter:description" content="[^"]+"/i.test(html),`${file}: twitter:description missing`);
 need(html.includes('/assets/seo-structured.js'),`${file}: seo-structured.js missing`);
 need(!/noindex/i.test(html),`${file}: sitemap public page must not be noindex`);
 if(relatedRoute(route))need(html.includes('/assets/related-content.js'),`${file}: related-content.js missing`);
}
need(publicHtml>=90,`public sitemap HTML coverage unexpectedly low: ${publicHtml}`);

const faq=read('faq/index.html');
need(!/FAQPage/i.test(faq),'FAQ rich-result schema is deprecated; do not add FAQPage markup');
need((faq.match(/class="faq-item"/g)||[]).length>=10,'FAQ should retain at least 10 practical questions');

const cases=[
 'market-lab/2026-08-27-h1-neckline-reclaim-failure/index.html',
 'market-lab/2026-08-27-m5-secondary-top-break-retest/index.html',
 'market-lab/2026-08-28-m5-head-shoulders-missed-signal/index.html',
 'market-lab/2026-08-28-m5-liquidity-absorption-t1-protect/index.html'
];
for(const file of cases){
 const html=read(file);
 need(html.includes('/assets/case-visuals.js'),`${file}: case visuals missing`);
 need(html.includes('/assets/seo-structured.js'),`${file}: structured data missing`);
 need(html.includes('/assets/related-content.js'),`${file}: case recommendations missing`);
 need(/<div class="breadcrumbs">/.test(html),`${file}: breadcrumb UI missing`);
}
const visual=read('assets/case-visuals.js');
for(const file of cases){const route='/'+file.replace(/index\.html$/,'');need(visual.includes(route),`case-visuals.js: missing ${route}`);}
need(/不是原始K线截图/.test(visual),'case visuals must disclose they are schematic, not original screenshots');
need(!/\bfetch\s*\(/.test(visual),'case visual asset must remain presentation-only');

const related=read('assets/related-content.js');
need(/继续下一步/.test(related),'related-content.js: recommendation heading missing');
need(!/\bfetch\s*\(/.test(related),'related-content.js must remain static and API-free');
for(const expected of ['/market-lab/practice/context-structure/','/market-lab/practice/liquidity-execution/','/verification/audit-checklist/','/tools/strategy-builder/inspect/'])need(related.includes(expected),`related-content.js: missing ${expected}`);

const seo=read('assets/seo-structured.js');
for(const type of ['Organization','WebSite','BreadcrumbList','Article'])need(seo.includes(type),`seo-structured.js: missing ${type}`);
need(!/FAQPage/.test(seo),'seo-structured.js must not emit deprecated FAQPage rich-result markup');
need(sitemap.includes('https://t5quantlab.com/faq/'),'sitemap.xml: FAQ URL missing');

if(errors.length){console.error('SEO contract check failed:');for(const e of errors)console.error('- '+e);process.exit(1);}
console.log(`SEO contract OK: ${publicHtml} sitemap HTML pages have canonical, correct social types, social metadata and structured data; leaf recommendations and case visuals verified.`);
