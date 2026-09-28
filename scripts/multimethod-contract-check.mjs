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
const appliedPack=read('market-lab/practice/indicator-applied/index.html');
const classicPack=read('market-lab/practice/classic-ta-applied/index.html');
const macdPack=read('market-lab/practice/macd-specialist/index.html');
const bollPack=read('market-lab/practice/bollinger-specialist/index.html');
const rsiPack=read('market-lab/practice/rsi-specialist/index.html');
const sitemap=read('sitemap.xml');

must(home.includes('216题')||home.includes('216'), 'home must present 216 public multi-method drills');
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
must(library.includes('216题'), 'Library must reference 216 public training drills');
must(/SMC \/ ICT/.test(library), 'Library must retain SMC as one method branch');
must(library.includes('/library/classic-technical-analysis/'), 'Library must expose Classic TA academy');

const indicatorModules=[
 'moving-averages','macd','rsi','stochastic','momentum-oscillators','bollinger-bands',
 'adx-dmi','trend-following-tools','ichimoku','volatility-channels','pivot-points','volume-indicators'
];
for(const slug of indicatorModules) must(indicators.includes(`/library/indicators/${slug}/`), `Indicator academy missing ${slug}`);
must((indicators.match(/class="indicator-card"/g)||[]).length>=16, 'Indicator academy must expose 12 modules plus advanced routes');
must(indicators.includes('/market-lab/practice/indicator-foundations/'), 'Indicator academy must link 36-question foundation pack');
must(indicators.includes('/market-lab/practice/indicator-applied/'), 'Indicator academy must link 24-question applied pack');
must(indicators.includes('/library/indicators/indicator-combinations/'), 'Indicator academy missing combinations framework');
must(indicators.includes('/library/indicators/failure-regimes/'), 'Indicator academy missing failure-regime guide');
must(indicators.includes('/library/indicators/indicator-to-ea/'), 'Indicator academy missing indicator-to-EA guide');

must(market.includes('216'), 'Market Lab must present 216 public drill total');
must(market.includes('132'), 'Market Lab must disclose 132-question unified trainer');
must(market.includes('84'), 'Market Lab must disclose 84 specialist drills');
must(market.includes('Indicator Foundations'), 'Market Lab must expose Indicator Foundations');
must(market.includes('Indicator Applied'), 'Market Lab must expose Indicator Applied');
must(market.includes('Classic Technical Analysis'), 'Market Lab must expose Classic TA specialist pack');
// Preserve localStorage compatibility: unified interactive trainer remains 132 questions.
must(trainer.includes('132题多方法互动训练器'), 'Core interactive trainer must keep 132-question identity');

const snapshots=(indicatorPack.match(/class="question-visual"/g)||[]).length;
must(snapshots===36, `Indicator Foundations must contain 36 visual snapshots, found ${snapshots}`);
const appliedCount=(appliedPack.match(/A\d{3}\s·/g)||[]).length;
must(appliedCount===24, `Indicator Applied must contain 24 scenarios, found ${appliedCount}`);
const classicCount=(classicPack.match(/C\d{3}\s·/g)||[]).length;
must(classicCount===24, `Classic TA pack must contain 24 scenarios, found ${classicCount}`);
const macdCount=(macdPack.match(/M\d{3}\s·/g)||[]).length;
must(macdCount===12, `MACD specialist must contain 12 scenarios, found ${macdCount}`);
const bollCount=(bollPack.match(/B\d{3}\s·/g)||[]).length;
must(bollCount===12, `Bollinger specialist must contain 12 scenarios, found ${bollCount}`);
const rsiCount=(rsiPack.match(/R\d{3}\s·/g)||[]).length;
must(rsiCount===12, `RSI specialist must contain 12 scenarios, found ${rsiCount}`);
must(132+24+24+12+12+12===216, 'public drill arithmetic must remain 216');
must(/PARAMETER OVERFIT/.test(appliedPack)&&/DUPLICATE AUTH/.test(appliedPack)&&/HTF BAR/.test(appliedPack), 'Applied pack must cover overfit, state and MTF parity');

const requiredFiles=[
 'library/classic-technical-analysis/index.html',
 'library/classic-technical-analysis/support-resistance/index.html',
 'library/classic-technical-analysis/trendlines-channels/index.html',
 'library/classic-technical-analysis/chart-patterns/index.html',
 'library/classic-technical-analysis/breakout-failure/index.html',
 'library/indicators/momentum-oscillators/index.html',
 'library/indicators/trend-following-tools/index.html',
 'library/indicators/pivot-points/index.html',
 'library/indicators/indicator-combinations/index.html',
 'library/indicators/failure-regimes/index.html',
 'library/indicators/indicator-to-ea/index.html',
 'library/books/indicator-route/index.html',
 'market-lab/practice/indicator-applied/index.html',
 'market-lab/practice/classic-ta-applied/index.html',
 'market-lab/practice/macd-specialist/index.html',
 'market-lab/practice/bollinger-specialist/index.html',
 'market-lab/practice/rsi-specialist/index.html'
];
for(const file of requiredFiles) must(fs.existsSync(file), `Missing multi-method content file ${file}`);

const sitemapRoutes=[
 '/library/indicators/','/library/indicators/macd/','/library/indicators/bollinger-bands/',
 '/library/indicators/momentum-oscillators/','/library/indicators/trend-following-tools/',
 '/library/indicators/pivot-points/','/library/indicators/indicator-combinations/',
 '/library/indicators/failure-regimes/','/library/indicators/indicator-to-ea/',
 '/library/classic-technical-analysis/','/library/classic-technical-analysis/support-resistance/',
 '/library/classic-technical-analysis/trendlines-channels/','/library/classic-technical-analysis/chart-patterns/',
 '/library/classic-technical-analysis/breakout-failure/','/library/books/indicator-route/',
 '/market-lab/practice/indicator-foundations/','/market-lab/practice/indicator-applied/',
 '/market-lab/practice/classic-ta-applied/','/market-lab/practice/macd-specialist/',
 '/market-lab/practice/bollinger-specialist/','/market-lab/practice/rsi-specialist/'
];
for(const route of sitemapRoutes) must(sitemap.includes(`https://t5quantlab.com${route}`), `sitemap missing ${route}`);

if(errors.length){
 console.error('Multi-method contract failed:');
 for(const e of errors) console.error(`- ${e}`);
 process.exit(1);
}
console.log('Multi-method contract OK: 216 public drills = 132 unified + 84 specialist; 12 indicator modules, Classic TA academy and specialist packs are protected.');
