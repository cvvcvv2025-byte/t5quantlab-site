(()=>{
const card=[...document.querySelectorAll('main .card')].find(x=>x.querySelector('h3')?.textContent.trim()==='FVG');
if(!card)return;
card.querySelector('.glossary-visual')?.remove();
card.querySelector('.glossary-visual-note')?.remove();
const candle=(x,o,c,top,bottom,cls,n)=>`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" class="wick ${cls}"/><rect x="${x-8}" y="${Math.min(o,c)}" width="16" height="${Math.max(4,Math.abs(c-o))}" rx="1" class="${cls}"/><text x="${x-3}" y="132" class="num">${n}</text>`;
const grid=()=>[34,64,94,124].map(y=>`<line x1="18" y1="${y}" x2="302" y2="${y}" class="guide"/>`).join('');
const bull=`<svg viewBox="0 0 320 142" role="img" aria-label="多头FVG标准示例">${grid()}<rect x="126" y="67" width="162" height="21" class="gap"/><text x="218" y="62" class="label">FVG</text>${candle(82,104,91,84,112,'bull','1')}${candle(116,92,48,42,98,'bull','2')}${candle(150,62,54,50,67,'bull','3')}${candle(184,55,45,40,60,'bull','4')}${candle(218,46,58,42,64,'bear','5')}${candle(252,58,43,38,62,'bull','6')}</svg>`;
const bear=`<svg viewBox="0 0 320 142" role="img" aria-label="空头FVG标准示例">${grid()}<rect x="126" y="68" width="162" height="20" class="gap-bear"/><text x="218" y="101" class="label">FVG</text>${candle(82,40,54,34,68,'bear','1')}${candle(116,54,105,48,112,'bear','2')}${candle(150,88,98,84,104,'bear','3')}${candle(184,98,108,92,114,'bear','4')}${candle(218,108,94,90,112,'bull','5')}${candle(252,94,110,90,116,'bear','6')}</svg>`;
const invalid=`<svg viewBox="0 0 320 142" role="img" aria-label="不是FVG的重叠示例">${grid()}${candle(82,104,90,82,112,'bull','1')}${candle(116,90,55,48,98,'bull','2')}${candle(150,74,62,58,86,'bull','3')}<line x1="72" y1="82" x2="162" y2="82" stroke="#ff8f86" stroke-dasharray="4 3"/><text x="174" y="86" class="label">范围重叠</text>${candle(190,62,72,58,78,'bear','4')}${candle(224,72,64,60,78,'bull','5')}</svg>`;
const html=`<div class="fvg-examples"><div class="fvg-example"><header><b>多头 FVG</b><span>第1高点 ＜ 第3低点</span></header>${bull}</div><div class="fvg-example"><header><b>空头 FVG</b><span>第1低点 ＞ 第3高点</span></header>${bear}</div><div class="fvg-example"><header><b>不是 FVG</b><span>第1与第3根范围重叠</span></header>${invalid}</div></div><p class="fvg-rule">只看第1根与第3根的影线范围；第2根负责产生位移。阴影从第3根确认后向右延伸，回到区域称为Mitigation，不代表必然反转。</p>`;
card.insertAdjacentHTML('afterbegin',html);
})();
