import fs from 'node:fs';

const errors=[];
const need=(ok,msg)=>{if(!ok)errors.push(msg);};
const read=p=>fs.readFileSync(p,'utf8');
const core=['index.html','library/index.html','market-lab/index.html','research/index.html','verification/index.html','tools/index.html','faq/index.html'];
for(const file of core){
 need(fs.existsSync(file),`${file}: missing`);if(!fs.existsSync(file))continue;
 const html=read(file);
 need(/<link rel="canonical" href="https:\/\/t5quantlab\.com\//.test(html),`${file}: canonical missing`);
 need(/<meta name="description" content="[^"]+"/.test(html),`${file}: meta description missing`);
 need(html.includes('/assets/seo-structured.js'),`${file}: seo-structured.js missing`);
 need(!/noindex/i.test(html),`${file}: core public page must not be noindex`);
}
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
 need(/<div class="breadcrumbs">/.test(html),`${file}: breadcrumb UI missing`);
}
const visual=read('assets/case-visuals.js');
for(const file of cases){const route='/'+file.replace(/index\.html$/,'');need(visual.includes(route),`case-visuals.js: missing ${route}`);}
need(/不是原始K线截图/.test(visual),'case visuals must disclose they are schematic, not original screenshots');
need(!/\bfetch\s*\(/.test(visual),'case visual asset must remain presentation-only');

const seo=read('assets/seo-structured.js');
for(const type of ['Organization','WebSite','BreadcrumbList','Article'])need(seo.includes(type),`seo-structured.js: missing ${type}`);
need(!/FAQPage/.test(seo),'seo-structured.js must not emit deprecated FAQPage rich-result markup');

const sitemap=read('sitemap.xml');
need(sitemap.includes('https://t5quantlab.com/faq/'),'sitemap.xml: FAQ URL missing');

if(errors.length){console.error('SEO contract check failed:');for(const e of errors)console.error('- '+e);process.exit(1);}
console.log('SEO contract OK: core hubs, audited case visuals, structured data and FAQ boundaries verified.');