import fs from 'node:fs';

const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const must=(cond,msg)=>{if(!cond)errors.push(msg)};
const count=(html,re)=>[...html.matchAll(re)].length;

const home=read('index.html');
const library=read('library/index.html');
const indicators=read('library/indicators/index.html');
const market=read('market-lab/index.html');
const trainer=read('market-lab/practice/trainer/index.html');
const books=read('library/books/index.html');
const extendedBooks=read('library/books/extended-catalog/index.html');
const indicatorPack=read('market-lab/practice/indicator-foundations/index.html');
const packs={
 applied:[read('market-lab/practice/indicator-applied/index.html'),/A\d{3}\s·/g,24],
 classic:[read('market-lab/practice/classic-ta-applied/index.html'),/C\d{3}\s·/g,24],
 macd:[read('market-lab/practice/macd-specialist/index.html'),/M\d{3}\s·/g,12],
 boll:[read('market-lab/practice/bollinger-specialist/index.html'),/B\d{3}\s·/g,12],
 rsi:[read('market-lab/practice/rsi-specialist/index.html'),/R\d{3}\s·/g,12],
 ma:[read('market-lab/practice/moving-averages-specialist/index.html'),/MA\d{3}\s·/g,12],
 adx:[read('market-lab/practice/adx-dmi-specialist/index.html'),/ADX\d{3}\s·/g,12],
 stochastic:[read('market-lab/practice/stochastic-specialist/index.html'),/STO\d{3}\s·/g,12],
 ichimoku:[read('market-lab/practice/ichimoku-specialist/index.html'),/ICH\d{3}\s·/g,12],
 volume:[read('market-lab/practice/volume-indicators-specialist/index.html'),/VOL\d{3}\s·/g,12],
 volatility:[read('market-lab/practice/volatility-channels-specialist/index.html'),/VOLC\d{3}\s·/g,12],
 momentum:[read('market-lab/practice/momentum-oscillators-specialist/index.html'),/MOM\d{3}\s·/g,12],
 trendtools:[read('market-lab/practice/trend-following-tools-specialist/index.html'),/TRD\d{3}\s·/g,12],
 pivot:[read('market-lab/practice/pivot-points-specialist/index.html'),/PIV\d{3}\s·/g,12]
};
const sitemap=read('sitemap.xml');

must(home.includes('324题')||home.includes('324'), 'home must present 324 public multi-method drills');
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
must(library.includes('324题'), 'Library must reference 324 public training drills');
must(/SMC \/ ICT/.test(library), 'Library must retain SMC as one method branch');
must(library.includes('/library/classic-technical-analysis/'), 'Library must expose Classic TA academy');

const indicatorModules=[
 'moving-averages','macd','rsi','stochastic','momentum-oscillators','bollinger-bands',
 'adx-dmi','trend-following-tools','ichimoku','volatility-channels','pivot-points','volume-indicators'
];
for(const slug of indicatorModules) must(indicators.includes(`/library/indicators/${slug}/`), `Indicator academy missing ${slug}`);
must((indicators.match(/class="indicator-card"/g)||[]).length>=25, 'Indicator academy must expose 12 modules, advanced guides and 12 specialist routes');
must(indicators.includes('/market-lab/practice/indicator-foundations/'), 'Indicator academy must link foundation pack');
must(indicators.includes('/market-lab/practice/indicator-applied/'), 'Indicator academy must link applied pack');
must(indicators.includes('/library/indicators/indicator-combinations/'), 'Indicator academy missing combinations framework');
must(indicators.includes('/library/indicators/failure-regimes/'), 'Indicator academy missing failure-regime guide');
must(indicators.includes('/library/indicators/indicator-to-ea/'), 'Indicator academy missing indicator-to-EA guide');

must(market.includes('324'), 'Market Lab must present 324 public drill total');
must(market.includes('132'), 'Market Lab must disclose 132-question unified trainer');
must(market.includes('192'), 'Market Lab must disclose 192 specialist drills');
must(market.includes('204题指标训练'), 'Market Lab must expose 204-question indicator track');
must(market.includes('Indicator Foundations'), 'Market Lab must expose Indicator Foundations');
must(market.includes('Indicator Applied'), 'Market Lab must expose Indicator Applied');
must(market.includes('Classic Technical Analysis'), 'Market Lab must expose Classic TA pack');
// Preserve localStorage compatibility: unified interactive trainer remains 132 questions.
must(trainer.includes('132题多方法互动训练器'), 'Core interactive trainer must keep 132-question identity');

const snapshots=(indicatorPack.match(/class="question-visual"/g)||[]).length;
must(snapshots===36, `Indicator Foundations must contain 36 visual snapshots, found ${snapshots}`);
for(const [name,[html,re,expected]] of Object.entries(packs)) must(count(html,re)===expected,`${name} pack must contain ${expected} scenarios, found ${count(html,re)}`);
must(132+24+24+(12*12)===324,'public drill arithmetic must remain 324');
must(/PARAMETER OVERFIT/.test(packs.applied[0])&&/DUPLICATE AUTH/.test(packs.applied[0])&&/HTF BAR/.test(packs.applied[0]), 'Applied pack must cover overfit, state and MTF parity');

must(books.includes('60')&&books.includes('/library/books/extended-catalog/'), 'Books hub must expose 60-title layered library and extended catalog');
must((extendedBooks.match(/class="book"/g)||[]).length===30, 'Extended books catalog must contain exactly 30 title cards');
must(/CORE 30 \+ EXTENDED 30 = 60/.test(extendedBooks), 'Extended catalog must declare 30+30 layered model');

const requiredFiles=[
 'library/classic-technical-analysis/index.html','library/classic-technical-analysis/support-resistance/index.html',
 'library/classic-technical-analysis/trendlines-channels/index.html','library/classic-technical-analysis/chart-patterns/index.html',
 'library/classic-technical-analysis/breakout-failure/index.html','library/indicators/indicator-combinations/index.html',
 'library/indicators/failure-regimes/index.html','library/indicators/indicator-to-ea/index.html',
 'library/books/indicator-route/index.html','library/books/extended-catalog/index.html',
 'market-lab/practice/momentum-oscillators-specialist/index.html',
 'market-lab/practice/trend-following-tools-specialist/index.html',
 'market-lab/practice/pivot-points-specialist/index.html'
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
 '/library/books/extended-catalog/','/market-lab/practice/indicator-foundations/',
 '/market-lab/practice/indicator-applied/','/market-lab/practice/classic-ta-applied/',
 '/market-lab/practice/macd-specialist/','/market-lab/practice/bollinger-specialist/',
 '/market-lab/practice/rsi-specialist/','/market-lab/practice/moving-averages-specialist/',
 '/market-lab/practice/adx-dmi-specialist/','/market-lab/practice/stochastic-specialist/',
 '/market-lab/practice/ichimoku-specialist/','/market-lab/practice/volume-indicators-specialist/',
 '/market-lab/practice/volatility-channels-specialist/','/market-lab/practice/momentum-oscillators-specialist/',
 '/market-lab/practice/trend-following-tools-specialist/','/market-lab/practice/pivot-points-specialist/'
];
for(const route of sitemapRoutes) must(sitemap.includes(`https://t5quantlab.com${route}`), `sitemap missing ${route}`);

if(errors.length){
 console.error('Multi-method contract failed:');
 for(const e of errors) console.error(`- ${e}`);
 process.exit(1);
}
console.log('Multi-method contract OK: 324 public drills = 132 unified + 192 specialist; all 12 indicator families have specialist packs and the 60-book library is protected.');
