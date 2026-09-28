(()=>{
'use strict';
const path=location.pathname.endsWith('/')?location.pathname:location.pathname+'/';
const grid=`<g opacity=".65"><line class="dg-grid" x1="40" y1="80" x2="760" y2="80"/><line class="dg-grid" x1="40" y1="160" x2="760" y2="160"/><line class="dg-grid" x1="40" y1="240" x2="760" y2="240"/><line class="dg-grid" x1="40" y1="320" x2="760" y2="320"/></g>`;
const cases={
'/market-lab/2026-08-27-h1-neckline-reclaim-failure/':{
 title:'案例图解｜4615–4620 跌破后 Reclaim，空头接受失败',
 sub:'规则示意图，不是原始K线截图。价位与事件顺序来自当时审计记录。',
 cap:'关键不是“曾经跌破”，而是跌破后没有持续留在颈线下方。快速 Reclaim 后，原空头 Break 逻辑应进入失效路径。',
 svg:`<svg viewBox="0 0 800 360" role="img" aria-label="H1颈线跌破后Reclaim案例示意图">${grid}<rect class="dg-zone2" x="80" y="150" width="640" height="54"/><text class="dg-small" x="90" y="144">颈线区域 4615–4620</text><polyline class="dg-line2" points="75,95 150,120 220,90 290,135 350,180 405,245 455,270 500,190 560,145 635,105 720,80"/><text class="dg-warntext" x="395" y="300">Break ↓</text><text class="dg-accent" x="505" y="178">Reclaim ↑</text><line class="dg-warn" x1="370" y1="205" x2="480" y2="205"/><text class="dg-small" x="300" y="220">未建立外侧接受</text><circle class="dg-dot" cx="500" cy="190" r="7"/><text class="dg-accent" x="605" y="92">原空头逻辑失效</text></svg>`},
'/market-lab/2026-08-27-m5-secondary-top-break-retest/':{
 title:'案例图解｜二次探顶 → 4593 Break → Retest Failure → T1',
 sub:'规则示意图，不是原始K线截图。4599–4601与4593来自当时实时审计。',
 cap:'二次探顶只是 Location/Reaction；真正提高可执行性的，是跌破约4593后第一次回踩不能重新站回，再出现向下推进。',
 svg:`<svg viewBox="0 0 800 360" role="img" aria-label="M5二次探顶破位回踩案例示意图">${grid}<rect class="dg-bad" x="90" y="70" width="360" height="48"/><text class="dg-warntext" x="100" y="62">4599–4601 二次测试区</text><line class="dg-warn" x1="85" y1="220" x2="730" y2="220"/><text class="dg-small" x="650" y="211">4593 Pivot</text><polyline class="dg-line2" points="80,255 145,180 205,105 270,170 330,92 390,175 440,235 500,205 555,225 625,285 720,315"/><text class="dg-warntext" x="305" y="82">Second Test</text><text class="dg-accent" x="415" y="258">Break</text><text class="dg-small" x="485" y="193">Retest</text><text class="dg-accent" x="565" y="255">Failure + Push</text><text class="dg-small" x="665" y="335">→ T1</text></svg>`},
'/market-lab/2026-08-28-m5-head-shoulders-missed-signal/':{
 title:'案例图解｜人工看到头肩顶，程序却没有完成 Entry 授权',
 sub:'这是审计语义示意，不是原始K线截图。重点是“视觉形态”和“程序门槛”之间的断点。',
 cap:'后续下跌不能反向证明系统应该进场。正确审计是逐字段确认：肩/头/颈线、Break、Retest、位移和状态授权究竟哪一项没有成立。',
 svg:`<svg viewBox="0 0 800 360" role="img" aria-label="头肩顶漏信号程序审计示意图">${grid}<line class="dg-warn" x1="90" y1="245" x2="710" y2="245"/><text class="dg-small" x="625" y="235">Neckline</text><polyline class="dg-line2" points="80,280 150,205 220,235 315,95 400,230 485,175 555,245 635,285 720,315"/><text class="dg-small" x="128" y="195">左肩</text><text class="dg-accent" x="292" y="80">头</text><text class="dg-small" x="462" y="162">右肩</text><text class="dg-accent" x="548" y="270">结构向下</text><rect class="dg-bad" x="92" y="300" width="445" height="38"/><text class="dg-warntext" x="110" y="325">视觉形态明显 ≠ 程序已满足全部门槛</text><text class="dg-small" x="600" y="300">后续4575–4581</text></svg>`},
'/market-lab/2026-08-28-m5-liquidity-absorption-t1-protect/':{
 title:'案例图解｜Entry → T1减仓 → Runner继续MFE → V形反弹',
 sub:'管理路径示意图，不是原始K线截图。价位来自当时B级计划与后续审计记录。',
 cap:'这个样本的研究重点不是“最后赚多少”，而是T1之后账户是否真的完成减仓、SL是否真的推到保护位、Runner是否按状态机退出。',
 svg:`<svg viewBox="0 0 800 360" role="img" aria-label="T1减仓保本Runner管理示意图">${grid}<rect class="dg-zone2" x="80" y="80" width="230" height="52"/><text class="dg-accent" x="90" y="70">Entry 4603.560–4605.458</text><line class="dg-warn" x1="80" y1="42" x2="720" y2="42"/><text class="dg-warntext" x="590" y="34">SL 4608.409</text><line class="dg-warn" x1="80" y1="205" x2="720" y2="205"/><text class="dg-small" x="610" y="196">T1 4596.770</text><line class="dg-warn" x1="80" y1="315" x2="720" y2="315"/><text class="dg-small" x="610" y="306">T2 4571.660</text><polyline class="dg-line2" points="90,105 165,130 240,175 320,215 390,260 455,285 520,250 585,170 650,95 720,55"/><circle class="dg-dot" cx="320" cy="215" r="7"/><text class="dg-accent" x="300" y="240">T1 → 减仓/保护</text><text class="dg-small" x="405" y="278">MFE≈4590</text><text class="dg-warntext" x="570" y="155">V形反弹</text><text class="dg-small" x="608" y="112">Runner不再承担原始风险</text></svg>`}
};
const item=cases[path];if(!item)return;
const hero=document.querySelector('.page-hero');
const firstSection=document.querySelector('main .section');
if(!firstSection)return;
const section=document.createElement('section');section.className='section alt';section.dataset.caseVisual='true';
section.innerHTML=`<div class="container"><div class="diagram" style="margin:0"><div class="diagram-head"><b>${item.title}</b><span>${item.sub}</span></div><div class="diagram-canvas">${item.svg}</div><div class="diagram-caption">${item.cap}</div></div><div class="notice" style="margin-top:14px"><strong>图示边界：</strong>示意图只表达经审计记录确认的关键价位与事件顺序；折线路径用于教学，不代表逐根K线历史复刻。</div></div>`;
firstSection.parentNode.insertBefore(section,firstSection);
})();