import fs from 'node:fs';

const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const must=(cond,msg)=>{if(!cond)errors.push(msg)};

const home=read('index.html');
const library=read('library/index.html');
const indicators=read('library/indicators/index.html');
const market=read('market-lab/index.html');
const trainer=read('market-lab/practice/trainer/index.html');
const indicatorPack=read('market-lab/practice/indicator-foundations/index.html');
const sitemap=read('sitemap.xml');

must(home.includes('132题')||home.includes('132'), 'home must present 132-question multi-method training');
must(/多方法|MULTI-METHOD/.test(home), 'home must keep multi-method positioning');
must(home.includes('/library/indicators/'), 'home must link indicator academy');
must(home.includes('/library/strategy-families/')||home.includes('/library/classic-technical-analysis/'), 'home must expose non-SMC methodology routes');

const methodRoutes=[
 '/library/glossary/','/library/indicators/moving-averages/','/library/indicators/',
 '/library/indicators/bollinger-bands/','/library/indicators/volume-indicators/',
 '/library/classic-technical-analysis/','/library/price-action-reading-notes/',
 '/library/internal-external-liquidity/','/library/fibonacci/','/library/volume-profile-structure/',
 '/library/risk-position-management/','/library/strategy-families/','/tools/'
];
for(const route of methodRoutes) must(library.includes(route), `Library missing method route ${route}`);
must((library.match(/class="indicator-card"/g)||[]).length>=13, 'Library must expose at least 13 method cards');
must(library.includes('132题'), 'Library must reference current 132-question trainer');
must(/SMC \/ ICT/.test(library), 'Library must retain SMC as one method branch');
must(library.includes('/library/classic-technical-analysis/'), 'Library must expose Classic TA academy');

const indicatorModules=[
 'moving-averages','macd','rsi','stochastic','momentum-oscillators','bollinger-bands',
 'adx-dmi','trend-following-tools','ichimoku','volatility-channels','pivot-points','volume-indicators'
];
for(const slug of indicatorModules) must(indicators.includes(`/library/indicators/${slug}/`), `Indicator academy missing ${slug}`);
must((indicators.match(/class="indicator-card"/g)||[]).length>=12, 'Indicator academy must expose at least 12 modules');
must(indicators.includes('/market-lab/practice/indicator-foundations/'), 'Indicator academy must link 36-question practice pack');
must(indicators.includes('/library/books/indicator-route/'), 'Indicator academy must link specialist books route');

must(market.includes('132'), 'Market Lab must present 132-question total');
must(market.includes('Indicator Foundations'), 'Market Lab must expose Indicator Foundations');
must(market.includes('原96题')||market.includes('96题'), 'Market Lab must preserve original 96-question pack identity');
must(trainer.includes('132题多方法互动训练器'), 'Trainer must keep 132-question multi-method identity');
const snapshots=(indicatorPack.match(/class="question-visual"/g)||[]).length;
must(snapshots===36, `Indicator Foundations must contain 36 visual snapshots, found ${snapshots}`);

const requiredFiles=[
 'library/classic-technical-analysis/index.html',
 'library/indicators/momentum-oscillators/index.html',
 'library/indicators/trend-following-tools/index.html',
 'library/indicators/pivot-points/index.html',
 'library/books/indicator-route/index.html'
];
for(const file of requiredFiles) must(fs.existsSync(file), `Missing multi-method content file ${file}`);

const sitemapRoutes=[
 '/library/indicators/','/library/indicators/macd/','/library/indicators/bollinger-bands/',
 '/library/indicators/momentum-oscillators/','/library/indicators/trend-following-tools/',
 '/library/indicators/pivot-points/','/library/classic-technical-analysis/',
 '/library/books/indicator-route/','/market-lab/practice/indicator-foundations/'
];
for(const route of sitemapRoutes) must(sitemap.includes(`https://t5quantlab.com${route}`), `sitemap missing ${route}`);

if(errors.length){
 console.error('Multi-method contract failed:');
 for(const e of errors) console.error(`- ${e}`);
 process.exit(1);
}
console.log('Multi-method contract OK: 13 Library routes, 12 indicator modules, Classic TA, 132-question trainer and specialist reading route are protected.');
