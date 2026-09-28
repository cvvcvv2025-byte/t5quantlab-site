import fs from 'node:fs';
const files=[
 'market-lab/practice/indicator-foundations/index.html','market-lab/practice/indicator-applied/index.html','market-lab/practice/classic-ta-applied/index.html',
 'market-lab/practice/macd-specialist/index.html','market-lab/practice/bollinger-specialist/index.html','market-lab/practice/rsi-specialist/index.html',
 'market-lab/practice/moving-averages-specialist/index.html','market-lab/practice/adx-dmi-specialist/index.html','market-lab/practice/stochastic-specialist/index.html',
 'market-lab/practice/ichimoku-specialist/index.html','market-lab/practice/volume-indicators-specialist/index.html','market-lab/practice/volatility-channels-specialist/index.html',
 'market-lab/practice/momentum-oscillators-specialist/index.html','market-lab/practice/trend-following-tools-specialist/index.html','market-lab/practice/pivot-points-specialist/index.html',
 'market-lab/practice/fibonacci-specialist/index.html','market-lab/practice/volume-profile-specialist/index.html','market-lab/practice/risk-management-specialist/index.html','market-lab/practice/strategy-families-specialist/index.html'
];
for(const file of files){let s=fs.readFileSync(file,'utf8'),before=s;if(!s.includes('/assets/specialist-trainer.css'))s=s.replace('</head>','<link rel="stylesheet" href="/assets/specialist-trainer.css"></head>');if(!s.includes('/assets/specialist-trainer.js'))s=s.replace('</body>','<script src="/assets/specialist-trainer.js"></script></body>');if(s!==before){fs.writeFileSync(file,s);console.log('trainer wired',file)}else console.log('no change',file)}