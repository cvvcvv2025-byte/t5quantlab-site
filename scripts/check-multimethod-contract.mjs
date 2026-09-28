import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8');
const must=(cond,msg)=>{if(!cond){console.error('MULTIMETHOD CONTRACT:',msg);process.exitCode=1;}};

const home=read('index.html');
const library=read('library/index.html');
const lab=read('market-lab/index.html');
const indicators=read('library/indicators/index.html');
const sitemap=read('sitemap.xml');

for(const [name,html] of [['home',home],['library',library],['market-lab',lab]]){
  must(/156/.test(html),`${name} must expose 156-question multimethod scope`);
}
must(/MACD/.test(home)&&/Bollinger/.test(home)&&/RSI/.test(home), 'home must visibly include traditional indicators');
must(/不是SMC专站|NOT SMC-ONLY/.test(library), 'Library must preserve not-SMC-only positioning');
must(/12 MODULES/.test(indicators), 'Indicator academy must preserve 12 module families');
must(indicators.includes('/library/indicators/indicator-combinations/'),'indicator combinations route missing');
must(indicators.includes('/library/indicators/failure-regimes/'),'failure regimes route missing');
must(indicators.includes('/library/indicators/indicator-to-ea/'),'indicator-to-EA route missing');
must(lab.includes('/market-lab/practice/indicator-applied/'),'24 applied indicator pack missing from Market Lab');

for(const file of [
 'library/indicators/indicator-combinations/index.html',
 'library/indicators/failure-regimes/index.html',
 'library/indicators/indicator-to-ea/index.html',
 'market-lab/practice/indicator-applied/index.html'
]) must(fs.existsSync(file),`${file} missing`);

const applied=read('market-lab/practice/indicator-applied/index.html');
const qs=[...applied.matchAll(/A\d{3}\s·/g)];
must(qs.length===24,`Indicator Applied must contain 24 scenarios, found ${qs.length}`);
must(/REGIME/.test(applied)&&/DUPLICATE AUTH/.test(applied)&&/PARAMETER OVERFIT/.test(applied),'Applied pack must cover regime, state and overfit');

for(const route of [
 '/library/indicators/indicator-combinations/',
 '/library/indicators/failure-regimes/',
 '/library/indicators/indicator-to-ea/',
 '/market-lab/practice/indicator-applied/'
]) must(sitemap.includes(`https://t5quantlab.com${route}`),`sitemap missing ${route}`);

if(!process.exitCode) console.log('Multimethod platform contract OK');
