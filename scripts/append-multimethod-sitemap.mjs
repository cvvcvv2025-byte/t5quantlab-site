import fs from 'node:fs';

const file='sitemap.xml';
let xml=fs.readFileSync(file,'utf8');
const routes=[
 ['/library/indicators/','weekly','0.95'],
 ['/library/indicators/moving-averages/','monthly','0.88'],
 ['/library/indicators/macd/','monthly','0.9'],
 ['/library/indicators/rsi/','monthly','0.9'],
 ['/library/indicators/bollinger-bands/','monthly','0.9'],
 ['/library/indicators/adx-dmi/','monthly','0.85'],
 ['/library/indicators/stochastic/','monthly','0.85'],
 ['/library/indicators/ichimoku/','monthly','0.85'],
 ['/library/indicators/volatility-channels/','monthly','0.88'],
 ['/library/indicators/volume-indicators/','monthly','0.88'],
 ['/library/strategy-families/','monthly','0.9'],
 ['/library/books/indicator-route/','monthly','0.9'],
 ['/market-lab/practice/indicator-foundations/','weekly','0.95']
];
let added=0;
for(const [route,freq,priority] of routes){
 const url=`https://t5quantlab.com${route}`;
 if(xml.includes(`<loc>${url}</loc>`))continue;
 const row=`  <url><loc>${url}</loc><changefreq>${freq}</changefreq><priority>${priority}</priority></url>\n`;
 xml=xml.replace('</urlset>',row+'</urlset>');
 added++;
}
fs.writeFileSync(file,xml);
console.log(`Multimethod sitemap: added ${added}, total requested ${routes.length}.`);
